"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Badge, Card, useToast } from "@/components/ui";
import { applyConnectionFilter, connectionStatusLabel, isAdminConnectionFilter, isMatchedStatus, type AdminConnectionFilter } from "@/lib/admin-connections";
import { formatDateHe } from "@/lib/dates";

type Row = {
  id: string;
  status: string | null;
  initiated_by: string | null;
  mutual_at: string | null;
  created_at: string;
  approved_at: string | null;
  completed_at: string | null;
  blocked_at: string | null;
  blocked_reason: string | null;
  product: { id: string; name: string } | null;
  creator: { user_id: string | null; name: string; phone: string | null };
  brand: { user_id: string | null; name: string; phone: string | null };
  messages: number;
  videos: number;
};

export default function AdminConnectionsPage() {
  return (
    <Suspense>
      <ConnectionsContent />
    </Suspense>
  );
}

// Connections and matches (owner list, 2026-11-14). The dashboard tiles land here with ?filter=.
function ConnectionsContent() {
  const searchParams = useSearchParams();
  const initial = searchParams.get("filter");
  const [filter, setFilter] = useState<AdminConnectionFilter>(isAdminConnectionFilter(initial) ? initial : "matched");
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/admin/connections")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("API error"))))
      .then((data) => setRows((data.connections || []) as Row[]))
      .catch(() => toast("שגיאה בטעינת החיבורים", "error"))
      .finally(() => setLoading(false));
  }, [toast]);

  const q = search.trim().toLowerCase();
  const filtered = applyConnectionFilter(rows, filter).filter((r) =>
    !q || r.creator.name.toLowerCase().includes(q) || r.brand.name.toLowerCase().includes(q) || (r.product?.name || "").toLowerCase().includes(q)
  );
  const counts = {
    all: rows.length,
    matched: rows.filter((r) => isMatchedStatus(r.status)).length,
    active: applyConnectionFilter(rows, "active").length,
    pending: rows.filter((r) => r.status === "pending").length,
    blocked: rows.filter((r) => !!r.blocked_at).length,
  };
  const filters: { key: AdminConnectionFilter; label: string }[] = [
    { key: "matched", label: `מאטצ'ים (${counts.matched})` },
    { key: "active", label: `בתהליך (${counts.active})` },
    { key: "pending", label: `לבבות ממתינים (${counts.pending})` },
    { key: "blocked", label: `חסומים (${counts.blocked})` },
    { key: "all", label: `הכל (${counts.all})` },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">חיבורים ומאטצ&apos;ים</h1>
          <p className="text-neutral-500 text-sm mt-1">כל לב, מאטץ&apos; ושיתוף פעולה בפלטפורמה</p>
        </div>
      </div>

      <Card padding="md" className="mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <input
            type="text"
            placeholder="חיפוש לפי יוצר/ת, עסק או מוצר..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[220px] px-4 py-2.5 rounded-xl bg-neutral-50 border border-neutral-100 text-sm outline-none focus:border-pink-300"
          />
          <div className="flex gap-1 bg-neutral-50 rounded-lg p-0.5 flex-wrap">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filter === f.key ? "bg-white shadow-sm text-pink-500" : "text-neutral-500"}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {loading ? (
        <p className="text-sm text-neutral-400 p-8">טוען...</p>
      ) : (
        <div className="bg-white rounded-2xl border border-neutral-100 overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-neutral-100 text-right">
                <th className="px-4 py-3 text-xs font-medium text-neutral-400">יוצר/ת</th>
                <th className="px-4 py-3 text-xs font-medium text-neutral-400">עסק</th>
                <th className="px-4 py-3 text-xs font-medium text-neutral-400">מוצר</th>
                <th className="px-4 py-3 text-xs font-medium text-neutral-400">סטטוס</th>
                <th className="px-4 py-3 text-xs font-medium text-neutral-400">הודעות / סרטונים</th>
                <th className="px-4 py-3 text-xs font-medium text-neutral-400">נוצר</th>
                <th className="px-4 py-3 text-xs font-medium text-neutral-400"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-neutral-50 hover:bg-pink-50/30 transition-colors">
                  <td className="px-4 py-3 text-sm">
                    {r.creator.user_id ? <Link href={`/admin/creators/${r.creator.user_id}`} className="hover:text-pink-600">{r.creator.name}</Link> : r.creator.name}
                  </td>
                  <td className="px-4 py-3 text-sm">{r.brand.name}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600">{r.product?.name || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={r.blocked_at ? "danger" : isMatchedStatus(r.status) ? (r.status === "completed" ? "default" : "success") : "warning"} size="sm" dot>
                        {connectionStatusLabel(r.status, r.initiated_by, r.mutual_at)}
                      </Badge>
                      {r.blocked_at && <span className="text-[11px] text-red-600">הצ&apos;אט נחסם</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-700">💬 {r.messages} · 🎬 {r.videos}</td>
                  <td className="px-4 py-3 text-xs text-neutral-500 whitespace-nowrap">{formatDateHe(r.created_at)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/connections/${r.id}`} className="px-2.5 py-1 rounded-lg text-xs bg-neutral-50 hover:bg-neutral-100 transition-colors whitespace-nowrap">
                      צ&apos;אט וקבצים ›
                    </Link>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-neutral-400 text-sm">אין חיבורים להצגה</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
