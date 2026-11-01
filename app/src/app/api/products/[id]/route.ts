import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

type RouteContext = { params: Promise<{ id: string }> };

function getSupabaseAdmin() {
  const url = process.env.NEXT_SUPABASE_URL;
  const key = process.env.SUPABASE_SEC_KEY;
  if (!url || !key) return null;
  return createSupabaseClient(url, key);
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "המערכת לא מוגדרת" }, { status: 503 });
  }

  const { data, error } = await admin
    .from("products")
    .select("*, brand_profiles(shop_name, user_id)")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "מוצר לא נמצא" }, { status: 404 });
  }

  return NextResponse.json({
    product: {
      ...(data as any),
      brand_name: ((data as any).brand_profiles as { shop_name: string })?.shop_name || "",
    },
  });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "המערכת לא מוגדרת" }, { status: 503 });
  }

  const userClient = await createServerClient();
  const { data: { user } } = await userClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  const { data: product } = await admin
    .from("products")
    .select("brand_id, brand_profiles(user_id)")
    .eq("id", id)
    .single();

  if (!product) {
    return NextResponse.json({ error: "מוצר לא נמצא" }, { status: 404 });
  }

  const brandUserId = ((product as any).brand_profiles as { user_id: string })?.user_id;
  const { data: dbUser } = await admin
    .from("users")
    .select("id, type")
    .eq("auth_user_id", user.id)
    .single();

  if (brandUserId !== (dbUser as any)?.id && (dbUser as any)?.type !== "admin") {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const body = await request.json();
  const { name, description, price, image_url, shipping_policy, shipping_address, source_url, status,
    product_type, digital_access_type, digital_access_instructions, digital_access_duration_days,
    category, expiration_date, quantity } = body;

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (price !== undefined) updates.price = price;
  if (image_url !== undefined) updates.image_url = image_url;
  if (shipping_policy !== undefined) updates.shipping_policy = shipping_policy;
  if (shipping_address !== undefined) updates.shipping_address = shipping_address;
  if (source_url !== undefined) updates.source_url = source_url;
  if (status !== undefined) updates.status = status;
  if (product_type !== undefined) updates.product_type = product_type;
  if (digital_access_type !== undefined) updates.digital_access_type = digital_access_type;
  if (digital_access_instructions !== undefined) updates.digital_access_instructions = digital_access_instructions;
  if (digital_access_duration_days !== undefined) updates.digital_access_duration_days = digital_access_duration_days;
  if (category !== undefined) updates.category = category;
  if (expiration_date !== undefined) updates.expiration_date = expiration_date;
  if (quantity !== undefined) updates.quantity = quantity;

  const { error } = await (admin.from("products") as any)
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

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "המערכת לא מוגדרת" }, { status: 503 });
  }

  const userClient = await createServerClient();
  const { data: { user } } = await userClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  const { data: product } = await admin
    .from("products")
    .select("brand_id, brand_profiles(user_id)")
    .eq("id", id)
    .single();

  if (!product) {
    return NextResponse.json({ error: "מוצר לא נמצא" }, { status: 404 });
  }

  const brandUserId = ((product as any).brand_profiles as { user_id: string })?.user_id;
  const { data: dbUser } = await admin
    .from("users")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (brandUserId !== (dbUser as any)?.id) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const { error } = await (admin.from("products") as any)
    .update({ status: "deleted" })
    .eq("id", id);

  if (error) {
    console.error("[products] delete error:", error);
    return NextResponse.json({ error: "שגיאה במחיקה" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
