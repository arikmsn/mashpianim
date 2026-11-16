import { NextResponse, type NextRequest } from "next/server";
import { verifyAdmin, isSupabaseConfigured } from "@/lib/admin-auth";
import { isAdminConnectionFilter, type AdminConnectionFilter } from "@/lib/admin-connections";

// Admin list of connections / matches (owner list, 2026-11-14; paged on 2026-11-16: "no limit for me").
// `?filter=matched|active|pending|blocked|all&page=1&per=100&q=…` — the filter, the search and the paging run in
// the database, so every connection is reachable; counts per filter come along for the chips. The detail
// (transcript, files, warnings, blocking) lives under /api/admin/connections/[id].
const PER_DEFAULT = 100;
const PER_MAX = 200;
const MATCHED_NOT = '("pending","rejected","cancelled")';
const ACTIVE_NOT = '("pending","rejected","cancelled","completed")';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilter(query: any, filter: AdminConnectionFilter) {
  switch (filter) {
    case "matched":
      return query.not("status", "in", MATCHED_NOT);
    case "active":
      return query.not("status", "in", ACTIVE_NOT).is("blocked_at", null);
    case "pending":
      return query.eq("status", "pending");
    case "blocked":
      return query.not("blocked_at", "is", null);
    default:
      return query;
  }
}

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.json({ connections: [], total: 0, page: 1, per: PER_DEFAULT, counts: null });
  const { isAdmin, supabase } = await verifyAdmin();
  if (!isAdmin || !supabase) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const sp = request.nextUrl.searchParams;
  const filterRaw = sp.get("filter");
  const filter: AdminConnectionFilter = isAdminConnectionFilter(filterRaw) ? filterRaw : "matched";
  const page = Math.max(1, Math.floor(Number(sp.get("page") || "1")) || 1);
  const per = Math.min(PER_MAX, Math.max(10, Math.floor(Number(sp.get("per") || String(PER_DEFAULT))) || PER_DEFAULT));
  const q = (sp.get("q") || "").trim().slice(0, 80);

  // Search: resolve the matching creators / businesses / products first, then filter the connections by their ids
  let idFilter: string | null = null;
  if (q) {
    const like = `%${q.replace(/[%_,()]/g, " ").trim()}%`;
    const [users, shops, products] = await Promise.all([
      supabase.from("users").select("id").or(`full_name.ilike.${like},phone.ilike.${like}`).limit(300),
      supabase.from("brand_profiles").select("id").ilike("shop_name", like).limit(300),
      supabase.from("products").select("id").ilike("name", like).limit(300),
    ]);
    const userIds = ((users.data || []) as { id: string }[]).map((u) => u.id);
    let creatorProfileIds: string[] = [];
    let brandProfileIds = ((shops.data || []) as { id: string }[]).map((b) => b.id);
    if (userIds.length > 0) {
      const [cps, bps] = await Promise.all([
        supabase.from("creator_profiles").select("id").in("user_id", userIds).limit(300),
        supabase.from("brand_profiles").select("id").in("user_id", userIds).limit(300),
      ]);
      creatorProfileIds = ((cps.data || []) as { id: string }[]).map((c) => c.id);
      brandProfileIds = [...new Set([...brandProfileIds, ...((bps.data || []) as { id: string }[]).map((b) => b.id)])];
    }
    const productIds = ((products.data || []) as { id: string }[]).map((p) => p.id);
    const parts: string[] = [];
    if (creatorProfileIds.length) parts.push(`creator_id.in.(${creatorProfileIds.join(",")})`);
    if (brandProfileIds.length) parts.push(`brand_id.in.(${brandProfileIds.join(",")})`);
    if (productIds.length) parts.push(`product_id.in.(${productIds.join(",")})`);
    if (parts.length === 0) {
      return NextResponse.json({ connections: [], total: 0, page: 1, per, filter, q, counts: null });
    }
    idFilter = parts.join(",");
  }

  const base = () => {
    const query = supabase.from("connections");
    return idFilter ? { or: idFilter, query } : { or: null, query };
  };

  // The page
  let listQuery = applyFilter(
    base().query.select(
      `
      id, status, initiated_by, mutual_at, created_at, approved_at, completed_at, blocked_at, blocked_reason,
      products(id, name),
      creator_profiles!connections_creator_id_fkey(id, user_id, users(id, full_name, phone)),
      brand_profiles!connections_brand_id_fkey(id, user_id, shop_name, users(id, full_name, phone))
    `,
      { count: "exact" }
    ),
    filter
  );
  if (idFilter) listQuery = listQuery.or(idFilter);
  const from = (page - 1) * per;
  const { data, error, count } = await listQuery.order("created_at", { ascending: false }).range(from, from + per - 1);
  if (error) {
    console.error("[admin/connections] list:", error.message);
    return NextResponse.json({ error: "שגיאה בטעינת החיבורים" }, { status: 500 });
  }

  // Counts for the filter chips (within the same search)
  const countFor = async (f: AdminConnectionFilter): Promise<number> => {
    let query = applyFilter(base().query.select("id", { count: "exact", head: true }), f);
    if (idFilter) query = query.or(idFilter);
    const { count: c } = await query;
    return c || 0;
  };
  const [all, matched, active, pending, blocked] = await Promise.all([countFor("all"), countFor("matched"), countFor("active"), countFor("pending"), countFor("blocked")]);

  // Message / video counts for the rows on this page only
  const ids = ((data || []) as { id: string }[]).map((c) => c.id);
  const msgCount: Record<string, number> = {};
  const vidCount: Record<string, number> = {};
  if (ids.length > 0) {
    const [msgRes, vidRes] = await Promise.all([
      supabase.from("messages").select("connection_id, is_system").in("connection_id", ids),
      supabase.from("videos").select("connection_id").in("connection_id", ids),
    ]);
    for (const m of (msgRes.data || []) as { connection_id: string; is_system: boolean | null }[]) {
      if (!m.is_system) msgCount[m.connection_id] = (msgCount[m.connection_id] || 0) + 1;
    }
    for (const v of (vidRes.data || []) as { connection_id: string }[]) vidCount[v.connection_id] = (vidCount[v.connection_id] || 0) + 1;
  }

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

  return NextResponse.json({ connections, total: count || 0, page, per, filter, q, counts: { all, matched, active, pending, blocked } });
}
