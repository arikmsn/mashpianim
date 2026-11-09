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

// GET — the products this creator skipped, newest skip first ("מוצרים שהסרתי"; owner, 2026-11-09). Public
// shape only, no business fields: the skip list reveals nothing the feed would not.
export async function GET() {
  const ctx = await creatorOfSession();
  if ("error" in ctx) return ctx.error;
  const { admin, creatorProfileId } = ctx;

  const { data, error } = await admin
    .from("creator_passes")
    .select("product_id, created_at, products(id, name, image_url, price, category, category_custom, product_type, status)")
    .eq("creator_id", creatorProfileId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[products/pass] list error:", error.message);
    return NextResponse.json({ error: "שגיאה בטעינה" }, { status: 500 });
  }
  const products = ((data || []) as any[])
    .filter((row) => row.products && row.products.status === "active")
    .map((row) => ({
      id: row.products.id,
      name: row.products.name,
      image_url: row.products.image_url,
      price: row.products.price,
      category: row.products.category,
      category_custom: row.products.category_custom,
      product_type: row.products.product_type,
      passed_at: row.created_at,
    }));
  return NextResponse.json({ products });
}

// DELETE — forget a skip (`?product_id=`) so the product returns to the feed, or every skip without it
// ("להחזיר מוצרים שדילגתי עליהם")
export async function DELETE(request: NextRequest) {
  const ctx = await creatorOfSession();
  if ("error" in ctx) return ctx.error;
  const { admin, creatorProfileId } = ctx;

  const productId = request.nextUrl.searchParams.get("product_id");
  let query = admin.from("creator_passes").delete().eq("creator_id", creatorProfileId);
  if (productId) query = query.eq("product_id", productId);
  const { error } = await query;
  if (error) {
    console.error("[products/pass] delete error:", error.message);
    return NextResponse.json({ error: "שגיאה באיפוס" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
