import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { toPublicProduct, pickProductUpdates } from "@/lib/authz";
import { CLOSED_STATUSES, OCCUPYING_STATUSES, normalizeMaxCreators, spotsLeft, brandRevealedToCreator, hideBrand } from "@/lib/connection-flow";
import { getTimelineSettings } from "@/lib/settings";
import { resolveViewer } from "@/lib/viewer";
import { readActiveRole } from "@/lib/active-role";

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
  // `viewer.type` here is the role this session is signed in as (creator / brand / admin)
  let privileged = false;
  let viewer: { id: string; type: string } | null = null;
  const userClient = await createServerClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (user) {
    const resolved = await resolveViewer(admin, user.id, await readActiveRole());
    viewer = resolved ? { id: resolved.userId, type: resolved.role } : null;
    privileged = !!viewer && (viewer.type === "admin" || viewer.id === ownerUserId);
  }

  // Creator slots taken (every status from the match on) — same numbers as the list route
  const { count } = await admin
    .from("connections")
    .select("id", { count: "exact", head: true })
    .eq("product_id", id)
    .in("status", [...OCCUPYING_STATUSES]);
  const occupied = count || 0;

  const fields = { ...row };
  delete fields.brand_profiles;
  const shaped = {
    ...fields,
    max_creators: normalizeMaxCreators(row.max_creators),
    occupied,
    spots_left: spotsLeft(row.max_creators, occupied),
    brand_name: row.brand_profiles?.shop_name || "",
    brand_user_id: ownerUserId || null,
    logo_url: row.brand_profiles?.logo_url || null,
    brand_revealed: true,
  };

  // Signed-in creators read the brand's brief on the product page (to decide whether to heart);
  // anonymous visitors still get the public shape without it
  const product = privileged
    ? shaped
    : { ...toPublicProduct(shaped), ...(viewer?.type === "creator" ? { brief: row.brief ?? null, brief_data: row.brief_data ?? null } : {}) };

  // The viewing creator's own connection for this product (open one first, else the latest closed one).
  // Admins act as creators in the app, so their own creator profile is looked up too.
  let connection: Record<string, unknown> | null = null;
  if (viewer?.type === "creator" || viewer?.type === "admin") {
    const { data: cp } = await admin
      .from("creator_profiles")
      .select("id")
      .eq("user_id", viewer.id)
      .maybeSingle();
    if (cp) {
      const { data: conns } = await admin
        .from("connections")
        .select(
          "id, status, initiated_by, mutual_at, delivery_type, tracking_number, tracking_url, digital_access_value, revision_notes, revision_count, approved_at, shipped_at, delivered_at, filmed_at, completed_at, ship_deadline, deliver_deadline, film_deadline, review_deadline, created_at"
        )
        .eq("creator_id", (cp as any).id)
        .eq("product_id", id)
        .order("created_at", { ascending: false })
        .limit(5);
      const list = (conns || []) as Record<string, unknown>[];
      connection = list.find((c) => !(CLOSED_STATUSES as readonly string[]).includes(c.status as string)) || list[0] || null;
    }
  }

  // The business stays anonymous until it chose this creator (heart first / heart back / match)
  const visible = privileged || brandRevealedToCreator(connection as any) ? product : hideBrand(product as Record<string, unknown>);

  const timelines = await getTimelineSettings(admin);

  return NextResponse.json({
    product: visible,
    connection,
    settings: {
      shipping_days: timelines.shipping_days,
      filming_days: timelines.filming_days,
      review_days: timelines.review_days,
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
