import { NextResponse, type NextRequest } from "next/server";
import { verifyAdmin, isSupabaseConfigured } from "@/lib/admin-auth";
import { logActivity } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

// Path inside the public `thumbnails` bucket, from the public URL the app stores
function thumbnailPath(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = "/object/public/thumbnails/";
  const i = url.indexOf(marker);
  return i >= 0 ? decodeURIComponent(url.slice(i + marker.length)) : null;
}

// DELETE /api/admin/users/[id] — removes a registration completely (owner, 2026-11-15: a creator who signed up
// as a business by mistake registers again with the same phone). Never an admin, never yourself.
// Rows that point at the user without a cascade (the audit log's actor, videos an admin approved, a chat an
// admin blocked) are detached first; the user's own videos and their files go; everything else cascades
// (profiles, products, connections, messages, notifications, orders). The auth user goes last, so the phone
// can sign up fresh. Reports the user sent stay (feedback.user_id → null).
export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "המערכת לא מוגדרת" }, { status: 503 });
  const { isAdmin, adminId, supabase } = await verifyAdmin();
  if (!isAdmin || !supabase || !adminId) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const { data: raw } = await supabase.from("users").select("id, type, is_admin, full_name, phone, auth_user_id").eq("id", id).maybeSingle();
  const u = raw as any;
  if (!u) return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });
  if (u.type === "admin" || u.is_admin === true || u.id === adminId) {
    return NextResponse.json({ error: "אי אפשר למחוק חשבון מנהל" }, { status: 403 });
  }

  // Files of the user's videos (portfolio and deliverables) — best effort, the rows go either way
  const { data: videos } = await supabase.from("videos").select("storage_path, thumbnail_url").eq("creator_id", id);
  const videoPaths = ((videos || []) as any[]).map((v) => v.storage_path).filter((p): p is string => typeof p === "string" && p.length > 0);
  const thumbPaths = ((videos || []) as any[]).map((v) => thumbnailPath(v.thumbnail_url)).filter((p): p is string => !!p);
  if (videoPaths.length > 0) {
    const { error } = await supabase.storage.from("videos").remove(videoPaths);
    if (error) console.error("[admin/users] video files:", error.message);
  }
  if (thumbPaths.length > 0) {
    const { error } = await supabase.storage.from("thumbnails").remove(thumbPaths);
    if (error) console.error("[admin/users] thumbnails:", error.message);
  }

  // Detach what references the user without a cascade, then the rows that are theirs
  await supabase.from("activity_log").update({ actor_id: null } as any).eq("actor_id", id);
  await supabase.from("videos").update({ approved_by: null } as any).eq("approved_by", id);
  await supabase.from("connections").update({ blocked_by: null } as any).eq("blocked_by", id);
  await supabase.from("videos").delete().eq("creator_id", id);
  if (u.phone) await supabase.from("otp_codes").delete().eq("phone", u.phone);

  const { error } = await supabase.from("users").delete().eq("id", id);
  if (error) {
    console.error("[admin/users] delete:", error.message);
    return NextResponse.json({ error: `המחיקה נכשלה: ${error.message}` }, { status: 500 });
  }
  if (u.auth_user_id) {
    const { error: authErr } = await supabase.auth.admin.deleteUser(u.auth_user_id);
    if (authErr && !/not found/i.test(authErr.message)) console.error("[admin/users] auth delete:", authErr.message);
  }

  await logActivity({
    actorId: adminId,
    action: "admin_delete_user",
    entityType: "user",
    entityId: id,
    details: { full_name: u.full_name, phone: u.phone, type: u.type, videos: videoPaths.length },
  });
  return NextResponse.json({ success: true });
}
