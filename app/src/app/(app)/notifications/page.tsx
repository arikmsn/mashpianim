"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useNotifications, type AppNotification } from "@/hooks/use-notifications";
import { notificationHref, type ViewerRole } from "@/lib/notification-links";
import { readCache, swrFetch } from "@/lib/client-cache";

const typeIcons: Record<string, string> = {
  heart_received: "💗",
  match: "🎉",
  heart_declined: "💔",
  heart_withdrawn: "↩️",
  heart_expired: "⌛",
  connection_approved: "🤝",
  connection_rejected: "❌",
  connection_cancelled: "🚫",
  connection_auto_cancelled: "🚫",
  product_shipped: "📦",
  product_delivered: "📬",
  video_uploaded: "🎬",
  video_ready_for_review: "🎬",
  revision_requested: "📝",
  connection_completed: "✅",
  video_approved: "✅",
  video_revision: "📝",
  shipping_deadline_warning: "⏰",
  filming_deadline_warning: "⏰",
  review_deadline_warning: "⏰",
  portfolio_video_removed: "⚠️",
  new_message: "💬",
  system: "🔔",
};

const typeColors: Record<string, string> = {
  heart_received: "bg-pink-50 text-pink-500",
  match: "bg-emerald-50 text-emerald-600",
  connection_approved: "bg-green-50 text-green-600",
  connection_completed: "bg-emerald-50 text-emerald-600",
  video_approved: "bg-emerald-50 text-emerald-600",
  product_shipped: "bg-blue-50 text-blue-600",
  product_delivered: "bg-blue-50 text-blue-600",
  video_uploaded: "bg-purple-50 text-purple-600",
  video_ready_for_review: "bg-purple-50 text-purple-600",
  revision_requested: "bg-amber-50 text-amber-600",
  video_revision: "bg-amber-50 text-amber-600",
  shipping_deadline_warning: "bg-amber-50 text-amber-600",
  filming_deadline_warning: "bg-amber-50 text-amber-600",
  review_deadline_warning: "bg-amber-50 text-amber-600",
  connection_rejected: "bg-red-50 text-red-500",
  heart_declined: "bg-red-50 text-red-500",
  connection_cancelled: "bg-neutral-100 text-neutral-500",
  connection_auto_cancelled: "bg-neutral-100 text-neutral-500",
  portfolio_video_removed: "bg-red-50 text-red-500",
  new_message: "bg-pink-50 text-pink-500",
  system: "bg-neutral-50 text-neutral-500",
};

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "עכשיו";
  if (diffMins < 60) return `לפני ${diffMins} דקות`;
  if (diffHours < 24) return `לפני ${diffHours} שעות`;
  if (diffDays === 1) return "אתמול";
  return `לפני ${diffDays} ימים`;
}

export default function NotificationsPage() {
  const { notifications, loaded, markAsRead, markAllRead } = useNotifications();
  const router = useRouter();
  const [role, setRole] = useState<ViewerRole>(
    () => (readCache<{ user?: { type?: string } }>("/api/profile")?.user?.type as ViewerRole) || null
  );
  // Rows that were unread when the screen opened keep their highlight for this visit, even though
  // opening the screen marks everything as read (that is what clears the bell badge everywhere)
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const markedRef = useRef(false);

  useEffect(() => {
    swrFetch<{ user?: { type?: string } }>("/api/profile", (data) => {
      if (data.user?.type) setRole(data.user.type as ViewerRole);
    });
  }, []);

  useEffect(() => {
    if (!loaded || markedRef.current) return;
    markedRef.current = true;
    const unread = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unread.length === 0) return;
    const t = setTimeout(() => {
      setNewIds(new Set(unread));
      markAllRead();
    }, 0);
    return () => clearTimeout(t);
  }, [loaded, notifications, markAllRead]);

  function open(n: AppNotification) {
    if (!n.read) markAsRead(n.id);
    const href = notificationHref(n, role);
    if (href) router.push(href);
  }

  const backHref = role === "brand" ? "/brand" : "/feed";

  return (
    <main className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-neutral-100">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">התראות</h1>
          <Link
            href={backHref}
            className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
            aria-label="חזרה"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Link>
        </div>
      </header>

      <div className="max-w-2xl mx-auto">
        {!loaded && notifications.length === 0 ? (
          <div className="px-4 py-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-neutral-100" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-3.5 bg-neutral-100 rounded w-1/2" />
                  <div className="h-3 bg-neutral-100 rounded w-5/6" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-20 text-neutral-400">
            <span className="text-4xl block mb-4">🔔</span>
            <p>אין התראות עדיין</p>
          </div>
        ) : (
          notifications.map((notification, index) => {
            const isNew = newIds.has(notification.id) || !notification.read;
            const href = notificationHref(notification, role);
            return (
              <motion.button
                key={notification.id}
                type="button"
                className={`w-full flex items-start gap-3 px-4 py-4 border-b border-neutral-50 text-right transition-colors active:bg-neutral-50 ${
                  isNew ? "bg-pink-50/40" : "bg-white"
                }`}
                onClick={() => open(notification)}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index, 8) * 0.03 }}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    typeColors[notification.type] || "bg-neutral-50 text-neutral-500"
                  }`}
                >
                  <span className="text-lg">{typeIcons[notification.type] || "🔔"}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={`font-medium text-sm ${isNew ? "text-neutral-900" : "text-neutral-600"}`}>
                      {notification.title}
                    </span>
                    <span className="text-xs text-neutral-400 flex-shrink-0 mr-2">{formatTime(notification.created_at)}</span>
                  </div>
                  <p className={`text-sm ${isNew ? "text-neutral-600" : "text-neutral-400"}`}>{notification.body}</p>
                  {href && <p className="text-[11px] text-pink-500 mt-1">פתיחה ›</p>}
                </div>
                {isNew && <div className="w-2.5 h-2.5 rounded-full bg-pink-500 flex-shrink-0 mt-2" />}
              </motion.button>
            );
          })
        )}
      </div>
    </main>
  );
}
