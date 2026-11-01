import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/admin-auth";
import { filterContactInfo } from "@/lib/moderation/chat-filter";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "המערכת לא מוגדרת" }, { status: 503 });
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
    return NextResponse.json({ error: "המערכת לא מוגדרת" }, { status: 503 });
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

  const allowed = validTransitions[(connection as any).status];
  if (!allowed || !allowed.includes(newStatus)) {
    return NextResponse.json(
      { error: `לא ניתן לעבור מ-${(connection as any).status} ל-${newStatus}` },
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

  const { error } = await (supabase
    .from("connections") as any)
    .update(updates)
    .eq("id", id);

  if (error) {
    console.error("[connections] update error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון" }, { status: 500 });
  }

  return NextResponse.json({ success: true, status: newStatus });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json();
  const { text } = body;

  if (!text || typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "הודעה ריקה" }, { status: 400 });
  }

  const moderation = filterContactInfo(text.trim());
  if (moderation.blocked) {
    return NextResponse.json(
      { error: moderation.reason },
      { status: 400 }
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "המערכת לא מוגדרת" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  const { data: userData } = await supabase
    .from("users")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!userData) {
    return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });
  }

  const { data: message, error } = await (supabase
    .from("messages") as any)
    .insert({
      connection_id: id,
      sender_id: (userData as any).id,
      text: text.trim(),
      is_system: false,
    })
    .select()
    .single();

  if (error) {
    console.error("[messages] insert error:", error);
    return NextResponse.json({ error: "שגיאה בשליחת ההודעה" }, { status: 500 });
  }

  return NextResponse.json({ success: true, message });
}
