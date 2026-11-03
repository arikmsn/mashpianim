import { NextResponse, type NextRequest } from "next/server";
import { verifyAdmin, isSupabaseConfigured } from "@/lib/admin-auth";
import { createNotification, logActivity } from "@/lib/notifications";
import { isFeedbackStatus, FEEDBACK_STATUS_LABELS } from "@/lib/feedback";

// Admin view of in-app reports. `?status=open` (default) = new + in_progress; `?status=new|in_progress|closed|all`
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.json({ feedback: [] });
  const { isAdmin, supabase } = await verifyAdmin();
  if (!isAdmin || !supabase) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const status = new URL(request.url).searchParams.get("status") || "open";
  let query = supabase
    .from("feedback")
    .select("*, users(full_name, type, phone)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status === "open") query = query.in("status", ["new", "in_progress"]);
  else if (isFeedbackStatus(status)) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    console.error("[admin/feedback] list error:", error);
    return NextResponse.json({ error: "שגיאה בטעינה" }, { status: 500 });
  }

  const { count } = await supabase.from("feedback").select("id", { count: "exact", head: true }).eq("status", "new");
  return NextResponse.json({ feedback: data || [], newCount: count || 0 });
}

// Status / note update; the reporter is told when the status changes
export async function PUT(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "המערכת לא מוגדרת" }, { status: 503 });
  const { isAdmin, adminId, supabase } = await verifyAdmin();
  if (!isAdmin || !supabase) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { id?: string; status?: unknown; admin_note?: unknown } | null;
  if (!body?.id) return NextResponse.json({ error: "מזהה פנייה חסר" }, { status: 400 });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.status !== undefined) {
    if (!isFeedbackStatus(body.status)) return NextResponse.json({ error: "סטטוס לא תקין" }, { status: 400 });
    updates.status = body.status;
  }
  if (body.admin_note !== undefined) {
    updates.admin_note = typeof body.admin_note === "string" ? body.admin_note.trim().slice(0, 2000) || null : null;
  }
  if (Object.keys(updates).length === 1) return NextResponse.json({ error: "אין מה לעדכן" }, { status: 400 });

  const { data: before } = await supabase.from("feedback").select("id, user_id, status, subject").eq("id", body.id).maybeSingle();
  if (!before) return NextResponse.json({ error: "פנייה לא נמצאה" }, { status: 404 });

  const { error } = await supabase.from("feedback").update(updates as any).eq("id", body.id);
  if (error) {
    console.error("[admin/feedback] update error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון" }, { status: 500 });
  }

  const statusChanged = typeof updates.status === "string" && updates.status !== (before as any).status;
  if (statusChanged && (before as any).user_id) {
    const label = FEEDBACK_STATUS_LABELS[updates.status as keyof typeof FEEDBACK_STATUS_LABELS];
    const note = typeof updates.admin_note === "string" ? ` — ${updates.admin_note.slice(0, 120)}` : "";
    await createNotification({
      userId: (before as any).user_id,
      type: "feedback_updated",
      title: `הפנייה "${(before as any).subject}" ${label === "סגור" ? "נסגרה" : label === "בטיפול" ? "בטיפול" : "עודכנה"}`,
      body: `סטטוס: ${label}${note}`,
      data: { feedbackId: body.id },
    });
  }

  await logActivity({
    actorId: adminId || undefined,
    action: "admin_update_feedback",
    entityType: "feedback",
    entityId: body.id,
    details: updates,
  });

  return NextResponse.json({ success: true });
}
