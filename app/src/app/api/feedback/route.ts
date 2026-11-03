import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/admin-auth";
import { createNotification, logActivity } from "@/lib/notifications";
import { validateFeedback, FEEDBACK_KIND_LABELS } from "@/lib/feedback";
import { checkRateLimit, rateLimitedResponse, RATE_LIMITS } from "@/lib/rate-limit";

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
  const { data } = await admin
    .from("users")
    .select("id, full_name, type")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  return (data as { id: string; full_name: string | null; type: string } | null) || null;
}

// The signed-in user's own reports (newest first)
export async function GET() {
  if (!isSupabaseConfigured()) return NextResponse.json({ feedback: [] });
  const me = await currentUser();
  const admin = getSupabaseAdmin();
  if (!me || !admin) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const { data, error } = await admin
    .from("feedback")
    .select("id, kind, subject, message, status, admin_note, created_at, updated_at")
    .eq("user_id", me.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error("[feedback] list error:", error);
    return NextResponse.json({ error: "שגיאה בטעינה" }, { status: 500 });
  }
  return NextResponse.json({ feedback: data || [] });
}

// New report: validated, rate limited per user, stored via the service role, admins notified
export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "המערכת לא מוגדרת" }, { status: 503 });
  const me = await currentUser();
  const admin = getSupabaseAdmin();
  if (!me || !admin) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const check = validateFeedback(body);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  const limit = await checkRateLimit(admin, "feedback:user", me.id, RATE_LIMITS.feedbackUser);
  if (!limit.allowed) return rateLimitedResponse(limit);

  const { data: row, error } = await admin
    .from("feedback")
    .insert({
      user_id: me.id,
      kind: check.value.kind,
      subject: check.value.subject,
      message: check.value.message,
      page: check.value.page,
      user_agent: (request.headers.get("user-agent") || "").slice(0, 300) || null,
    } as any)
    .select("id, kind, subject, message, status, admin_note, created_at, updated_at")
    .single();
  if (error || !row) {
    console.error("[feedback] insert error:", error);
    return NextResponse.json({ error: "שגיאה בשליחת הפנייה" }, { status: 500 });
  }

  // Every admin gets a bell notification that links to /admin/feedback
  const { data: admins } = await admin.from("users").select("id").eq("type", "admin");
  const kindLabel = FEEDBACK_KIND_LABELS[check.value.kind];
  await Promise.all(
    ((admins || []) as { id: string }[]).map((a) =>
      createNotification({
        userId: a.id,
        type: "feedback_received",
        title: `📨 ${kindLabel}: ${check.value.subject}`,
        body: `${me.full_name || "משתמש/ת"} (${me.type === "brand" ? "עסק" : me.type === "creator" ? "יוצר/ת" : me.type}): ${check.value.message.slice(0, 140)}`,
        data: { feedbackId: (row as any).id, role: "admin" },
      })
    )
  );

  await logActivity({
    actorId: me.id,
    action: "feedback_created",
    entityType: "feedback",
    entityId: (row as any).id,
    details: { kind: check.value.kind, page: check.value.page },
  });

  return NextResponse.json({ feedback: row }, { status: 201 });
}
