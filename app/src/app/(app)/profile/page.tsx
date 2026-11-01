"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Avatar, Badge, Button, Card } from "@/components/ui";

const mockProfile = {
  name: "נועה כהן",
  level: "יוצרת+",
  hearts: 42,
  completedVideos: 15,
  rating: 4.8,
  categories: ["ביוטי", "אופנה", "לייפסטייל"],
  bio: "יוצרת תוכן עם אהבה למוצרי טיפוח ואופנה. תמיד מחפשת את המוצר הבא!",
  joinedDate: "ינואר 2026",
  stats: {
    connections: 23,
    videos: 15,
    avgRating: 4.8,
  },
};

const mockVideos = [
  { id: "1", product: "סרום ויטמין C", brand: "GlowUp", status: "approved", views: 1200 },
  { id: "2", product: "שעון ספורט", brand: "TechFit", status: "approved", views: 890 },
  { id: "3", product: "תיק גב", brand: "UrbanStyle", status: "in_review", views: 0 },
];

const milestones = [
  { count: 5, label: "5 סרטונים", achieved: true },
  { count: 10, label: "10 סרטונים", achieved: true },
  { count: 25, label: "25 סרטונים", achieved: false },
  { count: 50, label: "50 סרטונים", achieved: false },
];

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<"videos" | "badges">("videos");

  return (
    <main className="min-h-screen bg-background">
      {/* Profile header */}
      <div className="bg-gradient-to-b from-pink-100 to-background px-4 pt-8 pb-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-start gap-4">
            <Avatar name={mockProfile.name} size="xl" />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-bold">{mockProfile.name}</h1>
                <Badge variant="pink" size="sm">
                  {mockProfile.level}
                </Badge>
              </div>
              <p className="text-sm text-neutral-500 mb-3">{mockProfile.bio}</p>
              <div className="flex items-center gap-1 flex-wrap">
                {mockProfile.categories.map((cat) => (
                  <Badge key={cat} variant="default" size="sm">
                    {cat}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            {[
              { value: mockProfile.stats.connections, label: "חיבורים" },
              { value: mockProfile.stats.videos, label: "סרטונים" },
              { value: mockProfile.stats.avgRating, label: "דירוג" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-xl font-bold text-neutral-900">{stat.value}</div>
                <div className="text-xs text-neutral-500">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Hearts & Level progress */}
          <Card padding="sm" className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                💖 {mockProfile.hearts} לבבות
              </span>
              <span className="text-xs text-neutral-400">
                15/25 סרטונים לרמה הבאה
              </span>
            </div>
            <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-l from-pink-500 to-pink-400 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: "60%" }}
                transition={{ duration: 1, delay: 0.3 }}
              />
            </div>
          </Card>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-2xl mx-auto px-4">
        <div className="flex gap-1 bg-neutral-50 rounded-xl p-1 mt-4 mb-4">
          <button
            onClick={() => setActiveTab("videos")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "videos"
                ? "bg-white text-pink-500 shadow-sm"
                : "text-neutral-500"
            }`}
          >
            הסרטונים שלי
          </button>
          <button
            onClick={() => setActiveTab("badges")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "badges"
                ? "bg-white text-pink-500 shadow-sm"
                : "text-neutral-500"
            }`}
          >
            הישגים
          </button>
        </div>

        {activeTab === "videos" && (
          <div className="space-y-3">
            {mockVideos.map((video) => (
              <Card key={video.id} hover padding="md">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-sm">{video.product}</h3>
                    <p className="text-xs text-neutral-400">{video.brand}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {video.views > 0 && (
                      <span className="text-xs text-neutral-400">
                        👁 {video.views.toLocaleString()}
                      </span>
                    )}
                    <Badge
                      variant={video.status === "approved" ? "success" : "warning"}
                      size="sm"
                    >
                      {video.status === "approved" ? "אושר" : "בבדיקה"}
                    </Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {activeTab === "badges" && (
          <div className="grid grid-cols-2 gap-3">
            {milestones.map((m) => (
              <Card
                key={m.count}
                padding="md"
                className={m.achieved ? "" : "opacity-40"}
              >
                <div className="text-center">
                  <span className="text-3xl block mb-2">
                    {m.achieved ? "🏆" : "🔒"}
                  </span>
                  <p className="text-sm font-medium">{m.label}</p>
                  <p className="text-xs text-neutral-400 mt-1">
                    {m.achieved ? "הושלם!" : "בתהליך"}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Settings button */}
        <div className="mt-6 mb-4">
          <Button variant="ghost" fullWidth>
            ⚙️ הגדרות פרופיל
          </Button>
        </div>
      </div>
    </main>
  );
}
