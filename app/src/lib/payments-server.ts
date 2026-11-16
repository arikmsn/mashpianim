// Completing a SUMIT purchase: verify with SUMIT, credit the business, tell everyone — once per order, whether
// the business came back through the return URL or the cron found the payment later. Server-only.
import type { SupabaseClient } from "@supabase/supabase-js";
import { sumitGetPayment, sumitListPayments } from "@/lib/adapters/sumit";
import { createNotification, logActivity } from "@/lib/notifications";
import { packageLabel, verifySumitPayment, formatILS } from "@/lib/payments";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any, any, any, any, any>;

export type CompleteStatus = "completed" | "already" | "invalid" | "not_found" | "error";

export interface CompleteResult {
  status: CompleteStatus;
  credits?: number;
  reason?: string;
}

const TX_SELECT = `
  id, brand_id, amount, credits, status, package, provider, created_at,
  brand_profiles(id, user_id, shop_name, total_credits, users(id, full_name))
`;

export async function completeSumitTransaction(admin: Admin, transactionId: string, paymentId: number, source: "return" | "reconcile"): Promise<CompleteResult> {
  const { data: raw } = await admin.from("transactions").select(TX_SELECT).eq("id", transactionId).maybeSingle();
  const tx = raw as any;
  if (!tx || tx.provider !== "sumit") return { status: "not_found" };
  if (tx.status === "completed") return { status: "already", credits: tx.credits };

  const lookup = await sumitGetPayment(paymentId);
  if (!lookup.ok) return { status: "error", reason: lookup.error };
  const check = verifySumitPayment(lookup.data, { transactionId, amount: Number(tx.amount) });
  if (!check.ok) {
    // A payment SUMIT itself calls invalid closes the order; anything else stays pending for the cron
    if (check.reason.startsWith("invalid:")) {
      await admin.from("transactions").update({ status: "failed", failure_reason: check.reason.slice(0, 200), provider_payment_id: String(paymentId) } as any).eq("id", transactionId).eq("status", "pending");
    } else {
      console.error(`[payments] order ${transactionId} / payment ${paymentId} rejected: ${check.reason}`);
      await admin.from("transactions").update({ failure_reason: check.reason.slice(0, 200) } as any).eq("id", transactionId).eq("status", "pending");
    }
    return { status: "invalid", reason: check.reason };
  }
  const payment = lookup.data!;

  // Only the writer that flips pending → completed credits the business (the return and the cron can race)
  const now = new Date().toISOString();
  const { data: flipped } = await admin
    .from("transactions")
    .update({
      status: "completed",
      completed_at: now,
      payment_ref: String(payment.ID),
      provider_payment_id: String(payment.ID),
      provider_customer_id: payment.CustomerID != null ? String(payment.CustomerID) : null,
      document_id: payment.DocumentID != null ? String(payment.DocumentID) : null,
      failure_reason: null,
    } as any)
    .eq("id", transactionId)
    .eq("status", "pending")
    .select("id");
  if (!flipped || (flipped as any[]).length === 0) return { status: "already", credits: tx.credits };

  const profile = tx.brand_profiles;
  const credits = Number(tx.credits) || 0;
  if (profile?.id) {
    const { data: fresh } = await admin.from("brand_profiles").select("total_credits").eq("id", profile.id).maybeSingle();
    const total = Number((fresh as any)?.total_credits ?? profile.total_credits ?? 0) + credits;
    const { error: creditErr } = await admin
      .from("brand_profiles")
      .update({ total_credits: total, ...(payment.CustomerID != null ? { sumit_customer_id: String(payment.CustomerID) } : {}) } as any)
      .eq("id", profile.id);
    if (creditErr) console.error("[payments] credit update failed:", creditErr.message);
    // The legacy purchase ledger feeds the dashboard's "סרטונים שנמכרו החודש"
    await admin.from("credits").insert({ brand_id: profile.id, total: credits, used: 0, package_name: packageLabel(credits) } as any);
  }

  const shop = profile?.shop_name || profile?.users?.full_name || "עסק";
  const amountText = formatILS(Number(tx.amount) || 0);
  try {
    if (profile?.user_id) {
      await createNotification({
        userId: profile.user_id,
        type: "credits_loaded",
        title: `✅ ${packageLabel(credits)} נוספו לחבילה שלכם`,
        body: `התשלום על סך ${amountText} התקבל. חשבונית מס/קבלה נשלחה למייל שציינתם.`,
        data: { transactionId, role: "brand" },
      });
    }
    const { data: admins } = await admin.from("users").select("id").or("type.eq.admin,is_admin.eq.true");
    await Promise.all(
      ((admins || []) as { id: string }[]).map((a) =>
        createNotification({
          userId: a.id,
          type: "purchase_received",
          title: `💰 רכישה: ${shop} — ${packageLabel(credits)}`,
          body: `${amountText} דרך SUMIT${source === "reconcile" ? " (אומת על ידי הקרון)" : ""}. החבילה נטענה אוטומטית.`,
          data: { transactionId, role: "admin" },
        })
      )
    );
  } catch (err) {
    console.error("[payments] notifications failed:", err);
  }
  await logActivity({
    actorId: profile?.user_id || undefined,
    action: "purchase_completed",
    entityType: "transaction",
    entityId: transactionId,
    details: { credits, amount: Number(tx.amount), payment_id: payment.ID, document_id: payment.DocumentID ?? null, source },
  });
  return { status: "completed", credits };
}

// Pending SUMIT orders older than ten minutes: look for their payment in SUMIT's list (a buyer who paid and
// closed the tab never hit the return URL). Orders with no payment after a day are closed as expired.
export async function reconcileSumitPayments(admin: Admin): Promise<{ checked: number; completed: number; expired: number; error?: string }> {
  const out = { checked: 0, completed: 0, expired: 0 } as { checked: number; completed: number; expired: number; error?: string };
  const tenMinutesAgo = new Date(Date.now() - 10 * 60_000).toISOString();
  const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString();
  const { data, error } = await admin
    .from("transactions")
    .select("id, created_at, amount, brand_id")
    .eq("provider", "sumit")
    .eq("status", "pending")
    .gte("created_at", threeDaysAgo)
    .lte("created_at", tenMinutesAgo)
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) {
    out.error = error.message;
    return out;
  }
  const pending = (data || []) as { id: string; created_at: string; amount: number; brand_id: string }[];
  out.checked = pending.length;
  if (pending.length === 0) return out;

  const from = new Date(new Date(pending[0].created_at).getTime() - 60 * 60_000);
  const list = await sumitListPayments(from, new Date());
  if (!list.ok) {
    out.error = list.error;
    return out;
  }
  const byOrder = new Map<string, number>();
  for (const p of list.data) {
    const ext = typeof p.ExternalIdentifier === "string" ? p.ExternalIdentifier.trim().toLowerCase() : "";
    if (ext && p.ValidPayment) byOrder.set(ext, p.ID);
  }
  const dayAgo = Date.now() - 86_400_000;
  for (const tx of pending) {
    const paymentId = byOrder.get(tx.id.toLowerCase());
    if (paymentId) {
      const r = await completeSumitTransaction(admin, tx.id, paymentId, "reconcile");
      if (r.status === "completed") out.completed += 1;
    } else if (new Date(tx.created_at).getTime() < dayAgo) {
      await admin.from("transactions").update({ status: "failed", failure_reason: "expired" } as any).eq("id", tx.id).eq("status", "pending");
      out.expired += 1;
    }
  }
  return out;
}

// A business that never completed an online order gets the first-purchase discount (admin settings)
export async function firstPurchaseEligible(admin: Admin, brandProfileId: string): Promise<boolean> {
  const { count } = await admin.from("transactions").select("id", { count: "exact", head: true }).eq("brand_id", brandProfileId).eq("status", "completed");
  return (count || 0) === 0;
}
