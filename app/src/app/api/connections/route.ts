import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/admin-auth";
import { createNotification, logActivity } from "@/lib/notifications";

function getAdminClient() {
  const url = process.env.NEXT_SUPABASE_URL;
  const key = process.env.SUPABASE_SEC_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ connections: [] });
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data: dbUser } = await admin
    .from("users")
    .select("id, type")
    .eq("auth_user_id", user.id)
    .single();

  if (!dbUser) {
    return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });
  }

  let query = admin
    .from("connections")
    .select(`
      *,
      products(name, image_url, price, product_type),
      creator_profiles!connections_creator_id_fkey(user_id, users(full_name, avatar_url)),
      brand_profiles!connections_brand_id_fkey(user_id, shop_name, logo_url, users(full_name, avatar_url))
    `)
    .order("created_at", { ascending: false });

  const userType = (dbUser as any).type;

  if (userType === "creator") {
    const { data: cp } = await admin
      .from("creator_profiles")
      .select("id")
      .eq("user_id", (dbUser as any).id)
      .single();
    if (cp) {
      query = query.eq("creator_id", (cp as any).id);
    }
  } else if (userType === "brand") {
    const { data: bp } = await admin
      .from("brand_profiles")
      .select("id")
      .eq("user_id", (dbUser as any).id)
      .single();
    if (bp) {
      query = query.eq("brand_id", (bp as any).id);
    }
  }
  // admin sees all

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

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  // Get user and their creator profile
  const { data: dbUser } = await admin
    .from("users")
    .select("id, type")
    .eq("auth_user_id", user.id)
    .single();

  if ((dbUser as any)?.type !== "creator" && (dbUser as any)?.type !== "admin") {
    return NextResponse.json({ error: "רק יוצרי תוכן יכולים לשלוח בקשות" }, { status: 403 });
  }

  let { data: creatorProfile } = await admin
    .from("creator_profiles")
    .select("id")
    .eq("user_id", (dbUser as any).id)
    .single();

  if (!creatorProfile && (dbUser as any)?.type === "admin") {
    const { data: newProfile } = await (admin.from("creator_profiles") as any)
      .insert({ user_id: (dbUser as any).id, categories: ["אופנה"], level: "creator" })
      .select("id")
      .single();
    creatorProfile = newProfile;
  }

  if (!creatorProfile) {
    return NextResponse.json({ error: "לא נמצא פרופיל יוצר" }, { status: 404 });
  }

  const body = await request.json();
  const { product_id } = body;

  if (!product_id) {
    return NextResponse.json({ error: "מזהה מוצר חסר" }, { status: 400 });
  }

  // Get product and brand info
  const { data: product } = await admin
    .from("products")
    .select("id, brand_id, status, name, product_type, brand_profiles(total_credits, used_credits, user_id, shop_name, users(id, full_name))")
    .eq("id", product_id)
    .single();

  if (!product || (product as any).status !== "active") {
    return NextResponse.json({ error: "מוצר לא זמין" }, { status: 404 });
  }

  // Check brand has available slots
  const brandProfile = (product as any).brand_profiles;
  const availableSlots = (brandProfile?.total_credits || 0) - (brandProfile?.used_credits || 0);
  if (availableSlots <= 0) {
    return NextResponse.json({ error: "לעסק אין פניות זמינות. לא ניתן לשלוח בקשה כרגע." }, { status: 400 });
  }

  // Check for duplicate active connection
  const { data: existing } = await admin
    .from("connections")
    .select("id")
    .eq("creator_id", (creatorProfile as any).id)
    .eq("product_id", product_id)
    .not("status", "in", '("cancelled","rejected","completed")')
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "כבר שלחתם בקשה למוצר זה" }, { status: 409 });
  }

  const { data: connection, error } = await admin
    .from("connections")
    .insert({
      creator_id: (creatorProfile as any).id,
      brand_id: (product as any).brand_id,
      product_id,
      status: "pending",
      delivery_type: (product as any).product_type || "physical",
    } as any)
    .select()
    .single();

  if (error) {
    console.error("[connections] create error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת בקשה" }, { status: 500 });
  }

  // Notify brand about new connection request
  const brandUser = brandProfile?.users;
  if (brandUser) {
    await createNotification({
      userId: (brandUser as any).id,
      type: "new_connection_request",
      title: "בקשת חיבור חדשה!",
      body: `יוצר תוכן שלח בקשה למוצר "${(product as any).name}"`,
      data: { connectionId: (connection as any).id },
    });
  }

  await logActivity({
    actorId: (dbUser as any).id,
    action: "connection_created",
    entityType: "connection",
    entityId: (connection as any).id,
    details: { product_id, product_name: (product as any).name },
  });

  return NextResponse.json({ connection }, { status: 201 });
}
