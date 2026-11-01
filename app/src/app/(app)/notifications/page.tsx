"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useNotifications } from "@/hooks/use-notifications";

const typeIcons: Record<string, string> = {
  connection_approved: "🤝",
  connection_rejected: "❌",
  video_approved: "✅",
  video_revision: "📝",
  new_message: "💬",
  system: "🔔",
};

const typeColors: Record<string, string> = {
  connection_approved: "bg-green-50 text-green-600",
  connection_rejected: "bg-red-50 text-red-500",
  video_approved: "bg-emerald-50 text-emerald-600",
  video_revision: "bg-amber-50 text-amber-600",
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
  const { notifications, markAsRead } = useNotifications();

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-neutral-100">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">התראות</h1>
          <Link
            href="/feed"
            className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Link>
        </div>
      </header>

      <div className="max-w-2xl mx-auto">
        {notifications.length === 0 ? (
          <div className="text-center py-20 text-neutral-400">
            <span className="text-4xl block mb-4">🔔</span>
            <p>אין התראות חדשות</p>
          </div>
        ) : (
          notifications.map((notification, index) => (
            <motion.button
              key={notification.id}
              className={`w-full flex items-start gap-3 px-4 py-4 border-b border-neutral-50 text-right transition-colors ${
                notification.read ? "bg-white" : "bg-pink-50/40"
              }`}
              onClick={() => {
                if (!notification.read) markAsRead(notification.id);
              }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  typeColors[notification.type] || "bg-neutral-50 text-neutral-500"
                }`}
              >
                <span className="text-lg">
                  {typeIcons[notification.type] || "🔔"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span
                    className={`font-medium text-sm ${
                      notification.read ? "text-neutral-600" : "text-neutral-900"
                    }`}
                  >
                    {notification.title}
                  </span>
                  <span className="text-xs text-neutral-400 flex-shrink-0 mr-2">
                    {formatTime(notification.created_at)}
                  </span>
                </div>
                <p
                  className={`text-sm ${
                    notification.read ? "text-neutral-400" : "text-neutral-600"
                  }`}
                >
                  {notification.body}
                </p>
              </div>
              {!notification.read && (
                <div className="w-2.5 h-2.5 rounded-full bg-pink-500 flex-shrink-0 mt-2" />
              )}
            </motion.button>
          ))
        )}
      </div>
    </main>
  );
}
