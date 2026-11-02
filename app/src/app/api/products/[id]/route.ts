import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { toPublicProduct, pickProductUpdates } from "@/lib/authz";

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
    .select("*, brand_profiles(shop_name, user_id, logo_url)")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "מוצר לא נמצא" }, { status: 404 });
  }

  const row = data as any;
  const ownerUserId = row.brand_profiles?.user_id as string | undefined;

  // Owner and admins see everything; anyone else sees the public shape only
  let privileged = false;
  const userClient = await createServerClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (user) {
    const { data: dbUser } = await admin
      .from("users")
      .select("id, type")
      .eq("auth_user_id", user.id)
      .single();
    privileged = !!dbUser && ((dbUser as any).type === "admin" || (dbUser as any).id === ownerUserId);
  }

  const fields = { ...row };
  delete fields.brand_profiles;
  const shaped = {
    ...fields,
    brand_name: row.brand_profiles?.shop_name || "",
    brand_user_id: ownerUserId || null,
    logo_url: row.brand_profiles?.logo_url || null,
  };

  return NextResponse.json({ product: privileged ? shaped : toPublicProduct(shaped) });
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

  const body = await request.json().catch(() => null);
  // Only real product columns, typed; unknown keys (e.g. the UI's `category`) are ignored (FUNC-02)
  const updates = pickProductUpdates(body);
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "אין שדות תקינים לעדכון" }, { status: 400 });
  }

  const { error } = await (admin.from("products") as any)
    .update(updates)
    .eq("id", id);

  if (error) {
    // invalid enum value / NOT NULL / CHECK → the caller sent a bad value, not a server fault
    if (["22P02", "23502", "23514"].includes((error as { code?: string }).code || "")) {
      return NextResponse.json({ error: "ערך לא תקין באחד השדות" }, { status: 400 });
    }
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
