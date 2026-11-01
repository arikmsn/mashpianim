"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Avatar, Badge } from "@/components/ui";

const mockConversations = [
  {
    id: "1",
    name: "GlowUp Skincare",
    lastMessage: "שלחנו את המוצר, צפוי להגיע תוך 3 ימים 📦",
    time: "לפני 2 שעות",
    unread: 2,
    product: "סרום ויטמין C",
  },
  {
    id: "2",
    name: "TechFit",
    lastMessage: "הסרטון נראה מעולה! רק תיקון קטן בסוף...",
    time: "לפני 5 שעות",
    unread: 0,
    product: "שעון ספורט חכם",
  },
  {
    id: "3",
    name: "UrbanStyle",
    lastMessage: "מתי תוכלו לצלם את הסרטון?",
    time: "אתמול",
    unread: 1,
    product: "תיק גב עור טבעוני",
  },
  {
    id: "4",
    name: "מערכת",
    lastMessage: "ברוכים הבאים ל-Mashpianim! 🎉",
    time: "לפני 3 ימים",
    unread: 0,
    product: null,
  },
];

export default function MessagesPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-neutral-100">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">הודעות</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto">
        {mockConversations.map((conv) => (
          <motion.button
            key={conv.id}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-pink-50/50 transition-colors border-b border-neutral-50 text-right"
            onClick={() => setSelectedId(conv.id)}
            whileTap={{ scale: 0.98 }}
          >
            <div className="relative">
              <Avatar name={conv.name} size="md" />
              {conv.unread > 0 && (
                <span className="absolute -top-0.5 -left-0.5 w-4 h-4 rounded-full bg-pink-500 text-white text-[9px] flex items-center justify-center font-bold ring-2 ring-white">
                  {conv.unread}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className={`font-medium text-sm ${conv.unread > 0 ? "text-neutral-900" : "text-neutral-600"}`}>
                  {conv.name}
                </span>
                <span className="text-xs text-neutral-400">{conv.time}</span>
              </div>
              {conv.product && (
                <span className="text-xs text-pink-500 block mb-0.5">{conv.product}</span>
              )}
              <p className={`text-sm truncate ${conv.unread > 0 ? "text-neutral-700 font-medium" : "text-neutral-400"}`}>
                {conv.lastMessage}
              </p>
            </div>
          </motion.button>
        ))}
      </div>

      {selectedId && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-100">
            <button
              onClick={() => setSelectedId(null)}
              className="p-2 -mr-2 rounded-lg hover:bg-neutral-100"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
            <Avatar
              name={mockConversations.find((c) => c.id === selectedId)?.name || ""}
              size="sm"
            />
            <div>
              <p className="font-medium text-sm">
                {mockConversations.find((c) => c.id === selectedId)?.name}
              </p>
              <p className="text-xs text-pink-500">
                {mockConversations.find((c) => c.id === selectedId)?.product}
              </p>
            </div>
          </header>

          <div className="flex-1 flex items-center justify-center text-neutral-400 text-sm">
            <div className="text-center">
              <span className="text-4xl block mb-3">💬</span>
              <p>ההודעות יוצגו כאן</p>
              <p className="text-xs mt-1">כל התקשורת עוברת דרך הפלטפורמה</p>
            </div>
          </div>

          <div className="p-4 border-t border-neutral-100">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="כתבו הודעה..."
                className="flex-1 px-4 py-2.5 rounded-xl bg-neutral-50 border border-neutral-100 text-sm outline-none focus:border-pink-300"
              />
              <button className="px-4 py-2.5 rounded-xl bg-pink-500 text-white text-sm font-medium">
                שלחו
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
