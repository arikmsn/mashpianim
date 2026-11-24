import { NextResponse, type NextRequest } from "next/server";
import { verifyAdmin, isSupabaseConfigured } from "@/lib/admin-auth";
import { pickAdminProductUpdates } from "@/lib/admin-products";
import { logActivity } from "@/lib/notifications";
import { closeWaitingHearts } from "@/lib/product-removal";
import { toDirectImageUrl } from "@/lib/images";
import { briefDataLines } from "@/lib/brief";

// One product for the admin (owner, 2026-11-24): every field, the business behind it, who hearted it and what
// came of it; the admin edits the product's fields (PATCH), pauses / re-activates it, or removes it (DELETE:
// like the business's own delete, the waiting hearts are closed and the creators told).

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "המערכת לא מוגדרת" }, { status: 503 });
  const { isAdmin, supabase } = await verifyAdmin();
  if (!isAdmin || !supabase) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const { data: product, error } = await supabase
    .from("products")
    .select("*, brand_profiles(id, shop_name, logo_url, user_id, region, users(id, full_name, phone, is_active))")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[admin/products] detail error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת המוצר" }, { status: 500 });
  }
  if (!product) return NextResponse.json({ error: "מוצר לא נמצא" }, { status: 404 });

  const { data: conns } = await supabase
    .from("connections")
    .select("id, status, initiated_by, mutual_at, created_at, approved_at, completed_at, rejection_reason, creator_profiles!connections_creator_id_fkey(id, users(id, full_name, phone))")
    .eq("product_id", id)
    .order("created_at", { ascending: false });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = product as any;
  const brand = p.brand_profiles || {};
  const owner = brand.users || {};
  const row = { ...p };
  delete row.brand_profiles;

  return NextResponse.json(
    {
      product: { ...row, image_url: row.image_url || null, image_preview: toDirectImageUrl(row.image_url || null, 800), brief_lines: briefDataLines(row.brief_data || null, row.brief || null) },
      brand: {
        id: brand.id || p.brand_id,
        user_id: owner.id || brand.user_id || null,
        name: brand.shop_name || owner.full_name || "",
        contact: owner.full_name || "",
        phone: owner.phone || "",
        is_active: owner.is_active !== false,
        region: brand.region || null,
        logo_url: brand.logo_url || null,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      connections: ((conns || []) as any[]).map((c) => ({
        id: c.id,
        status: c.status,
        initiated_by: c.initiated_by,
        mutual_at: c.mutual_at,
        created_at: c.created_at,
        approved_at: c.approved_at,
        completed_at: c.completed_at,
        rejection_reason: c.rejection_reason,
        creator: {
          user_id: c.creator_profiles?.users?.id || null,
          name: (c.creator_profiles?.users?.full_name || "").trim() || "יוצר/ת",
          phone: c.creator_profiles?.users?.phone || "",
        },
      })),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "המערכת לא מוגדרת" }, { status: 503 });
  const { isAdmin, adminId, supabase } = await verifyAdmin();
  if (!isAdmin || !supabase) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const updates = pickAdminProductUpdates(body);
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "אין שדות תקינים לעדכון" }, { status: 400 });

  const { data: before } = await supabase.from("products").select("id, status").eq("id", id).maybeSingle();
  if (!before) return NextResponse.json({ error: "מוצר לא נמצא" }, { status: 404 });
  if ((before as { status?: string }).status === "deleted") return NextResponse.json({ error: "מוצר שהוסר לא נערך; אפשר להפעיל אותו מחדש בלבד" }, { status: 409 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("products") as any).update(updates).eq("id", id);
  if (error) {
    if (["22P02", "23502", "23514"].includes((error as { code?: string }).code || "")) return NextResponse.json({ error: "ערך לא תקין באחד השדות" }, { status: 400 });
    console.error("[admin/products] update error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון" }, { status: 500 });
  }
  await logActivity({ actorId: adminId || undefined, action: "admin_update_product", entityType: "product", entityId: id, details: { fields: Object.keys(updates) } });
  return NextResponse.json({ success: true, updated: Object.keys(updates) });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "המערכת לא מוגדרת" }, { status: 503 });
  const { isAdmin, adminId, supabase } = await verifyAdmin();
  if (!isAdmin || !supabase) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const { data: before } = await supabase.from("products").select("id, status, name").eq("id", id).maybeSingle();
  if (!before) return NextResponse.json({ error: "מוצר לא נמצא" }, { status: 404 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("products") as any).update({ status: "deleted" }).eq("id", id);
  if (error) {
    console.error("[admin/products] delete error:", error);
    return NextResponse.json({ error: "שגיאה בהסרה" }, { status: 500 });
  }
  const closed = await closeWaitingHearts(supabase, id);
  await logActivity({ actorId: adminId || undefined, action: "admin_remove_product", entityType: "product", entityId: id, details: { name: (before as { name?: string }).name, hearts_closed: closed } });
  return NextResponse.json({ success: true, hearts_closed: closed });
}
