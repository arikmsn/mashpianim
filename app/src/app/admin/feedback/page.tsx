"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, useToast } from "@/components/ui";
import {
  FEEDBACK_KIND_LABELS,
  FEEDBACK_STATUS_LABELS,
  type FeedbackKind,
  type FeedbackStatus,
} from "@/lib/feedback";

interface FeedbackRow {
  id: string;
  kind: FeedbackKind;
  subject: string;
  message: string;
  page: string | null;
  user_agent: string | null;
  status: FeedbackStatus;
  admin_note: string | null;
  created_at: string;
  users?: { full_name: string | null; type: string; phone: string | null } | null;
}

type Filter = "open" | "new" | "in_progress" | "closed" | "all";

const filters: { id: Filter; label: string }[] = [
  { id: "open", label: "פתוחות" },
  { id: "new", label: "חדשות" },
  { id: "in_progress", label: "בטיפול" },
  { id: "closed", label: "סגורות" },
  { id: "all", label: "הכל" },
];

const kindIcons: Record<FeedbackKind, string> = { bug: "🐞", request: "💡", contact: "✉️" };
const statusVariant: Record<FeedbackStatus, "warning" | "info" | "success"> = { new: "warning", in_progress: "info", closed: "success" };
const userTypeLabel: Record<string, string> = { creator: "יוצר/ת", brand: "עסק", admin: "מנהל" };

export default function AdminFeedbackPage() {
  const [filter, setFilter] = useState<Filter>("open");
  // null = loading (set together with the filter, so the effect only fetches)
  const [rows, setRows] = useState<FeedbackRow[] | null>(null);
  const [newCount, setNewCount] = useState(0);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const { toast } = useToast();

  const load = useCallback(
    async (f: Filter) => {
      const res = await fetch(`/api/admin/feedback?status=${f}`).catch(() => null);
      const data = res ? await res.json().catch(() => ({})) : {};
      if (res?.ok) {
        setRows((data.feedback as FeedbackRow[]) || []);
        setNewCount(typeof data.newCount === "number" ? data.newCount : 0);
      } else {
        setRows([]);
        toast((data as { error?: string }).error || "שגיאה בטעינה", "error");
      }
    },
    [toast]
  );

  useEffect(() => {
    const t = setTimeout(() => load(filter), 0);
    return () => clearTimeout(t);
  }, [filter, load]);

  function changeFilter(f: Filter) {
    setFilter(f);
    setRows(null);
  }

  async function update(id: string, patch: { status?: FeedbackStatus; admin_note?: string }) {
    setBusy(id);
    try {
      const res = await fetch("/api/admin/feedback", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast("עודכן", "success");
        load(filter);
      } else {
        toast((data as { error?: string }).error || "שגיאה בעדכון", "error");
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">פניות ותקלות</h1>
          <p className="text-sm text-neutral-500">דיווחים, בקשות ופניות שנשלחו מתוך האפליקציה{newCount > 0 ? ` · ${newCount} חדשות` : ""}</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => changeFilter(f.id)}
            className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f.id ? "bg-pink-500 text-white" : "bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {rows === null ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-white rounded-2xl border border-neutral-100 animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-neutral-400 bg-white rounded-2xl border border-neutral-100">
          <span className="text-4xl block mb-3">📭</span>
          <p>אין פניות בסינון הזה</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl border border-neutral-100 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-neutral-900">
                    {kindIcons[r.kind]} {r.subject}
                  </p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {FEEDBACK_KIND_LABELS[r.kind]} · {r.users?.full_name || "משתמש/ת"} ({userTypeLabel[r.users?.type || ""] || r.users?.type || "?"})
                    {r.users?.phone ? ` · ${r.users.phone}` : ""} · {new Date(r.created_at).toLocaleString("he-IL")}
                  </p>
                </div>
                <Badge variant={statusVariant[r.status] || "default"} size="sm">
                  {FEEDBACK_STATUS_LABELS[r.status] || r.status}
                </Badge>
              </div>
              <p className="text-sm text-neutral-700 whitespace-pre-line">{r.message}</p>
              {(r.page || r.user_agent) && (
                <p className="text-[11px] text-neutral-400 break-all">
                  {r.page ? `מסך: ${r.page}` : ""}
                  {r.page && r.user_agent ? " · " : ""}
                  {r.user_agent || ""}
                </p>
              )}
              <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                <textarea
                  value={notes[r.id] ?? r.admin_note ?? ""}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  placeholder="הערה / תשובה למשתמש (נשלחת כהתראה כשמשנים סטטוס)"
                  rows={2}
                  className="flex-1 px-3 py-2 rounded-xl border border-neutral-200 text-sm outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-500/10 resize-y"
                />
                <div className="flex gap-2 flex-wrap">
                  {r.status !== "in_progress" && (
                    <Button size="sm" variant="secondary" loading={busy === r.id} onClick={() => update(r.id, { status: "in_progress", admin_note: notes[r.id] ?? r.admin_note ?? "" })}>
                      בטיפול
                    </Button>
                  )}
                  {r.status !== "closed" && (
                    <Button size="sm" loading={busy === r.id} onClick={() => update(r.id, { status: "closed", admin_note: notes[r.id] ?? r.admin_note ?? "" })}>
                      סגירה
                    </Button>
                  )}
                  {r.status === "closed" && (
                    <Button size="sm" variant="secondary" loading={busy === r.id} onClick={() => update(r.id, { status: "new" })}>
                      פתיחה מחדש
                    </Button>
                  )}
                  {notes[r.id] !== undefined && notes[r.id] !== (r.admin_note ?? "") && (
                    <Button size="sm" variant="ghost" loading={busy === r.id} onClick={() => update(r.id, { admin_note: notes[r.id] })}>
                      שמירת הערה
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
