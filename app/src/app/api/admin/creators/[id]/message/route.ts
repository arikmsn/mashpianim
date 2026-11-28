import { NextResponse, type NextRequest } from "next/server";
import { verifyAdmin, isSupabaseConfigured } from "@/lib/admin-auth";
import { createNotification, logActivity } from "@/lib/notifications";
import { SYSTEM_MESSAGE_TYPE, validateSystemMessage } from "@/lib/system-message";

type Ctx = { params: Promise<{ id: string }> };

// POST { title, body }: the admin sends a one-way system message to one creator (owner, 2026-11-28). It lands in
// the creator's bell as "הודעת מערכת", tagged with the creator role so it shows on the creator side of the
// account; nothing to open, nothing to answer. Audited as admin_system_message.
export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "המערכת לא מוגדרת" }, { status: 503 });
  const { isAdmin, adminId, supabase } = await verifyAdmin();
  if (!isAdmin || !supabase) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const parsed = validateSystemMessage(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { data: user } = await supabase.from("users").select("id, type").eq("id", id).maybeSingle();
  if (!user) return NextResponse.json({ error: "יוצר/ת לא נמצא/ה" }, { status: 404 });
  const { data: profile } = await supabase.from("creator_profiles").select("id").eq("user_id", id).maybeSingle();
  if (!profile && (user as any).type !== "creator") return NextResponse.json({ error: "לחשבון הזה אין פרופיל יוצר/ת" }, { status: 400 });

  await createNotification({
    userId: id,
    type: SYSTEM_MESSAGE_TYPE,
    title: parsed.value.title,
    body: parsed.value.body,
    data: { role: "creator" },
  });
  await logActivity({
    actorId: adminId || undefined,
    action: "admin_system_message",
    entityType: "user",
    entityId: id,
    details: { title: parsed.value.title, length: parsed.value.body.length },
  });
  return NextResponse.json({ success: true });
}
