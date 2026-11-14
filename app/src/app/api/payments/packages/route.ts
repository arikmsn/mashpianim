import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/admin-auth";
import { resolveViewer } from "@/lib/viewer";
import { readActiveRole } from "@/lib/active-role";
import { getCreditPrices } from "@/lib/settings";
import { packageOffers, paymentsMode, purchasesOpenFor } from "@/lib/payments";

function getAdminClient() {
  const url = process.env.NEXT_SUPABASE_URL;
  const key = process.env.SUPABASE_SEC_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// What the purchase sheet shows a business: whether online payment is open to it (SUMIT_PAYMENTS switch),
// the packages with the admin's prices, and the invoice details it typed last time.
export async function GET() {
  if (!isSupabaseConfigured()) return NextResponse.json({ enabled: false, mode: "off", packages: [], billing: null });
  const userClient = await createServerClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const viewer = await resolveViewer(admin, user.id, await readActiveRole());
  if (!viewer || !viewer.brandProfileId) return NextResponse.json({ error: "רק עסקים רוכשים סרטונים" }, { status: 403 });

  const mode = paymentsMode(process.env);
  const enabled = purchasesOpenFor(mode, viewer.isAdmin);
  const prices = await getCreditPrices(admin);

  // Invoice details: what the business typed before (021), else its name and the account e-mail
  let billing: { name: string; companyNumber: string; email: string } = { name: "", companyNumber: "", email: "" };
  const [{ data: profile }, { data: account }] = await Promise.all([
    admin.from("brand_profiles").select("*").eq("id", viewer.brandProfileId).maybeSingle(),
    admin.from("users").select("email, full_name").eq("id", viewer.userId).maybeSingle(),
  ]);
  const p = (profile || {}) as Record<string, unknown>;
  const a = (account || {}) as Record<string, unknown>;
  billing = {
    name: (typeof p.billing_name === "string" && p.billing_name) || (p.shop_name as string) || (a.full_name as string) || "",
    companyNumber: (typeof p.billing_company_number === "string" && p.billing_company_number) || "",
    email: (typeof p.billing_email === "string" && p.billing_email) || (typeof a.email === "string" && !a.email.endsWith("@phone.mashpian.online") ? a.email : "") || "",
  };

  return NextResponse.json({
    enabled,
    mode,
    packages: enabled ? packageOffers(prices) : [],
    billing,
    notes: ["המחירים בשקלים וכוללים מע״מ.", "התשלום מתבצע בדף מאובטח של SUMIT — פרטי הכרטיס לא נשמרים אצלנו.", "חשבונית מס/קבלה נשלחת אוטומטית למייל שתציינו.", "ביטול חבילה שלא נוצלה אפשרי תוך 14 יום, לפי תנאי השירות."],
  });
}
