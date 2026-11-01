"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, Badge, Button, Card, CardTitle, Modal } from "@/components/ui";

type ModerationStatus = "pending" | "approved" | "rejected";

const mockQueue = [
  {
    id: "1",
    creator: "נועה כהן",
    product: "סרום ויטמין C",
    brand: "GlowUp Skincare",
    uploadedAgo: "32 דקות",
    status: "pending" as ModerationStatus,
    flags: [],
    duration: "0:45",
  },
  {
    id: "2",
    creator: "דנה לוי",
    product: "שעון ספורט חכם",
    brand: "TechFit",
    uploadedAgo: "שעה",
    status: "pending" as ModerationStatus,
    flags: ["זוהה טקסט חשוד"],
    duration: "1:12",
  },
  {
    id: "3",
    creator: "שרה אברהם",
    product: "סט יוגה פרימיום",
    brand: "ZenLife",
    uploadedAgo: "2 שעות",
    status: "pending" as ModerationStatus,
    flags: [],
    duration: "0:58",
  },
  {
    id: "4",
    creator: "רותם בן דוד",
    product: "מנורת לד",
    brand: "LightHouse",
    uploadedAgo: "3 שעות",
    status: "rejected" as ModerationStatus,
    flags: ["הפנייה לאינסטגרם", "מספר טלפון"],
    duration: "1:30",
  },
  {
    id: "5",
    creator: "יעל שפירא",
    product: "תיק גב עור",
    brand: "UrbanStyle",
    uploadedAgo: "4 שעות",
    status: "approved" as ModerationStatus,
    flags: [],
    duration: "0:55",
  },
];

const chatFlags = [
  { id: "1", from: "דנה לוי", to: "TechFit", message: "אפשר לדבר ב...", flagType: "ניסיון שיתוף פרטי קשר", time: "לפני שעה", blocked: true },
  { id: "2", from: "מיכל דוד", to: "ChefHome", message: "הנה המספר שלי 05...", flagType: "מספר טלפון", time: "לפני 3 שעות", blocked: true },
];

export default function AdminModerationPage() {
  const [tab, setTab] = useState<"videos" | "chat">("videos");
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [items, setItems] = useState(mockQueue);

  const pendingCount = items.filter((i) => i.status === "pending").length;

  function handleApprove(id: string) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: "approved" as ModerationStatus } : i))
    );
  }

  function handleReject(id: string) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: "rejected" as ModerationStatus } : i))
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">מודרציה</h1>
          <p className="text-neutral-500 text-sm mt-1">בדיקת תכנים ושמירה על בטיחות הפלטפורמה</p>
        </div>
        <Badge variant="warning" size="lg" dot>
          {pendingCount} ממתינים
        </Badge>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-neutral-100 rounded-xl p-1 mb-6 w-fit">
        <button
          onClick={() => setTab("videos")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "videos" ? "bg-white shadow-sm text-pink-500" : "text-neutral-500"
          }`}
        >
          🎬 סרטונים ({items.filter((i) => i.status === "pending").length})
        </button>
        <button
          onClick={() => setTab("chat")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "chat" ? "bg-white shadow-sm text-pink-500" : "text-neutral-500"
          }`}
        >
          💬 הודעות חסומות ({chatFlags.length})
        </button>
      </div>

      {tab === "videos" && (
        <div className="space-y-3">
          <AnimatePresence>
            {items.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
              >
                <Card padding="md">
                  <div className="flex items-center gap-4">
                    {/* Video placeholder */}
                    <div className="w-24 h-16 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-400 text-xs flex-shrink-0">
                      🎬 {item.duration}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{item.product}</p>
                        {item.flags.length > 0 && (
                          <Badge variant="danger" size="sm">
                            ⚠ {item.flags.length} התרעות
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-neutral-400">
                        {item.creator} → {item.brand} • לפני {item.uploadedAgo}
                      </p>
                      {item.flags.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {item.flags.map((flag, i) => (
                            <Badge key={i} variant="danger" size="sm">
                              {flag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {item.status === "pending" ? (
                        <>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setSelectedVideo(item.id)}
                          >
                            צפייה
                          </Button>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleApprove(item.id)}
                          >
                            אישור
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleReject(item.id)}
                          >
                            דחייה
                          </Button>
                        </>
                      ) : (
                        <Badge
                          variant={item.status === "approved" ? "success" : "danger"}
                          size="md"
                        >
                          {item.status === "approved" ? "✓ אושר" : "✗ נדחה"}
                        </Badge>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {tab === "chat" && (
        <div className="space-y-3">
          {chatFlags.map((flag) => (
            <Card key={flag.id} padding="md">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500">
                  🛡️
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="danger" size="sm">{flag.flagType}</Badge>
                    <span className="text-xs text-neutral-400">{flag.time}</span>
                  </div>
                  <p className="text-sm">
                    <span className="font-medium">{flag.from}</span>
                    <span className="text-neutral-400"> → </span>
                    <span className="font-medium">{flag.to}</span>
                  </p>
                  <p className="text-sm text-neutral-500 mt-1 bg-neutral-50 px-3 py-1.5 rounded-lg">
                    &quot;{flag.message}&quot;
                  </p>
                </div>
                <Badge variant={flag.blocked ? "success" : "danger"} size="sm" dot>
                  {flag.blocked ? "נחסם" : "פעיל"}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!selectedVideo}
        onClose={() => setSelectedVideo(null)}
        title="צפייה בסרטון"
        size="lg"
      >
        <div className="aspect-[9/16] max-h-[60vh] bg-neutral-900 rounded-xl flex items-center justify-center text-white/50 mx-auto w-fit">
          <div className="text-center px-12">
            <span className="text-5xl block mb-4">🎬</span>
            <p>נגן וידאו יופעל כאן</p>
            <p className="text-sm mt-2">כולל OCR אוטומטי וזיהוי דיבור</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
