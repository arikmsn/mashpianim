"use client";

import { useState, useEffect } from "react";
import { Avatar, Badge, Button, Card, Modal, useToast } from "@/components/ui";

type Creator = {
  id: string;
  name: string;
  level: string;
  status: string;
  videos: number;
  rating: number;
  hearts: number;
  joined: string;
  categories: string[];
  bio?: string;
  tiktokHandle?: string;
  instagramHandle?: string;
  city?: string;
  phone?: string;
};

const levelColors: Record<string, "pink" | "purple" | "success"> = {
  "יוצרת": "pink",
  "יוצרת+": "purple",
  "על הרדאר": "success",
};

export default function AdminCreatorsPage() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "suspended">("all");
  const [loading, setLoading] = useState(true);
  const [selectedCreator, setSelectedCreator] = useState<Creator | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchCreators() {
      try {
        const res = await fetch("/api/admin/creators");
        if (!res.ok) throw new Error("API error");
        const data = await res.json();
        setCreators(data.creators || []);
      } catch {
        // API unavailable
      } finally {
        setLoading(false);
      }
    }
    fetchCreators();
  }, []);

  async function handleToggleStatus(creator: Creator) {
    const newAction = creator.status === "active" ? "suspend" : "activate";
    setActionLoading(creator.id);
    try {
      const res = await fetch("/api/admin/creators", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: creator.id, action: newAction }),
      });
      if (!res.ok) throw new Error("API error");
      setCreators((prev) =>
        prev.map((c) =>
          c.id === creator.id
            ? { ...c, status: newAction === "suspend" ? "suspended" : "active" }
            : c
        )
      );
      toast(
        newAction === "suspend" ? `${creator.name} הושעה` : `${creator.name} הופעל/ה מחדש`,
        "success"
      );
    } catch {
      toast("שגיאה בעדכון הסטטוס", "error");
    } finally {
      setActionLoading(null);
    }
  }

  const filtered = creators.filter((c) => {
    if (filter !== "all" && c.status !== filter) return false;
    if (search && !c.name.includes(search)) return false;
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">ניהול יוצרים</h1>
          <p className="text-neutral-500 text-sm mt-1">{creators.length} יוצרים רשומים</p>
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

      {loading ? (
        <div className="bg-white rounded-2xl border border-neutral-100 p-8">
          <div className="animate-pulse space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-neutral-200" />
                <div className="flex-1">
                  <div className="h-4 bg-neutral-200 rounded w-32 mb-2" />
                  <div className="h-3 bg-neutral-100 rounded w-20" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
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
                      <button
                        onClick={() => setSelectedCreator(creator)}
                        className="px-2.5 py-1 rounded-lg text-xs bg-neutral-50 hover:bg-neutral-100 transition-colors"
                      >
                        צפייה
                      </button>
                      <button
                        onClick={() => handleToggleStatus(creator)}
                        disabled={actionLoading === creator.id}
                        className="px-2.5 py-1 rounded-lg text-xs bg-neutral-50 hover:bg-neutral-100 transition-colors text-red-500 disabled:opacity-50"
                      >
                        {actionLoading === creator.id
                          ? "..."
                          : creator.status === "active"
                          ? "השעיה"
                          : "הפעלה"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-neutral-400 text-sm">
                    לא נמצאו יוצרים
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={!!selectedCreator}
        onClose={() => setSelectedCreator(null)}
        title={selectedCreator?.name || "פרטי יוצר/ת"}
        size="md"
      >
        {selectedCreator && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar name={selectedCreator.name} size="lg" />
              <div>
                <h3 className="text-lg font-bold">{selectedCreator.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={levelColors[selectedCreator.level] || "default"} size="sm">
                    {selectedCreator.level}
                  </Badge>
                  <Badge
                    variant={selectedCreator.status === "active" ? "success" : "danger"}
                    size="sm"
                    dot
                  >
                    {selectedCreator.status === "active" ? "פעיל" : "מושעה"}
                  </Badge>
                </div>
              </div>
            </div>

            {selectedCreator.bio && (
              <p className="text-sm text-neutral-600 bg-neutral-50 rounded-xl p-3">
                {selectedCreator.bio}
              </p>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-neutral-50 rounded-xl">
                <p className="text-lg font-bold">{selectedCreator.videos}</p>
                <p className="text-xs text-neutral-500">סרטונים</p>
              </div>
              <div className="text-center p-3 bg-neutral-50 rounded-xl">
                <p className="text-lg font-bold">⭐ {selectedCreator.rating}</p>
                <p className="text-xs text-neutral-500">דירוג</p>
              </div>
              <div className="text-center p-3 bg-neutral-50 rounded-xl">
                <p className="text-lg font-bold">💖 {selectedCreator.hearts}</p>
                <p className="text-xs text-neutral-500">לבבות</p>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-neutral-50">
                <span className="text-neutral-500">קטגוריות</span>
                <span className="font-medium">{selectedCreator.categories.join(", ")}</span>
              </div>
              {selectedCreator.city && (
                <div className="flex justify-between py-2 border-b border-neutral-50">
                  <span className="text-neutral-500">עיר</span>
                  <span className="font-medium">{selectedCreator.city}</span>
                </div>
              )}
              {selectedCreator.tiktokHandle && (
                <div className="flex justify-between py-2 border-b border-neutral-50">
                  <span className="text-neutral-500">TikTok</span>
                  <span className="font-medium" dir="ltr">{selectedCreator.tiktokHandle}</span>
                </div>
              )}
              {selectedCreator.instagramHandle && (
                <div className="flex justify-between py-2 border-b border-neutral-50">
                  <span className="text-neutral-500">Instagram</span>
                  <span className="font-medium" dir="ltr">{selectedCreator.instagramHandle}</span>
                </div>
              )}
              <div className="flex justify-between py-2">
                <span className="text-neutral-500">הצטרף/ה</span>
                <span className="font-medium">{selectedCreator.joined}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant={selectedCreator.status === "active" ? "danger" : "primary"}
                size="sm"
                onClick={() => {
                  handleToggleStatus(selectedCreator);
                  setSelectedCreator(null);
                }}
              >
                {selectedCreator.status === "active" ? "השעיית יוצר/ת" : "הפעלת יוצר/ת"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedCreator(null)}>
                סגירה
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
