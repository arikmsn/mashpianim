"use client";

import { useState } from "react";
import { Avatar, Badge, Button, Card } from "@/components/ui";

const mockCreators = [
  { id: "1", name: "נועה כהן", level: "יוצרת+", status: "active", videos: 15, rating: 4.8, hearts: 42, joined: "ינואר 2026", categories: ["ביוטי", "אופנה"] },
  { id: "2", name: "דנה לוי", level: "יוצרת", status: "active", videos: 7, rating: 4.5, hearts: 18, joined: "מרץ 2026", categories: ["טכנולוגיה"] },
  { id: "3", name: "שרה אברהם", level: "על הרדאר", status: "active", videos: 28, rating: 4.9, hearts: 85, joined: "דצמבר 2025", categories: ["ספורט", "לייפסטייל"] },
  { id: "4", name: "מיכל דוד", level: "יוצרת", status: "suspended", videos: 3, rating: 3.2, hearts: 5, joined: "יוני 2026", categories: ["אוכל"] },
  { id: "5", name: "תמר רוזן", level: "יוצרת+", status: "active", videos: 12, rating: 4.6, hearts: 35, joined: "פברואר 2026", categories: ["ביוטי", "בית וגינה"] },
];

const levelColors: Record<string, "pink" | "purple" | "success"> = {
  "יוצרת": "pink",
  "יוצרת+": "purple",
  "על הרדאר": "success",
};

export default function AdminCreatorsPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "suspended">("all");

  const filtered = mockCreators.filter((c) => {
    if (filter !== "all" && c.status !== filter) return false;
    if (search && !c.name.includes(search)) return false;
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">ניהול יוצרים</h1>
          <p className="text-neutral-500 text-sm mt-1">{mockCreators.length} יוצרים רשומים</p>
        </div>
      </div>

      <Card padding="md" className="mb-6">
        <div className="flex items-center gap-4">
          <input
            type="text"
            placeholder="חיפוש לפי שם..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-xl bg-neutral-50 border border-neutral-100 text-sm outline-none focus:border-pink-300"
          />
          <div className="flex gap-1 bg-neutral-50 rounded-lg p-0.5">
            {(["all", "active", "suspended"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  filter === f ? "bg-white shadow-sm text-pink-500" : "text-neutral-500"
                }`}
              >
                {f === "all" ? "הכל" : f === "active" ? "פעילים" : "מושעים"}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <div className="bg-white rounded-2xl border border-neutral-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-100 text-right">
              <th className="px-4 py-3 text-xs font-medium text-neutral-400">יוצר/ת</th>
              <th className="px-4 py-3 text-xs font-medium text-neutral-400">רמה</th>
              <th className="px-4 py-3 text-xs font-medium text-neutral-400">סטטוס</th>
              <th className="px-4 py-3 text-xs font-medium text-neutral-400">סרטונים</th>
              <th className="px-4 py-3 text-xs font-medium text-neutral-400">דירוג</th>
              <th className="px-4 py-3 text-xs font-medium text-neutral-400">לבבות</th>
              <th className="px-4 py-3 text-xs font-medium text-neutral-400">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((creator) => (
              <tr key={creator.id} className="border-b border-neutral-50 hover:bg-pink-50/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={creator.name} size="sm" />
                    <div>
                      <p className="text-sm font-medium">{creator.name}</p>
                      <p className="text-xs text-neutral-400">{creator.categories.join(", ")}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={levelColors[creator.level] || "default"} size="sm">
                    {creator.level}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant={creator.status === "active" ? "success" : "danger"}
                    size="sm"
                    dot
                  >
                    {creator.status === "active" ? "פעיל" : "מושעה"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-sm">{creator.videos}</td>
                <td className="px-4 py-3 text-sm">⭐ {creator.rating}</td>
                <td className="px-4 py-3 text-sm">💖 {creator.hearts}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button className="px-2.5 py-1 rounded-lg text-xs bg-neutral-50 hover:bg-neutral-100 transition-colors">
                      צפייה
                    </button>
                    <button className="px-2.5 py-1 rounded-lg text-xs bg-neutral-50 hover:bg-neutral-100 transition-colors text-red-500">
                      {creator.status === "active" ? "השעיה" : "הפעלה"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
