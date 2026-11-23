import { NextResponse, type NextRequest } from "next/server";
import { verifyAdmin, isSupabaseConfigured } from "@/lib/admin-auth";
import { logActivity } from "@/lib/notifications";
import { isLeadStatus } from "@/lib/influencer-leads";

// Status and admin note of one influencer lead (/admin/leads)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "המערכת לא מוגדרת" }, { status: 503 });
  const { isAdmin, adminId, supabase } = await verifyAdmin();
  if (!isAdmin || !supabase) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { status?: unknown; admin_note?: unknown } | null;
  const patch: Record<string, unknown> = {};
  if (body && "status" in body) {
    if (!isLeadStatus(body.status)) return NextResponse.json({ error: "סטטוס לא תקין" }, { status: 400 });
    patch.status = body.status;
  }
  if (body && "admin_note" in body) {
    patch.admin_note = typeof body.admin_note === "string" ? body.admin_note.trim().slice(0, 2000) || null : null;
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: "אין מה לעדכן" }, { status: 400 });
  patch.handled_by = adminId;
  patch.handled_at = new Date().toISOString();

  const { data, error } = await supabase.from("influencer_leads").update(patch as any).eq("id", id).select("id, status, admin_note, handled_at").single();
  if (error || !data) return NextResponse.json({ error: "שגיאה בעדכון" }, { status: 500 });

  await logActivity({ actorId: adminId || undefined, action: "admin_update_lead", entityType: "influencer_lead", entityId: id, details: patch });
  return NextResponse.json({ success: true, lead: data });
}
