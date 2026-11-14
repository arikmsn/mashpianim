"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Avatar, Badge, Card, useToast } from "@/components/ui";
import { displayName, formatFollowers, lastSeenLabel, matchesSearch } from "@/lib/admin-creators";

// What /api/admin/creators returns per creator
type Creator = {
  id: string;
  name: string;
  phone: string;
  is_active: boolean;
  is_admin: boolean;
  avatar_url: string | null;
  created_at: string;
  last_seen_at: string | null;
  level: string;
  categories: string[];
  city: string | null;
  tiktok_handle: string | null;
  instagram_handle: string | null;
  tiktok_followers: number;
  instagram_followers: number;
  videos_portfolio: number;
  videos_removed: number;
  videos_collab: number;
  hearts_from_brands: number;
  matches: number;
};

// Creators list (owner list, 2026-11-14). The previous screen expected other field names than the API sent —
// the name was empty, everyone showed as suspended and typing in the search crashed on a missing value. The
// rows are now mapped 1:1 from the API, and the search is null-safe.
export default function AdminCreatorsPage() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "suspended">("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/admin/creators")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("API error"))))
      .then((data) => setCreators((data.creators || []) as Creator[]))
      .catch(() => toast("שגיאה בטעינת היוצרים", "error"))
      .finally(() => setLoading(false));
  }, [toast]);

  async function toggleActive(c: Creator) {
    const next = !c.is_active;
    if (!next && !window.confirm(`להשעות את ${displayName(c.name, c.phone)}? היא/הוא לא יוכלו להיכנס למערכת עד שתפעילו מחדש.`)) return;
    setBusy(c.id);
    try {
      const res = await fetch("/api/admin/creators", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: c.id, is_active: next }),
      });
      if (!res.ok) throw new Error("API error");
      setCreators((prev) => prev.map((x) => (x.id === c.id ? { ...x, is_active: next } : x)));
      toast(next ? `${displayName(c.name, c.phone)} הופעל/ה מחדש` : `${displayName(c.name, c.phone)} הושעה`, "success");
    } catch {
      toast("שגיאה בעדכון הסטטוס", "error");
    } finally {
      setBusy(null);
    }
  }

  const filtered = creators.filter((c) => {
    if (filter === "active" && !c.is_active) return false;
    if (filter === "suspended" && c.is_active) return false;
    return matchesSearch(c, search);
  });

  const counts = { all: creators.length, active: creators.filter((c) => c.is_active).length, suspended: creators.filter((c) => !c.is_active).length };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">יוצרים</h1>
          <p className="text-neutral-500 text-sm mt-1">
            {counts.all} יוצרים · {counts.active} פעילים · {counts.suspended} מושעים
          </p>
        </div>
      </div>

      <Card padding="md" className="mb-6">
        <div className="flex items-center gap-4">
          <input
            type="text"
            placeholder="חיפוש לפי שם או טלפון..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-xl bg-neutral-50 border border-neutral-100 text-sm outline-none focus:border-pink-300"
          />
          <div className="flex gap-1 bg-neutral-50 rounded-lg p-0.5">
            {(["all", "active", "suspended"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filter === f ? "bg-white shadow-sm text-pink-500" : "text-neutral-500"}`}
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
        <div className="bg-white rounded-2xl border border-neutral-100 overflow-x-auto">
          <table className="w-full min-w-[960px]">
            <thead>
              <tr className="border-b border-neutral-100 text-right">
                <th className="px-4 py-3 text-xs font-medium text-neutral-400">יוצר/ת</th>
                <th className="px-4 py-3 text-xs font-medium text-neutral-400">עוקבים</th>
                <th className="px-4 py-3 text-xs font-medium text-neutral-400">סטטוס</th>
                <th className="px-4 py-3 text-xs font-medium text-neutral-400">סרטונים</th>
                <th className="px-4 py-3 text-xs font-medium text-neutral-400">לבבות מעסקים</th>
                <th className="px-4 py-3 text-xs font-medium text-neutral-400">מאטצ&apos;ים</th>
                <th className="px-4 py-3 text-xs font-medium text-neutral-400">כניסה אחרונה</th>
                <th className="px-4 py-3 text-xs font-medium text-neutral-400">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const name = displayName(c.name, c.phone);
                return (
                  <tr key={c.id} className="border-b border-neutral-50 hover:bg-pink-50/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/admin/creators/${c.id}`} className="flex items-center gap-3 group">
                        <Avatar src={c.avatar_url} name={name} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium group-hover:text-pink-600 truncate">
                            {name}
                            {c.is_admin && <span className="mr-2 text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">מנהל/ת</span>}
                          </p>
                          <p className="text-xs text-neutral-400" dir="ltr">{c.phone}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-700 whitespace-nowrap">
                      <div>📸 {formatFollowers(c.instagram_followers)}</div>
                      <div>🎵 {formatFollowers(c.tiktok_followers)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={c.is_active ? "success" : "danger"} size="sm" dot>
                        {c.is_active ? "פעיל/ה" : "מושעה"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-700 whitespace-nowrap">
                      <div>תיק: <b>{c.videos_portfolio}</b>{c.videos_removed > 0 && <span className="text-neutral-400"> (+{c.videos_removed} הוסרו)</span>}</div>
                      <div>שת&quot;פ: <b>{c.videos_collab}</b></div>
                    </td>
                    <td className="px-4 py-3 text-sm">💗 {c.hearts_from_brands}</td>
                    <td className="px-4 py-3 text-sm">🤝 {c.matches}</td>
                    <td className="px-4 py-3 text-xs text-neutral-600 whitespace-nowrap" title={c.last_seen_at || ""}>
                      {lastSeenLabel(c.last_seen_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Link href={`/admin/creators/${c.id}`} className="px-2.5 py-1 rounded-lg text-xs bg-neutral-50 hover:bg-neutral-100 transition-colors">
                          פרטים וסרטונים
                        </Link>
                        <button
                          onClick={() => toggleActive(c)}
                          disabled={busy === c.id}
                          className={`px-2.5 py-1 rounded-lg text-xs bg-neutral-50 hover:bg-neutral-100 transition-colors disabled:opacity-50 ${c.is_active ? "text-red-500" : "text-emerald-600"}`}
                        >
                          {busy === c.id ? "..." : c.is_active ? "השעיה" : "הפעלה"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-neutral-400 text-sm">
                    לא נמצאו יוצרים
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
