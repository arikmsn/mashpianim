import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/admin-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      connection: { id, status: "pending", product_name: "מוצר לדוגמה" },
    });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("connections")
    .select(`
      *,
      products(name, image_url, price, description),
      creator:users!connections_creator_id_fkey(full_name, avatar_url, phone),
      brand:users!connections_brand_id_fkey(full_name, avatar_url)
    `)
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "חיבור לא נמצא" }, { status: 404 });
  }

  return NextResponse.json({ connection: data });
}

const validTransitions: Record<string, string[]> = {
  pending: ["approved", "rejected"],
  approved: ["shipped", "cancelled"],
  shipped: ["filming"],
  filming: ["uploaded"],
  uploaded: ["in_review"],
  in_review: ["completed", "revision_requested"],
  revision_requested: ["uploaded"],
};

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

  const { data: connection } = await supabase
    .from("connections")
    .select("*, products(brand_id, brand_profiles(user_id))")
    .eq("id", id)
    .single();

  if (!connection) {
    return NextResponse.json({ error: "חיבור לא נמצא" }, { status: 404 });
  }

  const body = await request.json();
  const { status: newStatus, rejection_reason, revision_notes } = body;

  if (!newStatus) {
    return NextResponse.json({ error: "סטטוס חסר" }, { status: 400 });
  }

  const allowed = validTransitions[connection.status];
  if (!allowed || !allowed.includes(newStatus)) {
    return NextResponse.json(
      { error: `לא ניתן לעבור מ-${connection.status} ל-${newStatus}` },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = { status: newStatus };

  if (newStatus === "approved") updates.approved_at = new Date().toISOString();
  if (newStatus === "shipped") updates.shipped_at = new Date().toISOString();
  if (newStatus === "filming") updates.filmed_at = new Date().toISOString();
  if (newStatus === "completed") updates.completed_at = new Date().toISOString();
  if (newStatus === "rejected" && rejection_reason) updates.rejection_reason = rejection_reason;
  if (newStatus === "revision_requested" && revision_notes) updates.revision_notes = revision_notes;

  if (newStatus === "approved") {
    const now = new Date();
    updates.ship_deadline = new Date(now.getTime() + 7 * 86400000).toISOString();
  }
  if (newStatus === "shipped") {
    const now = new Date();
    updates.film_deadline = new Date(now.getTime() + 10 * 86400000).toISOString();
  }
  if (newStatus === "in_review") {
    const now = new Date();
    updates.review_deadline = new Date(now.getTime() + 7 * 86400000).toISOString();
  }

  const { error } = await supabase
    .from("connections")
    .update(updates)
    .eq("id", id);

  if (error) {
    console.error("[connections] update error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון" }, { status: 500 });
  }

  return NextResponse.json({ success: true, status: newStatus });
}
