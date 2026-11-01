import { NextResponse } from "next/server";
import { verifyAdmin, isSupabaseConfigured } from "@/lib/admin-auth";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      stats: { creators_count: 0, brands_count: 0, active_connections: 0, pending_videos: 0, monthly_revenue: 0, credits_sold: 0 },
    });
  }

  const { isAdmin, supabase } = await verifyAdmin();
  if (!isAdmin || !supabase) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const [creatorsRes, brandsRes, connectionsRes, videosRes, transactionsRes, creditsRes] =
    await Promise.all([
      supabase.from("users").select("id", { count: "exact", head: true }).eq("type", "creator"),
      supabase.from("users").select("id", { count: "exact", head: true }).eq("type", "brand"),
      supabase
        .from("connections")
        .select("id", { count: "exact", head: true })
        .not("status", "in", '("completed","cancelled","rejected")'),
      supabase
        .from("videos")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("transactions")
        .select("amount")
        .eq("status", "completed")
        .gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
      supabase
        .from("credits")
        .select("total")
        .gte("purchased_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    ]);

  const monthlyRevenue = (transactionsRes.data || []).reduce(
    (sum: number, t: { amount: number }) => sum + (t.amount || 0),
    0
  );
  const creditsSold = (creditsRes.data || []).reduce(
    (sum: number, c: { total: number }) => sum + (c.total || 0),
    0
  );

  return NextResponse.json({
    stats: {
      creators_count: creatorsRes.count || 0,
      brands_count: brandsRes.count || 0,
      active_connections: connectionsRes.count || 0,
      pending_videos: videosRes.count || 0,
      monthly_revenue: monthlyRevenue,
      credits_sold: creditsSold,
    },
  });
}
