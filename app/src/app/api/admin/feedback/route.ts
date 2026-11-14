import { NextResponse, type NextRequest } from "next/server";
import { verifyAdmin, isSupabaseConfigured } from "@/lib/admin-auth";
import { createNotification, logActivity } from "@/lib/notifications";
import {
  isFeedbackStatus,
  FEEDBACK_STATUS_LABELS,
  buildThread,
  isThreadsNotReadyError,
  statusAfterReply,
  validateReplyText,
  type FeedbackStatus,
  type ThreadMessage,
} from "@/lib/feedback";

// Admin view of in-app reports. `?status=open` (default) = new + in_progress; `?status=new|in_progress|closed|all`.
// Each row carries its `thread` (the report, our replies, the user's follow-ups — migration 020); the list is
// ordered by the last word in the thread so a user's new answer surfaces.
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
  const rows = (data || []) as any[];

  let threadsAvailable = true;
  const byFeedback: Record<string, ThreadMessage[]> = {};
  if (rows.length > 0) {
    const { data: msgs, error: mErr } = await supabase
      .from("feedback_messages")
      .select("id, feedback_id, from_admin, text, created_at")
      .in("feedback_id", rows.map((r) => r.id))
      .order("created_at", { ascending: true });
    if (mErr) {
      threadsAvailable = false;
      if (!isThreadsNotReadyError(mErr)) console.error("[admin/feedback] threads:", mErr.message);
    } else {
      for (const m of (msgs || []) as any[]) {
        (byFeedback[m.feedback_id] ||= []).push({ id: m.id, from_admin: !!m.from_admin, text: m.text, created_at: m.created_at });
      }
    }
  }

  const list = rows.map((r) => ({
    ...r,
    last_message_at: r.last_message_at ?? null,
    last_message_from: r.last_message_from ?? null,
    thread: buildThread(r, byFeedback[r.id] || []),
  }));
  list.sort((a, b) => (Date.parse(b.last_message_at || b.created_at) || 0) - (Date.parse(a.last_message_at || a.created_at) || 0));

  const { count } = await supabase.from("feedback").select("id", { count: "exact", head: true }).eq("status", "new");
  return NextResponse.json({ feedback: list, newCount: count || 0, threads_available: threadsAvailable });
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

// POST { id, text } — our reply in the thread (owner list 2026-11-14, item 6). The report moves to "בטיפול"
// (a closed one reopens), the user gets a notification that opens the thread.
export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "המערכת לא מוגדרת" }, { status: 503 });
  const { isAdmin, adminId, supabase } = await verifyAdmin();
  if (!isAdmin || !supabase || !adminId) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { id?: string; text?: unknown } | null;
  if (!body?.id) return NextResponse.json({ error: "מזהה פנייה חסר" }, { status: 400 });
  const check = validateReplyText(body.text);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  const { data: before } = await supabase.from("feedback").select("id, user_id, status, subject").eq("id", body.id).maybeSingle();
  if (!before) return NextResponse.json({ error: "פנייה לא נמצאה" }, { status: 404 });

  const { data: message, error } = await supabase
    .from("feedback_messages")
    .insert({ feedback_id: body.id, sender_id: adminId, from_admin: true, text: check.text } as any)
    .select("id, from_admin, text, created_at")
    .single();
  if (error || !message) {
    if (isThreadsNotReadyError(error)) {
      return NextResponse.json({ error: "התגובות בשרשור יופעלו אחרי הפעלת מיגרציה 020 — בינתיים אפשר לשנות סטטוס" }, { status: 503 });
    }
    console.error("[admin/feedback] reply insert:", error?.message);
    return NextResponse.json({ error: "שגיאה בשליחת התגובה" }, { status: 500 });
  }

  const now = new Date().toISOString();
  const status = statusAfterReply((before as any).status as FeedbackStatus, "admin");
  const { error: upErr } = await supabase
    .from("feedback")
    .update({ status, last_message_at: now, last_message_from: "admin", updated_at: now } as any)
    .eq("id", body.id);
  if (upErr) console.error("[admin/feedback] reply status update:", upErr.message);

  if ((before as any).user_id) {
    await createNotification({
      userId: (before as any).user_id,
      type: "feedback_reply",
      title: `💬 תשובה לפנייה "${(before as any).subject}"`,
      body: check.text.slice(0, 140),
      data: { feedbackId: body.id },
    });
  }
  await logActivity({ actorId: adminId, action: "admin_reply_feedback", entityType: "feedback", entityId: body.id });

  return NextResponse.json({ message, status }, { status: 201 });
}
