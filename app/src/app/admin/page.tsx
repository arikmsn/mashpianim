"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardTitle, Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import { formatBytes, type CapacityStatus, type CapacityGauge, type PlatformUsage } from "@/lib/capacity";

type StatItem = { label: string; value: string; change: string; trend: string; icon: string };
type Capacity = CapacityStatus & { usage: PlatformUsage };

const gaugeTone: Record<CapacityGauge["level"], { bar: string; text: string; label: string }> = {
  ok: { bar: "bg-emerald-500", text: "text-emerald-700", label: "תקין" },
  warn: { bar: "bg-amber-500", text: "text-amber-700", label: "מתקרב למגבלה" },
  critical: { bar: "bg-red-500", text: "text-red-700", label: "כמעט מלא" },
};

function GaugeRow({ title, gauge }: { title: string; gauge: CapacityGauge }) {
  const tone = gaugeTone[gauge.level];
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-neutral-700">{title}</span>
        <span className={cn("text-xs font-medium", tone.text)}>
          {formatBytes(gauge.used)} מתוך {formatBytes(gauge.limit)} · {Math.round(gauge.ratio * 100)}% · {tone.label}
        </span>
      </div>
      <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", tone.bar)} style={{ width: `${Math.min(100, Math.round(gauge.ratio * 100))}%` }} />
      </div>
    </div>
  );
}
type ActivityItem = { type: string; text: string; time: string };
type ModerationItem = { id: string; creator: string; product: string; brand: string; uploadedAgo: string };


const activityIcons: Record<string, string> = {
  creator_join: "👤",
  video_upload: "📤",
  brand_join: "🏪",
  connection: "🔗",
  payment: "💳",
  moderation: "🛡️",
  video_approved: "✅",
};


function StatSkeleton() {
  return (
    <Card padding="md">
      <div className="animate-pulse">
        <div className="h-4 bg-neutral-200 rounded w-24 mb-3" />
        <div className="h-7 bg-neutral-200 rounded w-16" />
      </div>
    </Card>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<StatItem[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [pendingModeration, setPendingModeration] = useState<ModerationItem[]>([]);
  const [capacity, setCapacity] = useState<Capacity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/admin/stats");
        if (!res.ok) throw new Error("API error");
        const data = await res.json();
        if (data.stats && !Array.isArray(data.stats)) {
          const s = data.stats;
          setStats([
            { label: "יוצרים רשומים", value: String(s.creators_count ?? 0), change: "", trend: "up", icon: "👤" },
            { label: "עסקים פעילים", value: String(s.brands_count ?? 0), change: "", trend: "up", icon: "🏪" },
            { label: "חיבורים פעילים", value: String(s.active_connections ?? 0), change: "", trend: "up", icon: "🔗" },
            { label: "סרטונים ממתינים", value: String(s.pending_videos ?? 0), change: "", trend: "down", icon: "🎬" },
            { label: "הכנסות החודש", value: `₪${(s.monthly_revenue ?? 0).toLocaleString()}`, change: "", trend: "up", icon: "💰" },
            { label: "פניות שנמכרו", value: String(s.credits_sold ?? 0), change: "", trend: "up", icon: "🎫" },
          ]);
        } else if (Array.isArray(data.stats)) {
          setStats(data.stats);
        }
        if (data.recentActivity) setRecentActivity(data.recentActivity);
        if (data.pendingModeration) setPendingModeration(data.pendingModeration);
        setCapacity(data.capacity || null);
      } catch {
        // API unavailable
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">דשבורד</h1>
          <p className="text-neutral-500 text-sm mt-1">סקירה כללית של הפלטפורמה</p>
        </div>
        <Badge variant="success" size="lg" dot>מערכת פעילה</Badge>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <StatSkeleton key={i} />)
          : stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card padding="md">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-neutral-500">{stat.label}</p>
                      <p className="text-2xl font-bold mt-1">{stat.value}</p>
                    </div>
                    <span className="text-2xl">{stat.icon}</span>
                  </div>
                  <div className="mt-2">
                    <span
                      className={cn(
                        "text-xs font-medium",
                        stat.trend === "up" ? "text-emerald-500" : "text-red-500"
                      )}
                    >
                      {stat.change}
                    </span>
                    <span className="text-xs text-neutral-400 mr-1">מהשבוע שעבר</span>
                  </div>
                </Card>
              </motion.div>
            ))}
      </div>

      {/* Supabase capacity: the same numbers the daily cron watches (lib/capacity.ts) */}
      {!loading && (
        <Card padding="md" className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <CardTitle>קיבולת Supabase{capacity ? ` (תוכנית ${capacity.planLabel})` : ""}</CardTitle>
            {capacity && (
              <Badge variant={capacity.level === "ok" ? "success" : capacity.level === "warn" ? "warning" : "danger"} size="sm" dot>
                {gaugeTone[capacity.level].label}
              </Badge>
            )}
          </div>
          {capacity ? (
            <div className="space-y-4">
              <GaugeRow title="אחסון קבצים (סרטונים ותמונות)" gauge={capacity.storage} />
              <GaugeRow title="מסד נתונים" gauge={capacity.db} />
              {capacity.message && (
                <p className={cn("text-sm rounded-xl px-3 py-2", capacity.level === "critical" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700")}>
                  {capacity.message}
                </p>
              )}
              <p className="text-xs text-neutral-400">
                {capacity.usage.storage_objects ?? 0} קבצים, מתוכם סרטונים {formatBytes(capacity.usage.videos_bytes ?? 0)}. התראה לפעמון נשלחת אוטומטית מ-70%.
                תעבורה (egress) לא נמדדת כאן — רק בדשבורד של Supabase.
              </p>
            </div>
          ) : (
            <p className="text-sm text-neutral-400">המדידה לא זמינה — הפונקציה platform_usage() (מיגרציה 014) עדיין לא הופעלה במסד הנתונים.</p>
          )}
        </Card>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Recent activity */}
        <Card padding="md">
          <CardTitle className="mb-4">פעילות אחרונה</CardTitle>
          <div className="space-y-3">
            {recentActivity.length === 0 ? (
              <p className="text-sm text-neutral-400 text-center py-8">אין פעילות אחרונה</p>
            ) : (
              recentActivity.map((item, i) => (
                <div key={i} className="flex items-start gap-3 py-2 border-b border-neutral-50 last:border-0">
                  <span className="text-lg">{activityIcons[item.type] || "📋"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-neutral-700">{item.text}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">{item.time}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Pending moderation */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <CardTitle>סרטונים ממתינים למודרציה</CardTitle>
            <Badge variant="warning" size="sm">{pendingModeration.length} ממתינים</Badge>
          </div>
          <div className="space-y-3">
            {pendingModeration.length === 0 ? (
              <p className="text-sm text-neutral-400 text-center py-8">אין סרטונים ממתינים</p>
            ) : (
              pendingModeration.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2 border-b border-neutral-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{item.product}</p>
                    <p className="text-xs text-neutral-400">{item.creator} • {item.brand}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-400">לפני {item.uploadedAgo}</span>
                    <button className="px-3 py-1.5 rounded-lg bg-pink-50 text-pink-500 text-xs font-medium hover:bg-pink-100 transition-colors">
                      בדקו
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
