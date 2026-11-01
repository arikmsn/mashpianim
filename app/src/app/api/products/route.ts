import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/admin-auth";

const mockProducts = [
  {
    id: "1",
    name: "סרום ויטמין C לעור הפנים",
    brand_id: "b1",
    brand_name: "GlowUp Skincare",
    image_url: null,
    price: 189,
    description: "סרום מרוכז עם ויטמין C טהור לעור זוהר ובריא",
    shipping_policy: "free",
    status: "active",
    category: "ביוטי",
    requirements: "סרטון אנבוקסינג + שימוש",
    max_creators: 3,
    applicants_count: 12,
    created_at: new Date().toISOString(),
  },
  {
    id: "2",
    name: "שעון ספורט חכם",
    brand_id: "b2",
    brand_name: "TechFit",
    image_url: null,
    price: 350,
    description: "שעון ספורט עם מעקב דופק, GPS ועמידות במים",
    shipping_policy: "free",
    status: "active",
    category: "טכנולוגיה",
    requirements: "סרטון סקירה + שימוש באימון",
    max_creators: 5,
    applicants_count: 24,
    created_at: new Date().toISOString(),
  },
  {
    id: "3",
    name: "תיק גב עור טבעוני",
    brand_id: "b3",
    brand_name: "UrbanStyle",
    image_url: null,
    price: 220,
    description: "תיק גב אלגנטי מעור טבעוני, מושלם ליומיום",
    shipping_policy: "free",
    status: "active",
    category: "אופנה",
    requirements: "סטיילינג + סרטון OOTD",
    max_creators: 2,
    applicants_count: 8,
    created_at: new Date().toISOString(),
  },
  {
    id: "4",
    name: "ערכת בישול שף",
    brand_id: "b4",
    brand_name: "ChefHome",
    image_url: null,
    price: 280,
    description: "ערכה מלאה עם סכינים, קרש חיתוך ומגבות מטבח",
    shipping_policy: "free",
    status: "active",
    category: "אוכל",
    requirements: "סרטון בישול עם הערכה",
    max_creators: 2,
    applicants_count: 6,
    created_at: new Date().toISOString(),
  },
  {
    id: "5",
    name: "סט יוגה פרימיום",
    brand_id: "b5",
    brand_name: "ZenLife",
    image_url: null,
    price: 199,
    description: "מזרן יוגה, בלוקים ורצועה — כל מה שצריך לתרגול",
    shipping_policy: "free",
    status: "active",
    category: "ספורט",
    requirements: "סרטון תרגול יוגה",
    max_creators: 4,
    applicants_count: 15,
    created_at: new Date().toISOString(),
  },
  {
    id: "6",
    name: "מנורת לד דקורטיבית",
    brand_id: "b6",
    brand_name: "LightHouse",
    image_url: null,
    price: 145,
    description: "מנורה עם 16 צבעים ושלט רחוק, מושלמת לחדר",
    shipping_policy: "free",
    status: "active",
    category: "בית וגינה",
    requirements: "סרטון עיצוב חדר / אווירה",
    max_creators: 5,
    applicants_count: 18,
    created_at: new Date().toISOString(),
  },
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const category = searchParams.get("category");
  const brandId = searchParams.get("brand_id");

  if (!isSupabaseConfigured()) {
    let filtered = mockProducts;
    if (status) filtered = filtered.filter((p) => p.status === status);
    if (category) filtered = filtered.filter((p) => p.category === category);
    if (brandId) filtered = filtered.filter((p) => p.brand_id === brandId);
    return NextResponse.json({ products: filtered });
  }

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

  const products = (data || []).map((p: Record<string, unknown>) => ({
    ...p,
    brand_name: (p.brand_profiles as { shop_name: string })?.shop_name || "",
  }));

  return NextResponse.json({ products });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
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
    .eq("id", user.id)
    .single();

  if (dbUser?.type !== "brand") {
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
  const { name, description, price, image_url, shipping_policy, shipping_address, source_url } = body;

  if (!name || !price) {
    return NextResponse.json({ error: "שם ומחיר חובה" }, { status: 400 });
  }

  const { data: product, error } = await supabase
    .from("products")
    .insert({
      brand_id: brandProfile.id,
      name,
      description: description || null,
      price,
      image_url: image_url || null,
      shipping_policy: shipping_policy || "free",
      shipping_address: shipping_address || null,
      source_url: source_url || null,
      status: "active",
    })
    .select()
    .single();

  if (error) {
    console.error("[products] create error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת מוצר" }, { status: 500 });
  }

  return NextResponse.json({ product }, { status: 201 });
}
