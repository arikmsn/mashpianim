import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/admin-auth";

const mockConnections = [
  { id: "1", product_name: "סרום ויטמין C", brand_name: "GlowUp Skincare", creator_name: "נועה כהן", status: "filming", created_at: new Date().toISOString() },
  { id: "2", product_name: "שעון ספורט חכם", brand_name: "TechFit", creator_name: "דנה לוי", status: "shipped", created_at: new Date().toISOString() },
  { id: "3", product_name: "תיק גב עור טבעוני", brand_name: "UrbanStyle", creator_name: "שרה אברהם", status: "in_review", created_at: new Date().toISOString() },
];

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ connections: mockConnections });
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

  if (!dbUser) {
    return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });
  }

  let query = supabase
    .from("connections")
    .select(`
      *,
      products(name, image_url, price),
      creator:users!connections_creator_id_fkey(full_name, avatar_url),
      brand:users!connections_brand_id_fkey(full_name, avatar_url)
    `)
    .order("created_at", { ascending: false });

  if (dbUser.type === "creator") {
    query = query.eq("creator_id", user.id);
  } else if (dbUser.type === "brand") {
    const { data: brandProfile } = await supabase
      .from("brand_profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();
    if (brandProfile) {
      query = query.eq("brand_id", brandProfile.id);
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error("[connections] list error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת חיבורים" }, { status: 500 });
  }

  return NextResponse.json({ connections: data || [] });
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

  if (dbUser?.type !== "creator") {
    return NextResponse.json({ error: "רק יוצרי תוכן יכולים לשלוח בקשות" }, { status: 403 });
  }

  const body = await request.json();
  const { product_id } = body;

  if (!product_id) {
    return NextResponse.json({ error: "מזהה מוצר חסר" }, { status: 400 });
  }

  const { data: product } = await supabase
    .from("products")
    .select("id, brand_id, status")
    .eq("id", product_id)
    .single();

  if (!product || product.status !== "active") {
    return NextResponse.json({ error: "מוצר לא זמין" }, { status: 404 });
  }

  const { data: existing } = await supabase
    .from("connections")
    .select("id")
    .eq("creator_id", user.id)
    .eq("product_id", product_id)
    .not("status", "in", '("cancelled","rejected")')
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "כבר שלחתם בקשה למוצר זה" }, { status: 409 });
  }

  const { data: connection, error } = await supabase
    .from("connections")
    .insert({
      creator_id: user.id,
      brand_id: product.brand_id,
      product_id,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    console.error("[connections] create error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת בקשה" }, { status: 500 });
  }

  return NextResponse.json({ connection }, { status: 201 });
}
