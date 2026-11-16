"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Badge, Card, useToast } from "@/components/ui";
import { connectionStatusLabel, isAdminConnectionFilter, isMatchedStatus, type AdminConnectionFilter } from "@/lib/admin-connections";
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

type Payload = {
  connections: Row[];
  total: number;
  page: number;
  per: number;
  counts: { all: number; matched: number; active: number; pending: number; blocked: number } | null;
};

const PER = 100;

export default function AdminConnectionsPage() {
  return (
    <Suspense>
      <ConnectionsContent />
    </Suspense>
  );
}

// Connections and matches (owner list, 2026-11-14). Paged in the database since 2026-11-16 — every connection is
// reachable; the filter chips carry the counts, the search covers creator / business / product / phone.
function ConnectionsContent() {
  const searchParams = useSearchParams();
  const initial = searchParams.get("filter");
  const [filter, setFilter] = useState<AdminConnectionFilter>(isAdminConnectionFilter(initial) ? initial : "matched");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [data, setData] = useState<Payload | null>(null);
  // The request key the loaded data belongs to; a different key means a load is in flight
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const { toast } = useToast();
  const requestKey = `${filter}|${page}|${q}`;
  const loading = loadedKey !== requestKey;

  // The typed search applies after a short pause, from page 1
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const params = new URLSearchParams({ filter, page: String(page), per: String(PER) });
    if (q) params.set("q", q);
    const key = `${filter}|${page}|${q}`;
    let cancelled = false;
    fetch(`/api/admin/connections?${params}`)
      .then((res) => (res.ok ? (res.json() as Promise<Payload>) : Promise.reject(new Error("API error"))))
      .then((payload) => {
        if (cancelled) return;
        setData(payload);
        setLoadedKey(key);
      })
      .catch(() => {
        if (cancelled) return;
        toast("שגיאה בטעינת החיבורים", "error");
        setLoadedKey(key);
      });
    return () => {
      cancelled = true;
    };
  }, [filter, page, q, toast]);

  const rows = data?.connections || [];
  const total = data?.total || 0;
  const pages = Math.max(1, Math.ceil(total / PER));
  const counts = data?.counts;
  const filters: { key: AdminConnectionFilter; label: string }[] = [
    { key: "matched", label: `מאטצ'ים${counts ? ` (${counts.matched})` : ""}` },
    { key: "active", label: `בתהליך${counts ? ` (${counts.active})` : ""}` },
    { key: "pending", label: `לבבות ממתינים${counts ? ` (${counts.pending})` : ""}` },
    { key: "blocked", label: `חסומים${counts ? ` (${counts.blocked})` : ""}` },
    { key: "all", label: `הכל${counts ? ` (${counts.all})` : ""}` },
  ];

  function pick(f: AdminConnectionFilter) {
    setFilter(f);
    setPage(1);
  }

  const pager = (
    <div className="flex items-center justify-between gap-3 text-xs text-neutral-500 px-1">
      <span>
        {total === 0 ? "אין תוצאות" : `${(page - 1) * PER + 1}–${Math.min(page * PER, total)} מתוך ${total}`}
      </span>
      {pages > 1 && (
        <div className="flex items-center gap-1">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading} className="px-2.5 py-1 rounded-lg bg-neutral-50 hover:bg-neutral-100 disabled:opacity-40">‹ הקודם</button>
          <span className="px-2">עמוד {page} מתוך {pages}</span>
          <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages || loading} className="px-2.5 py-1 rounded-lg bg-neutral-50 hover:bg-neutral-100 disabled:opacity-40">הבא ›</button>
        </div>
      )}
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">חיבורים ומאטצ&apos;ים</h1>
          <p className="text-neutral-500 text-sm mt-1">כל לב, מאטץ&apos; ושיתוף פעולה בפלטפורמה</p>
        </div>
      </div>

      <Card padding="md" className="mb-4">
        <div className="flex items-center gap-4 flex-wrap">
          <input
            type="text"
            placeholder="חיפוש לפי יוצר/ת, עסק, מוצר או טלפון..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[220px] px-4 py-2.5 rounded-xl bg-neutral-50 border border-neutral-100 text-sm outline-none focus:border-pink-300"
          />
          <div className="flex gap-1 bg-neutral-50 rounded-lg p-0.5 flex-wrap">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => pick(f.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filter === f.key ? "bg-white shadow-sm text-pink-500" : "text-neutral-500"}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <div className="mb-2">{pager}</div>

      {loading && !data ? (
        <p className="text-sm text-neutral-400 p-8">טוען...</p>
      ) : (
        <div className={`bg-white rounded-2xl border border-neutral-100 overflow-x-auto ${loading ? "opacity-60" : ""}`}>
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
              {rows.map((r) => (
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
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-neutral-400 text-sm">אין חיבורים להצגה</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-2">{pager}</div>
    </div>
  );
}
