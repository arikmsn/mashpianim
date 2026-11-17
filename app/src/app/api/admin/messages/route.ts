import { NextResponse, type NextRequest } from "next/server";
import { verifyAdmin, isSupabaseConfigured } from "@/lib/admin-auth";
import { isMessageLogMissing } from "@/lib/message-log";
import { bucketCounts, dailySeries, type MessageLogRow } from "@/lib/messaging-stats";
import { digestMode } from "@/lib/digests";

// What the platform sent by SMS / WhatsApp (owner, 2026-11-16): counts for today / 7 days / 30 days, one row
// per day, and the latest sends with their kind. `?days=30` (max 90).
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.json({ available: false, counts: null, daily: [], recent: [] });
  const { isAdmin, supabase } = await verifyAdmin();
  if (!isAdmin || !supabase) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const daysRaw = Number(request.nextUrl.searchParams.get("days") || "30");
  const days = Number.isFinite(daysRaw) ? Math.min(90, Math.max(7, Math.floor(daysRaw))) : 30;
  const now = new Date();
  const since = new Date(now.getTime() - days * 86_400_000).toISOString();

  const [rowsRes, recentRes, lastRunRes] = await Promise.all([
    supabase.from("message_log").select("channel, status, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(20000),
    supabase
      .from("message_log")
      .select("id, channel, kind, phone, status, provider_ref, meta, created_at, users(full_name, type)")
      .order("created_at", { ascending: false })
      .limit(150),
    supabase.from("site_settings").select("data, updated_at").eq("id", "digests_last_run").maybeSingle(),
  ]);
  if (rowsRes.error) {
    if (isMessageLogMissing(rowsRes.error)) return NextResponse.json({ available: false, counts: null, daily: [], recent: [], digests: digestMode() });
    console.error("[admin/messages] rows:", rowsRes.error.message);
    return NextResponse.json({ error: "שגיאה בטעינת יומן ההודעות" }, { status: 500 });
  }
  const rows = (rowsRes.data || []) as MessageLogRow[];
  const recent = ((recentRes.data || []) as any[]).map((r) => ({
    id: r.id,
    channel: r.channel,
    kind: r.kind,
    phone: r.phone,
    status: r.status,
    provider_ref: r.provider_ref || null,
    created_at: r.created_at,
    user_name: r.users?.full_name || null,
    user_type: r.users?.type || null,
    // The digest text is kept in meta so the owner can read what went out (or would go out in dry mode)
    text: typeof r.meta?.text === "string" ? r.meta.text : null,
  }));

  return NextResponse.json({
    available: true,
    counts: bucketCounts(rows, now),
    daily: dailySeries(rows, days, now),
    recent,
    digests: digestMode(),
    last_run: (lastRunRes.data as { data?: unknown } | null)?.data || null,
  });
}
