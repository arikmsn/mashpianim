import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { resolveViewer } from "@/lib/viewer";
import { readActiveRole } from "@/lib/active-role";

function getAdmin() {
  const url = process.env.NEXT_SUPABASE_URL;
  const key = process.env.SUPABASE_SEC_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function brandOfSession() {
  const userClient = await createServerClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "לא מחובר" }, { status: 401 }) };
  const admin = getAdmin();
  if (!admin) return { error: NextResponse.json({ error: "Service unavailable" }, { status: 503 }) };
  const viewer = await resolveViewer(admin, user.id, await readActiveRole());
  if (!viewer || viewer.role !== "brand" || !viewer.brandProfileId) {
    return { error: NextResponse.json({ error: "אין הרשאה" }, { status: 403 }) };
  }
  return { admin, brandProfileId: viewer.brandProfileId };
}

// POST { creator_user_id } — the brand skipped this creator in the gallery ("X"); never shown to it again
export async function POST(request: NextRequest) {
  const ctx = await brandOfSession();
  if ("error" in ctx) return ctx.error;
  const { admin, brandProfileId } = ctx;

  const body = await request.json().catch(() => ({}));
  const creatorUserId = typeof body?.creator_user_id === "string" ? body.creator_user_id : "";
  if (!creatorUserId) return NextResponse.json({ error: "מזהה יוצר חסר" }, { status: 400 });

  const { data: cp } = await admin.from("creator_profiles").select("id").eq("user_id", creatorUserId).maybeSingle();
  if (!cp) return NextResponse.json({ error: "יוצר/ת לא נמצא/ה" }, { status: 404 });

  const { error } = await (admin.from("brand_passes") as any).upsert(
    { brand_id: brandProfileId, creator_id: (cp as any).id },
    { onConflict: "brand_id,creator_id", ignoreDuplicates: true }
  );
  if (error) {
    console.error("[creators/pass] insert error:", error.message);
    return NextResponse.json({ error: "שגיאה בשמירה" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

// DELETE — forget every skip (the "start over" button in the gallery)
export async function DELETE() {
  const ctx = await brandOfSession();
  if ("error" in ctx) return ctx.error;
  const { admin, brandProfileId } = ctx;

  const { error } = await admin.from("brand_passes").delete().eq("brand_id", brandProfileId);
  if (error) {
    console.error("[creators/pass] delete error:", error.message);
    return NextResponse.json({ error: "שגיאה באיפוס" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
