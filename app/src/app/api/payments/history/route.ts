import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/admin-auth";
import { resolveViewer } from "@/lib/viewer";
import { readActiveRole } from "@/lib/active-role";
import { packageLabel } from "@/lib/payments";

function getAdminClient() {
  const url = process.env.NEXT_SUPABASE_URL;
  const key = process.env.SUPABASE_SEC_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export interface BillingOrder {
  id: string;
  created_at: string;
  completed_at: string | null;
  package: string | null;
  credits: number;
  amount: number;
  status: string;
  payment_id: string | null;
  document_id: string | null;
}

export interface BillingMovement {
  at: string;
  delta: number | null; // null = a note without a count (a team update of the package)
  text: string;
  kind: "purchase" | "match" | "refund" | "team";
}

// The business's orders and credit movements for the "סרטונים וחיוב" page (owner, 2026-11-16).
// Movements are derived: paid orders (+N), confirmed matches (−1 each, the paid step), cancellations of a
// confirmed match (+1 back), and the team's package updates from the audit log.
export async function GET() {
  if (!isSupabaseConfigured()) return NextResponse.json({ orders: [], movements: [] });
  const userClient = await createServerClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const viewer = await resolveViewer(admin, user.id, await readActiveRole());
  if (!viewer || !viewer.brandProfileId) return NextResponse.json({ error: "רק עסקים" }, { status: 403 });
  const brandId = viewer.brandProfileId;

  const [txRes, connRes, logRes] = await Promise.all([
    admin.from("transactions").select("*").eq("brand_id", brandId).order("created_at", { ascending: false }).limit(100),
    admin
      .from("connections")
      .select("id, status, approved_at, created_at, products(name), creator_profiles!connections_creator_id_fkey(users(full_name))")
      .eq("brand_id", brandId)
      .not("approved_at", "is", null)
      .order("approved_at", { ascending: false })
      .limit(300),
    admin
      .from("activity_log")
      .select("created_at, details")
      .eq("action", "admin_update_brand")
      .eq("entity_id", viewer.userId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const orders: BillingOrder[] = ((txRes.data || []) as any[]).map((t) => ({
    id: t.id,
    created_at: t.created_at,
    completed_at: t.completed_at || null,
    package: t.package || null,
    credits: Number(t.credits) || 0,
    amount: Number(t.amount) || 0,
    status: t.status,
    payment_id: t.provider_payment_id || t.payment_ref || null,
    document_id: t.document_id || null,
  }));

  const movements: BillingMovement[] = [];
  for (const o of orders) {
    if (o.status === "completed") movements.push({ at: o.completed_at || o.created_at, delta: o.credits, text: `רכישת חבילה — ${packageLabel(o.credits)}`, kind: "purchase" });
  }
  for (const c of (connRes.data || []) as any[]) {
    const product = c.products?.name || "מוצר";
    const creator = (c.creator_profiles?.users?.full_name || "").trim() || "יוצר/ת";
    movements.push({ at: c.approved_at, delta: -1, text: `אישור חיבור: "${product}" · ${creator}`, kind: "match" });
    if (c.status === "cancelled") {
      // `connections` keeps no cancellation timestamp; the refund is listed next to the match it undid
      movements.push({ at: c.approved_at, delta: 1, text: `ביטול החיבור "${product}" — הסרטון חזר ליתרה`, kind: "refund" });
    }
  }
  for (const l of (logRes.data || []) as any[]) {
    const total = l.details?.total_credits;
    if (typeof total === "number") movements.push({ at: l.created_at, delta: null, text: `עדכון החבילה על ידי הצוות: סה״כ ${packageLabel(total)}`, kind: "team" });
  }
  movements.sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0));

  return NextResponse.json({ orders, movements: movements.slice(0, 200) });
}
