import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/admin-auth";
import { createNotification, logActivity } from "@/lib/notifications";
import { buildThread, isThreadsNotReadyError, statusAfterReply, validateReplyText, type FeedbackStatus, type ThreadMessage } from "@/lib/feedback";
import { checkRateLimit, rateLimitedResponse, RATE_LIMITS } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

function getSupabaseAdmin() {
  const url = process.env.NEXT_SUPABASE_URL;
  const key = process.env.SUPABASE_SEC_KEY;
  if (!url || !key) return null;
  return createSupabaseClient(url, key);
}

async function currentUser(): Promise<{ id: string; full_name: string | null; type: string } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data } = await admin.from("users").select("id, full_name, type").eq("auth_user_id", user.id).maybeSingle();
  return (data as { id: string; full_name: string | null; type: string } | null) || null;
}

// One of the signed-in user's own reports as a thread: the report, our replies, their follow-ups
// (owner list 2026-11-14, item 6). Without migration 020 the thread is the report (+ a legacy note) only.
export async function GET(_request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "המערכת לא מוגדרת" }, { status: 503 });
  const me = await currentUser();
  const admin = getSupabaseAdmin();
  if (!me || !admin) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const { data: feedback } = await admin.from("feedback").select("*").eq("id", id).eq("user_id", me.id).maybeSingle();
  if (!feedback) return NextResponse.json({ error: "פנייה לא נמצאה" }, { status: 404 });

  const { data: replies, error } = await admin
    .from("feedback_messages")
    .select("id, from_admin, text, created_at")
    .eq("feedback_id", id)
    .order("created_at", { ascending: true });
  const threadsAvailable = !error;
  if (error && !isThreadsNotReadyError(error)) console.error("[feedback/:id] replies:", error.message);

  return NextResponse.json({
    feedback,
    messages: buildThread(feedback as any, ((replies || []) as ThreadMessage[])),
    threads_available: threadsAvailable,
  });
}

// The user's follow-up on their own report: stored as a thread message, the report reopens if it was closed,
// admins are told. Rate limited with new reports (5 / hour).
export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "המערכת לא מוגדרת" }, { status: 503 });
  const me = await currentUser();
  const admin = getSupabaseAdmin();
  if (!me || !admin) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const check = validateReplyText((body as { text?: unknown } | null)?.text);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  const { data: feedback } = await admin.from("feedback").select("id, user_id, status, subject").eq("id", id).eq("user_id", me.id).maybeSingle();
  if (!feedback) return NextResponse.json({ error: "פנייה לא נמצאה" }, { status: 404 });

  const limit = await checkRateLimit(admin, "feedback:user", me.id, RATE_LIMITS.feedbackUser);
  if (!limit.allowed) return rateLimitedResponse(limit);

  const { data: message, error } = await admin
    .from("feedback_messages")
    .insert({ feedback_id: id, sender_id: me.id, from_admin: false, text: check.text } as any)
    .select("id, from_admin, text, created_at")
    .single();
  if (error || !message) {
    if (isThreadsNotReadyError(error)) return NextResponse.json({ error: "התגובות עדיין לא זמינות — נסו שוב מאוחר יותר" }, { status: 503 });
    console.error("[feedback/:id] reply insert:", error?.message);
    return NextResponse.json({ error: "שגיאה בשליחת התגובה" }, { status: 500 });
  }

  const now = new Date().toISOString();
  const status = statusAfterReply((feedback as any).status as FeedbackStatus, "user");
  await admin.from("feedback").update({ status, last_message_at: now, last_message_from: "user", updated_at: now } as any).eq("id", id);

  // Every admin (admin-type accounts and the is_admin flag alike) hears about it; the tap opens /admin/feedback
  const { data: admins } = await admin.from("users").select("id").or("type.eq.admin,is_admin.eq.true");
  await Promise.all(
    ((admins || []) as { id: string }[]).map((a) =>
      createNotification({
        userId: a.id,
        type: "feedback_received",
        title: `💬 תגובה בפנייה: ${(feedback as any).subject}`,
        body: `${me.full_name || "משתמש/ת"}: ${check.text.slice(0, 140)}`,
        data: { feedbackId: id, role: "admin" },
      })
    )
  );
  await logActivity({ actorId: me.id, action: "feedback_replied", entityType: "feedback", entityId: id });

  return NextResponse.json({ message, status }, { status: 201 });
}
