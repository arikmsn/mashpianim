import { NextResponse } from "next/server";
import { verifyAdmin, isSupabaseConfigured } from "@/lib/admin-auth";

// Admin list of connections / matches (owner list, 2026-11-14): who, what, status, dates, how much was said and
// uploaded, and whether an admin blocked the chat. Newest first; the detail (transcript, files, warnings,
// blocking) lives under /api/admin/connections/[id].
export async function GET() {
  if (!isSupabaseConfigured()) return NextResponse.json({ connections: [] });
  const { isAdmin, supabase } = await verifyAdmin();
  if (!isAdmin || !supabase) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const { data, error } = await supabase
    .from("connections")
    .select(`
      id, status, initiated_by, mutual_at, created_at, approved_at, completed_at, blocked_at, blocked_reason,
      products(id, name),
      creator_profiles!connections_creator_id_fkey(id, user_id, users(id, full_name, phone)),
      brand_profiles!connections_brand_id_fkey(id, user_id, shop_name, users(id, full_name, phone))
    `)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    console.error("[admin/connections] list:", error.message);
    return NextResponse.json({ error: "שגיאה בטעינת החיבורים" }, { status: 500 });
  }

  // Message / video counts per connection (a few hundred rows today; paginate when that grows)
  const [msgRes, vidRes] = await Promise.all([
    supabase.from("messages").select("connection_id, is_system"),
    supabase.from("videos").select("connection_id").not("connection_id", "is", null),
  ]);
  const msgCount: Record<string, number> = {};
  for (const m of (msgRes.data || []) as { connection_id: string; is_system: boolean | null }[]) {
    if (!m.is_system) msgCount[m.connection_id] = (msgCount[m.connection_id] || 0) + 1;
  }
  const vidCount: Record<string, number> = {};
  for (const v of (vidRes.data || []) as { connection_id: string }[]) vidCount[v.connection_id] = (vidCount[v.connection_id] || 0) + 1;

  const connections = ((data || []) as any[]).map((c) => {
    const cu = c.creator_profiles?.users;
    const bu = c.brand_profiles?.users;
    return {
      id: c.id,
      status: c.status || null,
      initiated_by: c.initiated_by || null,
      mutual_at: c.mutual_at || null,
      created_at: c.created_at,
      approved_at: c.approved_at || null,
      completed_at: c.completed_at || null,
      blocked_at: c.blocked_at || null,
      blocked_reason: c.blocked_reason || null,
      product: c.products ? { id: c.products.id, name: c.products.name } : null,
      creator: { user_id: cu?.id || c.creator_profiles?.user_id || null, name: (cu?.full_name || "").trim() || (cu?.phone ? `ללא שם (${cu.phone})` : "יוצר/ת"), phone: cu?.phone || null },
      brand: { user_id: bu?.id || c.brand_profiles?.user_id || null, name: c.brand_profiles?.shop_name || bu?.full_name || "עסק", phone: bu?.phone || null },
      messages: msgCount[c.id] || 0,
      videos: vidCount[c.id] || 0,
    };
  });

  return NextResponse.json({ connections });
}
