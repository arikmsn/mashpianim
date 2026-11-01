import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/admin-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ product: { id, name: "מוצר לדוגמה", status: "active" } });
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select("*, brand_profiles(shop_name, user_id)")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "מוצר לא נמצא" }, { status: 404 });
  }

  return NextResponse.json({
    product: {
      ...data,
      brand_name: (data.brand_profiles as { shop_name: string })?.shop_name || "",
    },
  });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: true });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  const { data: product } = await supabase
    .from("products")
    .select("brand_id, brand_profiles(user_id)")
    .eq("id", id)
    .single();

  if (!product) {
    return NextResponse.json({ error: "מוצר לא נמצא" }, { status: 404 });
  }

  const brandUserId = (product.brand_profiles as { user_id: string })?.user_id;
  const { data: dbUser } = await supabase
    .from("users")
    .select("type")
    .eq("id", user.id)
    .single();

  if (brandUserId !== user.id && dbUser?.type !== "admin") {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const body = await request.json();
  const { name, description, price, image_url, shipping_policy, shipping_address, source_url, status } = body;

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (price !== undefined) updates.price = price;
  if (image_url !== undefined) updates.image_url = image_url;
  if (shipping_policy !== undefined) updates.shipping_policy = shipping_policy;
  if (shipping_address !== undefined) updates.shipping_address = shipping_address;
  if (source_url !== undefined) updates.source_url = source_url;
  if (status !== undefined) updates.status = status;

  const { error } = await supabase
    .from("products")
    .update(updates)
    .eq("id", id);

  if (error) {
    console.error("[products] update error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: true });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  const { data: product } = await supabase
    .from("products")
    .select("brand_id, brand_profiles(user_id)")
    .eq("id", id)
    .single();

  if (!product) {
    return NextResponse.json({ error: "מוצר לא נמצא" }, { status: 404 });
  }

  const brandUserId = (product.brand_profiles as { user_id: string })?.user_id;
  if (brandUserId !== user.id) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const { error } = await supabase
    .from("products")
    .update({ status: "deleted" })
    .eq("id", id);

  if (error) {
    console.error("[products] delete error:", error);
    return NextResponse.json({ error: "שגיאה במחיקה" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
