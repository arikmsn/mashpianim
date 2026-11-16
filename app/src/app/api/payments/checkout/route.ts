import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/admin-auth";
import { resolveViewer } from "@/lib/viewer";
import { readActiveRole } from "@/lib/active-role";
import { getCreditPrices, getFirstPurchaseDiscount } from "@/lib/settings";
import { logActivity } from "@/lib/notifications";
import { checkRateLimit, rateLimitedResponse, RATE_LIMITS } from "@/lib/rate-limit";
import { applyFirstPurchaseDiscount, buildBeginRedirectBody, isPackageId, packageOffers, paymentsMode, purchasesOpenFor, validateBilling } from "@/lib/payments";
import { sumitBeginRedirect, sumitCredentials } from "@/lib/adapters/sumit";
import { firstPurchaseEligible } from "@/lib/payments-server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.mashpian.online";

function getAdminClient() {
  const url = process.env.NEXT_SUPABASE_URL;
  const key = process.env.SUPABASE_SEC_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// POST { package, billing: { name, companyNumber?, email } } → { url } of SUMIT's payment page.
// Opens a pending `transactions` row (the order) first; its id is the ExternalIdentifier SUMIT hands back.
// The first-purchase discount is applied here again from the settings (never from the client).
export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "המערכת לא מוגדרת" }, { status: 503 });
  const userClient = await createServerClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const viewer = await resolveViewer(admin, user.id, await readActiveRole());
  if (!viewer || viewer.role !== "brand" || !viewer.brandProfileId) {
    return NextResponse.json({ error: "רק עסקים רוכשים סרטונים" }, { status: 403 });
  }
  const mode = paymentsMode(process.env);
  const creds = sumitCredentials();
  if (!purchasesOpenFor(mode, viewer.isAdmin) || !creds) {
    return NextResponse.json({ error: "רכישה מקוונת עדיין לא פתוחה — פנו אלינו דרך \"צור קשר\"" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { package?: unknown; billing?: unknown } | null;
  if (!isPackageId(body?.package)) return NextResponse.json({ error: "בחרו חבילה" }, { status: 400 });
  const billing = validateBilling(body?.billing);
  if (!billing.ok) return NextResponse.json({ error: billing.error }, { status: 400 });

  const limit = await checkRateLimit(admin, "checkout:user", viewer.userId, RATE_LIMITS.checkoutUser);
  if (!limit.allowed) return rateLimitedResponse(limit);

  const [prices, discountPct, eligible, { data: account }] = await Promise.all([
    getCreditPrices(admin),
    getFirstPurchaseDiscount(admin),
    firstPurchaseEligible(admin, viewer.brandProfileId),
    admin.from("users").select("phone").eq("id", viewer.userId).maybeSingle(),
  ]);
  const offer = applyFirstPurchaseDiscount(packageOffers(prices), discountPct > 0 && eligible ? discountPct : 0).find((o) => o.id === body!.package)!;

  // The invoice details stick to the business for next time (021)
  const { error: billingErr } = await admin
    .from("brand_profiles")
    .update({ billing_name: billing.value.name, billing_company_number: billing.value.companyNumber, billing_email: billing.value.email } as any)
    .eq("id", viewer.brandProfileId);
  if (billingErr) console.error("[payments] billing save failed:", billingErr.message);

  const { data: tx, error: txErr } = await admin
    .from("transactions")
    .insert({
      brand_id: viewer.brandProfileId,
      amount: offer.price,
      credits: offer.credits,
      payment_method: "sumit",
      provider: "sumit",
      package: offer.id,
      status: "pending",
      billing_name: billing.value.name,
      billing_company_number: billing.value.companyNumber,
      billing_email: billing.value.email,
    } as any)
    .select("id")
    .single();
  if (txErr || !tx) {
    console.error("[payments] order insert failed:", txErr?.message);
    return NextResponse.json({ error: "לא הצלחנו לפתוח הזמנה — נסו שוב בעוד רגע" }, { status: 503 });
  }
  const transactionId = (tx as any).id as string;

  const page = await sumitBeginRedirect(
    buildBeginRedirectBody({
      companyId: creds.CompanyID,
      apiKey: creds.APIKey,
      transactionId,
      brandProfileId: viewer.brandProfileId,
      billing: billing.value,
      phone: ((account as any)?.phone as string) || null,
      offer,
      returnUrl: `${APP_URL}/api/payments/sumit/return`,
      cancelUrl: `${APP_URL}/api/payments/sumit/cancel`,
    })
  );
  if (!page.ok) {
    await admin.from("transactions").update({ status: "failed", failure_reason: `beginredirect:${page.error}`.slice(0, 200) } as any).eq("id", transactionId);
    return NextResponse.json({ error: "דף התשלום לא נפתח כרגע — נסו שוב בעוד רגע או פנו אלינו" }, { status: 502 });
  }

  await logActivity({
    actorId: viewer.userId,
    action: "purchase_started",
    entityType: "transaction",
    entityId: transactionId,
    details: { package: offer.id, credits: offer.credits, amount: offer.price, discount_pct: offer.discountPct || 0 },
  });
  return NextResponse.json({ url: page.data, transactionId });
}
