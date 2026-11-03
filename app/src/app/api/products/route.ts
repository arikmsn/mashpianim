import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { toPublicProduct } from "@/lib/authz";
import { OCCUPYING_STATUSES, normalizeMaxCreators, spotsLeft } from "@/lib/connection-flow";

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

  // Who is asking? Owners of the listed brand and admins get the full rows; everyone else the public shape.
  const userClient = await createServerClient();
  const { data: { user } } = await userClient.auth.getUser();
  let viewer: { id: string; type: string } | null = null;
  if (user) {
    const { data: dbUser } = await admin
      .from("users")
      .select("id, type")
      .eq("auth_user_id", user.id)
      .single();
    viewer = (dbUser as any) || null;
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

  let query = admin
    .from("products")
    .select("*, brand_profiles!inner(shop_name, user_id, category, categories, logo_url)")
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
        category: brandCats[0] || "",
        categories: brandCats,
        logo_url: p.brand_profiles?.logo_url || null,
      };
      if (privileged) return shaped;
      // Signed-in creators also get the brand's brief (shown on the product page); anonymous callers don't
      return viewer?.type === "creator" ? { ...toPublicProduct(shaped), brief: p.brief ?? null } : toPublicProduct(shaped);
    })
    // Creators browsing the feed don't see products whose creator slots are all taken
    .filter((p: any) => privileged || (p.spots_left as number) > 0);

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

  const { data: dbUser } = await admin
    .from("users")
    .select("id, type")
    .eq("auth_user_id", user.id)
    .single();

  if ((dbUser as any)?.type !== "brand" && (dbUser as any)?.type !== "admin") {
    return NextResponse.json({ error: "רק עסקים יכולים להוסיף מוצרים" }, { status: 403 });
  }

  let { data: brandProfile } = await admin
    .from("brand_profiles")
    .select("id")
    .eq("user_id", (dbUser as any).id)
    .single();

  if (!brandProfile && (dbUser as any)?.type === "admin") {
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
    shipping_policy, shipping_address, source_url,
    product_type, digital_access_type, digital_access_instructions, digital_access_duration_days,
    expiration_date, quantity, brief, max_creators,
  } = body;

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
      source_url: source_url || null,
      status: "active",
      product_type: product_type || "physical",
      digital_access_type: product_type === "digital" ? digital_access_type : null,
      digital_access_instructions: product_type === "digital" ? (digital_access_instructions || null) : null,
      digital_access_duration_days: product_type === "digital" ? (digital_access_duration_days || null) : null,
      expiration_date: expiration_date || null,
      quantity: quantity || null,
      // Brand-written brief sent to the creator when a match opens (optional)
      brief: typeof brief === "string" && brief.trim() ? brief.trim() : null,
      // How many creators may be matched with this product (1–50, default 3)
      max_creators: normalizeMaxCreators(max_creators),
    } as any)
    .select()
    .single();

  if (error) {
    console.error("[products] create error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת מוצר" }, { status: 500 });
  }

  return NextResponse.json({ product }, { status: 201 });
}
