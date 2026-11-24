import { NextResponse, type NextRequest } from "next/server";
import { verifyAdmin, isSupabaseConfigured } from "@/lib/admin-auth";
import { isAdminProductFilter, summarizeProductConnections, type AdminProductFilter } from "@/lib/admin-products";
import { toDirectImageUrl } from "@/lib/images";

// The admin's product list (owner, 2026-11-24): every product on the site with its business, status, price and
// the hearts / matches on it. `?filter=active|paused|deleted|all&q=&page=&per=` — filter, search and paging run
// in the database; counts per filter come along for the chips.
const PER_DEFAULT = 50;
const PER_MAX = 200;

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.json({ products: [], total: 0, page: 1, per: PER_DEFAULT, counts: null });
  const { isAdmin, supabase } = await verifyAdmin();
  if (!isAdmin || !supabase) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const sp = request.nextUrl.searchParams;
  const filterRaw = sp.get("filter");
  const filter: AdminProductFilter = isAdminProductFilter(filterRaw) ? filterRaw : "active";
  const page = Math.max(1, Math.floor(Number(sp.get("page") || "1")) || 1);
  const per = Math.min(PER_MAX, Math.max(1, Math.floor(Number(sp.get("per") || String(PER_DEFAULT))) || PER_DEFAULT));
  const q = (sp.get("q") || "").trim().slice(0, 80);

  // The search covers the product name and the business (shop name / contact phone)
  let brandIds: string[] | null = null;
  if (q) {
    const like = `%${q.replace(/[%_,]/g, " ")}%`;
    const phoneAlt = q.startsWith("0") ? `%972${q.slice(1)}%` : like;
    const [{ data: byShop }, { data: byUser }] = await Promise.all([
      supabase.from("brand_profiles").select("id").ilike("shop_name", like).limit(300),
      supabase.from("users").select("id").or(`full_name.ilike.${like},phone.ilike.${phoneAlt}`).limit(300),
    ]);
    const userIds = ((byUser || []) as { id: string }[]).map((u) => u.id);
    const byContact = userIds.length ? await supabase.from("brand_profiles").select("id").in("user_id", userIds).limit(300) : { data: [] as { id: string }[] };
    brandIds = [...new Set([...((byShop || []) as { id: string }[]), ...((byContact.data || []) as { id: string }[])].map((b) => b.id))];
  }

  const base = () => {
    let query = supabase.from("products").select("*, brand_profiles!inner(id, shop_name, logo_url, user_id, users(full_name, phone, is_active))", { count: "exact" });
    if (q) {
      const like = `%${q.replace(/[%_,]/g, " ")}%`;
      query = brandIds && brandIds.length ? query.or(`name.ilike.${like},brand_id.in.(${brandIds.join(",")})`) : query.ilike("name", like);
    }
    return query;
  };
  const withFilter = (query: ReturnType<typeof base>, f: AdminProductFilter) => (f === "all" ? query : query.eq("status", f));

  const from = (page - 1) * per;
  const [pageRes, activeRes, pausedRes, deletedRes, allRes] = await Promise.all([
    withFilter(base(), filter).order("created_at", { ascending: false }).range(from, from + per - 1),
    withFilter(base(), "active").limit(0),
    withFilter(base(), "paused").limit(0),
    withFilter(base(), "deleted").limit(0),
    base().limit(0),
  ]);
  if (pageRes.error) {
    console.error("[admin/products] list error:", pageRes.error);
    return NextResponse.json({ error: "שגיאה בטעינת המוצרים" }, { status: 500 });
  }
  const counts = { active: activeRes.count || 0, paused: pausedRes.count || 0, deleted: deletedRes.count || 0, all: allRes.count || 0 };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (pageRes.data || []) as any[];
  const ids = rows.map((p) => p.id as string);
  const connsByProduct: Record<string, { status: string | null; initiated_by: string | null; mutual_at: string | null }[]> = {};
  if (ids.length) {
    const { data: conns } = await supabase.from("connections").select("product_id, status, initiated_by, mutual_at").in("product_id", ids);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const c of (conns || []) as any[]) (connsByProduct[c.product_id] ||= []).push({ status: c.status, initiated_by: c.initiated_by, mutual_at: c.mutual_at });
  }

  const products = rows.map((p) => {
    const brand = p.brand_profiles || {};
    const owner = brand.users || {};
    return {
      id: p.id,
      name: p.name || "",
      status: p.status || "active",
      price: Number(p.price) || 0,
      category: p.category || null,
      category_custom: p.category_custom || null,
      product_type: p.product_type || "physical",
      image_url: toDirectImageUrl(p.image_url || null, 400),
      max_creators: p.max_creators ?? null,
      created_at: p.created_at,
      brand: {
        id: brand.id || p.brand_id,
        user_id: brand.user_id || null,
        name: brand.shop_name || owner.full_name || "",
        contact: owner.full_name || "",
        phone: owner.phone || "",
        is_active: owner.is_active !== false,
        logo_url: brand.logo_url || null,
      },
      connections: summarizeProductConnections(connsByProduct[p.id] || []),
    };
  });

  return NextResponse.json({ products, total: pageRes.count || 0, page, per, filter, q, counts }, { headers: { "Cache-Control": "no-store" } });
}
