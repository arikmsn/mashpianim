import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

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

  if (brandMe === "me") {
    const userClient = await createServerClient();
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
    }
    const { data: dbUser } = await admin
      .from("users")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();
    if (!dbUser) {
      return NextResponse.json({ products: [] });
    }
    const { data: brandProfile } = await admin
      .from("brand_profiles")
      .select("id")
      .eq("user_id", (dbUser as any).id)
      .single();
    if (brandProfile) {
      resolvedBrandId = (brandProfile as any).id;
    } else {
      return NextResponse.json({ products: [] });
    }
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

  const products = (data || []).map((p: any) => {
    const brandCats: string[] = Array.isArray(p.brand_profiles?.categories) && p.brand_profiles.categories.length > 0
      ? p.brand_profiles.categories
      : [p.brand_profiles?.category].filter(Boolean);
    return {
    ...p,
    brand_name: p.brand_profiles?.shop_name || "",
    brand_user_id: p.brand_profiles?.user_id || null,
    category: brandCats[0] || "",
    categories: brandCats,
    logo_url: p.brand_profiles?.logo_url || null,
    };
  });

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
    expiration_date, quantity,
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
    } as any)
    .select()
    .single();

  if (error) {
    console.error("[products] create error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת מוצר" }, { status: 500 });
  }

  return NextResponse.json({ product }, { status: 201 });
}
