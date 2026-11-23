import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { verifyAdmin, isSupabaseConfigured } from "@/lib/admin-auth";
import { logActivity } from "@/lib/notifications";
import { SITE_CONTENT_DEFAULTS } from "@/lib/site-content";

// "עדכון מהמערכת" on the stats section of /admin/content: fills the creators and videos numbers from real counts
// and saves them (the page always shows the saved values, never a live query).
export async function POST() {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "המערכת לא מוגדרת" }, { status: 503 });
  const { isAdmin, adminId, supabase } = await verifyAdmin();
  if (!isAdmin || !supabase) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const [creatorsRes, videosRes, existing] = await Promise.all([
    supabase.from("users").select("id", { count: "exact", head: true }).eq("type", "creator").eq("is_active", true),
    // Portfolio videos (the ones businesses browse); deliverables live on a connection
    supabase.from("videos").select("id", { count: "exact", head: true }).is("connection_id", null),
    supabase.from("site_content").select("data").eq("id", "home_stats").maybeSingle(),
  ]);
  if (creatorsRes.error || videosRes.error) {
    return NextResponse.json({ error: "לא הצלחנו לספור" }, { status: 500 });
  }
  const prev = ((existing.data as { data?: Record<string, unknown> } | null)?.data || {}) as Record<string, unknown>;
  // The creators number never drops below the value on the page (the owner shows "500+" until the real count
  // passes it); the videos number is always the real count
  const shownCreators = typeof prev.stat1_value === "string" ? prev.stat1_value : SITE_CONTENT_DEFAULTS.home_stats.stat1_value;
  const floor = Number(shownCreators.replace(/\D/g, "")) || 0;
  const creators = String(Math.max(creatorsRes.count || 0, floor));
  const videos = String(videosRes.count || 0);
  const data = { ...prev, stat1_value: creators, stat2_value: videos };

  const { error } = await supabase
    .from("site_content")
    .upsert({ id: "home_stats", data, updated_at: new Date().toISOString(), updated_by: adminId } as any, { onConflict: "id" });
  if (error) {
    console.error("[admin/content/stats] upsert error:", error);
    return NextResponse.json({ error: "שגיאה בשמירה" }, { status: 500 });
  }

  await logActivity({ actorId: adminId || undefined, action: "admin_update_content", entityType: "site_content", entityId: "home_stats", details: { from: "system", creators, videos } });
  try {
    revalidatePath("/");
  } catch (err) {
    console.error("[admin/content/stats] revalidate:", err);
  }
  return NextResponse.json({ success: true, stat1_value: creators, stat2_value: videos });
}
