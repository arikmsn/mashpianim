"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Badge, Avatar, Card } from "@/components/ui";

type TabType = "active" | "pending" | "completed";

const tabs: { key: TabType; label: string; count: number }[] = [
  { key: "active", label: "פעילים", count: 3 },
  { key: "pending", label: "ממתינים", count: 2 },
  { key: "completed", label: "הושלמו", count: 5 },
];

const statusConfig = {
  shipped: { label: "נשלח", variant: "info" as const, icon: "📦" },
  filming: { label: "בצילום", variant: "warning" as const, icon: "🎬" },
  review: { label: "בבדיקה", variant: "purple" as const, icon: "👀" },
  pending: { label: "ממתין לאישור", variant: "default" as const, icon: "⏳" },
  approved: { label: "אושר", variant: "success" as const, icon: "✓" },
  completed: { label: "הושלם", variant: "success" as const, icon: "🎉" },
};

const mockConnections = [
  {
    id: "1",
    product: "סרום ויטמין C",
    brand: "GlowUp Skincare",
    status: "filming" as const,
    daysLeft: 7,
    tab: "active" as const,
  },
  {
    id: "2",
    product: "שעון ספורט חכם",
    brand: "TechFit",
    status: "shipped" as const,
    daysLeft: 5,
    tab: "active" as const,
  },
  {
    id: "3",
    product: "תיק גב עור טבעוני",
    brand: "UrbanStyle",
    status: "review" as const,
    daysLeft: 3,
    tab: "active" as const,
  },
  {
    id: "4",
    product: "ערכת בישול שף",
    brand: "ChefHome",
    status: "pending" as const,
    daysLeft: null,
    tab: "pending" as const,
  },
  {
    id: "5",
    product: "סט יוגה פרימיום",
    brand: "ZenLife",
    status: "pending" as const,
    daysLeft: null,
    tab: "pending" as const,
  },
  {
    id: "6",
    product: "מנורת לד דקורטיבית",
    brand: "LightHouse",
    status: "completed" as const,
    daysLeft: null,
    tab: "completed" as const,
  },
];

export default function ConnectionsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("active");
  const filtered = mockConnections.filter((c) => c.tab === activeTab);

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-neutral-100">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold mb-4">החיבורים שלי</h1>
          <div className="flex gap-1 bg-neutral-50 rounded-xl p-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.key
                    ? "bg-white text-pink-500 shadow-sm"
                    : "text-neutral-500 hover:text-neutral-700"
                }`}
              >
                {tab.label}
                <span className="mr-1 text-xs opacity-60">({tab.count})</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {filtered.map((conn) => {
          const status = statusConfig[conn.status];
          return (
            <motion.div
              key={conn.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card hover padding="md">
                <div className="flex items-center gap-4">
                  <Avatar name={conn.brand} size="lg" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-neutral-900 truncate">
                      {conn.product}
                    </h3>
                    <p className="text-sm text-neutral-500">{conn.brand}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant={status.variant} size="sm" dot>
                        {status.label}
                      </Badge>
                      {conn.daysLeft !== null && (
                        <span className="text-xs text-neutral-400">
                          {conn.daysLeft} ימים נותרו
                        </span>
                      )}
                    </div>
                  </div>
                  <svg
                    className="text-neutral-300 flex-shrink-0"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </div>
              </Card>
            </motion.div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-20 text-neutral-400">
            <span className="text-4xl block mb-4">📭</span>
            <p>אין חיבורים בקטגוריה זו</p>
          </div>
        )}
      </div>
    </main>
  );
}
