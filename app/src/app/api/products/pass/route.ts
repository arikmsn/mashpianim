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

async function creatorOfSession() {
  const userClient = await createServerClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "לא מחובר" }, { status: 401 }) };
  const admin = getAdmin();
  if (!admin) return { error: NextResponse.json({ error: "Service unavailable" }, { status: 503 }) };
  const viewer = await resolveViewer(admin, user.id, await readActiveRole());
  if (!viewer || viewer.role !== "creator" || !viewer.creatorProfileId) {
    return { error: NextResponse.json({ error: "אין הרשאה" }, { status: 403 }) };
  }
  return { admin, creatorProfileId: viewer.creatorProfileId };
}

// POST { product_id } — the creator skipped this product in the feed ("✕"); it never comes back to their deck
export async function POST(request: NextRequest) {
  const ctx = await creatorOfSession();
  if ("error" in ctx) return ctx.error;
  const { admin, creatorProfileId } = ctx;

  const body = await request.json().catch(() => ({}));
  const productId = typeof body?.product_id === "string" ? body.product_id : "";
  if (!productId) return NextResponse.json({ error: "מזהה מוצר חסר" }, { status: 400 });

  const { error } = await (admin.from("creator_passes") as any).upsert(
    { creator_id: creatorProfileId, product_id: productId },
    { onConflict: "creator_id,product_id", ignoreDuplicates: true }
  );
  if (error) {
    // Unknown product id → foreign key failure reads as a 404 for the caller
    if ((error as { code?: string }).code === "23503") return NextResponse.json({ error: "מוצר לא נמצא" }, { status: 404 });
    console.error("[products/pass] insert error:", error.message);
    return NextResponse.json({ error: "שגיאה בשמירה" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

// DELETE — forget every skip ("להחזיר מוצרים שדילגתי עליהם")
export async function DELETE() {
  const ctx = await creatorOfSession();
  if ("error" in ctx) return ctx.error;
  const { admin, creatorProfileId } = ctx;

  const { error } = await admin.from("creator_passes").delete().eq("creator_id", creatorProfileId);
  if (error) {
    console.error("[products/pass] delete error:", error.message);
    return NextResponse.json({ error: "שגיאה באיפוס" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
