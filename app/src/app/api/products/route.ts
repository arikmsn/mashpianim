import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ products: [] });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const brandId = searchParams.get("brand_id");

  const supabase = await createClient();

  let query = supabase
    .from("products")
    .select("*, brand_profiles!inner(shop_name, user_id)")
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (brandId) query = query.eq("brand_id", brandId);

  const { data, error } = await query;

  if (error) {
    console.error("[products] list error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת מוצרים" }, { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const products = (data || []).map((p: any) => ({
    ...p,
    brand_name: p.brand_profiles?.shop_name || "",
  }));

  return NextResponse.json({ products });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "המערכת לא מוגדרת" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  const { data: dbUser } = await supabase
    .from("users")
    .select("type")
    .eq("auth_user_id", user.id)
    .single();

  if ((dbUser as any)?.type !== "brand") {
    return NextResponse.json({ error: "רק עסקים יכולים להוסיף מוצרים" }, { status: 403 });
  }

  const { data: brandProfile } = await supabase
    .from("brand_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!brandProfile) {
    return NextResponse.json({ error: "פרופיל עסקי לא נמצא" }, { status: 404 });
  }

  const body = await request.json();
  const {
    name, description, price, image_url,
    shipping_policy, shipping_address, source_url,
    product_type, digital_access_type, digital_access_instructions, digital_access_duration_days,
  } = body;

  if (!name || !price) {
    return NextResponse.json({ error: "שם ומחיר חובה" }, { status: 400 });
  }

  // Validate digital product fields
  if (product_type === "digital" && !digital_access_type) {
    return NextResponse.json({ error: "חובה לבחור סוג גישה למוצר דיגיטלי" }, { status: 400 });
  }

  const { data: product, error } = await supabase
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
    } as any)
    .select()
    .single();

  if (error) {
    console.error("[products] create error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת מוצר" }, { status: 500 });
  }

  return NextResponse.json({ product }, { status: 201 });
}
