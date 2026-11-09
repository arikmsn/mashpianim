import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { toPublicProduct } from "@/lib/authz";
import { OCCUPYING_STATUSES, normalizeMaxCreators, spotsLeft, brandRevealedToCreator, hideBrand } from "@/lib/connection-flow";
import { resolveViewer } from "@/lib/viewer";
import { readActiveRole } from "@/lib/active-role";
import { resolveProductCategory, cleanCustomCategory } from "@/lib/categories";
import { sanitizeBriefData } from "@/lib/brief";

function getSupabaseAdmin() {
  const url = process.env.NEXT_SUPABASE_URL;
  const key = process.env.SUPABASE_SEC_KEY;
  if (!url || !key) return null;
  return createSupabaseClient(url, key);
}

export async function GET(request: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ products: [] });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const brandId = searchParams.get("brand_id");
  const brandMe = searchParams.get("brand");

  let resolvedBrandId = brandId;

  // Who is asking? Owners of the listed brand and admin sessions get the full rows; everyone else the public
  // shape. `viewer.type` is the role this session is signed in as.
  const userClient = await createServerClient();
  const { data: { user } } = await userClient.auth.getUser();
  let viewer: { id: string; type: string } | null = null;
  if (user) {
    const resolved = await resolveViewer(admin, user.id, await readActiveRole());
    viewer = resolved ? { id: resolved.userId, type: resolved.role } : null;
  }

  if (brandMe === "me") {
    if (!user) {
      return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
    }
    if (!viewer) {
      return NextResponse.json({ products: [] });
    }
    const { data: brandProfile } = await admin
      .from("brand_profiles")
      .select("id")
      .eq("user_id", viewer.id)
      .single();
    if (brandProfile) {
      resolvedBrandId = (brandProfile as any).id;
    } else {
      return NextResponse.json({ products: [] });
    }
  }

  let privileged = viewer?.type === "admin" || brandMe === "me";
  if (!privileged && viewer && resolvedBrandId) {
    const { data: owned } = await admin
      .from("brand_profiles")
      .select("id")
      .eq("id", resolvedBrandId)
      .eq("user_id", viewer.id)
      .maybeSingle();
    privileged = !!owned;
  }

  // Products a creator skipped ("✕") stay out of their feed; the business behind a product is revealed to a
  // creator only through a connection the business chose (heart first / heart back / match)
  let passed = new Set<string>();
  const revealed = new Set<string>();
  if (viewer && viewer.type === "creator") {
    const { data: cp } = await admin.from("creator_profiles").select("id").eq("user_id", viewer.id).maybeSingle();
    if (cp) {
      const [{ data: passes }, { data: rels }] = await Promise.all([
        admin.from("creator_passes").select("product_id").eq("creator_id", (cp as any).id),
        admin.from("connections").select("product_id, status, initiated_by, mutual_at, approved_at").eq("creator_id", (cp as any).id),
      ]);
      passed = new Set(((passes || []) as { product_id: string }[]).map((p) => p.product_id));
      for (const c of (rels || []) as any[]) if (brandRevealedToCreator(c)) revealed.add(c.product_id);
    }
  }

  let query = admin
    .from("products")
    .select("*, brand_profiles!inner(shop_name, user_id, category, categories, logo_url, region)")
    .neq("status", "deleted")
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (resolvedBrandId) query = query.eq("brand_id", resolvedBrandId);

  const { data, error } = await query;

  if (error) {
    console.error("[products] list error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת מוצרים" }, { status: 500 });
  }

  // How many creator slots each product has used (every status from the match on counts) — BRAND-01
  const productIds = (data || []).map((p: any) => p.id);
  const occupiedByProduct = new Map<string, number>();
  if (productIds.length > 0) {
    const { data: occ } = await admin
      .from("connections")
      .select("product_id")
      .in("product_id", productIds)
      .in("status", [...OCCUPYING_STATUSES]);
    for (const c of (occ || []) as any[]) {
      occupiedByProduct.set(c.product_id, (occupiedByProduct.get(c.product_id) || 0) + 1);
    }
  }

  const products = (data || [])
    .map((p: any) => {
      const brandCats: string[] = Array.isArray(p.brand_profiles?.categories) && p.brand_profiles.categories.length > 0
        ? p.brand_profiles.categories
        : [p.brand_profiles?.category].filter(Boolean);
      const row = { ...p };
      delete row.brand_profiles;
      const occupied = occupiedByProduct.get(p.id) || 0;
      const shaped = {
        ...row,
        max_creators: normalizeMaxCreators(p.max_creators),
        occupied,
        spots_left: spotsLeft(p.max_creators, occupied),
        matched_count: occupied,
        brand_name: p.brand_profiles?.shop_name || "",
        brand_user_id: p.brand_profiles?.user_id || null,
        // The product's own category (migration 013); older rows without one fall back to the brand's
        category: p.category || brandCats[0] || "",
        category_custom: p.category_custom || null,
        categories: p.category ? [p.category] : brandCats,
        logo_url: p.brand_profiles?.logo_url || null,
        brand_region: p.brand_profiles?.region || null,
        brand_revealed: true,
      };
      if (privileged) return shaped;
      const visible = revealed.has(p.id) ? shaped : hideBrand(shaped);
      // Signed-in creators also get the brand's brief (shown on the product page); anonymous callers don't
      return viewer?.type === "creator"
        ? { ...toPublicProduct(visible), brief: p.brief ?? null, brief_data: p.brief_data ?? null }
        : toPublicProduct(visible);
    })
    // Creators browsing the feed don't see products whose creator limit is reached (no limit = always shown),
    // nor ones they skipped
    .filter((p: any) => privileged || ((p.spots_left === null || (p.spots_left as number) > 0) && !passed.has(p.id)));

  return NextResponse.json({ products });
}

export async function POST(request: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "המערכת לא מוגדרת" }, { status: 503 });
  }

  const userClient = await createServerClient();
  const { data: { user } } = await userClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  // Only a session signed in as a brand creates products (an admin signed in as a brand counts)
  const creator = await resolveViewer(admin, user.id, await readActiveRole());
  if (!creator || creator.role !== "brand") {
    return NextResponse.json({ error: "רק עסקים יכולים להוסיף מוצרים" }, { status: 403 });
  }
  const dbUser = { id: creator.userId, type: creator.type };

  let { data: brandProfile } = await admin
    .from("brand_profiles")
    .select("id, category, categories")
    .eq("user_id", dbUser.id)
    .maybeSingle();

  if (!brandProfile && dbUser.type === "admin") {
    const { data: newProfile } = await (admin.from("brand_profiles") as any)
      .insert({ user_id: (dbUser as any).id, shop_name: "מנהל מערכת", category: "כללי", total_credits: 100, used_credits: 0 })
      .select("id")
      .single();
    brandProfile = newProfile;
  }

  if (!brandProfile) {
    return NextResponse.json({ error: "פרופיל עסקי לא נמצא" }, { status: 404 });
  }

  const body = await request.json();
  const {
    name, description, price, image_url,
    shipping_policy, shipping_address,
    product_type, digital_access_type, digital_access_instructions, digital_access_duration_days,
    brief, brief_data, category, category_custom,
  } = body;

  // Product category: the brand's pick if valid, else the brand's own first category, else "כללי"
  const bp = brandProfile as { category?: string | null; categories?: string[] | null };
  const brandCategories: string[] = Array.isArray(bp.categories) && bp.categories.length > 0
    ? bp.categories
    : [bp.category].filter((c): c is string => typeof c === "string" && c.length > 0);

  if (!name || !price) {
    return NextResponse.json({ error: "שם ומחיר חובה" }, { status: 400 });
  }

  if (product_type === "digital" && !digital_access_type) {
    return NextResponse.json({ error: "חובה לבחור סוג גישה למוצר דיגיטלי" }, { status: 400 });
  }

  const { data: product, error } = await admin
    .from("products")
    .insert({
      brand_id: (brandProfile as any).id,
      name,
      description: description || null,
      price,
      image_url: image_url || null,
      shipping_policy: shipping_policy || "free",
      shipping_address: shipping_address || null,
      status: "active",
      product_type: product_type || "physical",
      digital_access_type: product_type === "digital" ? digital_access_type : null,
      digital_access_instructions: product_type === "digital" ? (digital_access_instructions || null) : null,
      digital_access_duration_days: product_type === "digital" ? (digital_access_duration_days || null) : null,
      // Brand-written notes + structured picks sent to the creator when a match opens (both optional)
      brief: typeof brief === "string" && brief.trim() ? brief.trim() : null,
      brief_data: sanitizeBriefData(brief_data),
      // No creator limit: the brand decides per match whom to confirm (2026-11-04)
      max_creators: null,
      category: resolveProductCategory(category, brandCategories),
      category_custom: cleanCustomCategory(category_custom),
    } as any)
    .select()
    .single();

  if (error) {
    console.error("[products] create error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת מוצר" }, { status: 500 });
  }

  return NextResponse.json({ product }, { status: 201 });
}
