"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, useToast } from "@/components/ui";
import {
  FEEDBACK_KIND_LABELS,
  FEEDBACK_STATUS_LABELS,
  REPLY_MAX,
  validateReplyText,
  type FeedbackKind,
  type FeedbackStatus,
  type ThreadMessage,
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
  last_message_at: string | null;
  last_message_from: "user" | "admin" | null;
  thread: ThreadMessage[];
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

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("he-IL", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// Reports as threads (owner list 2026-11-14, item 6): what the user sent, what we answered, their follow-ups,
// and a composer for the next reply. The reply moves the report to "בטיפול" and notifies the user.
export default function AdminFeedbackPage() {
  const [filter, setFilter] = useState<Filter>("open");
  // null = loading (set together with the filter, so the effect only fetches)
  const [rows, setRows] = useState<FeedbackRow[] | null>(null);
  const [newCount, setNewCount] = useState(0);
  const [threadsAvailable, setThreadsAvailable] = useState(true);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const { toast } = useToast();

  const load = useCallback(
    async (f: Filter) => {
      const res = await fetch(`/api/admin/feedback?status=${f}`).catch(() => null);
      const data = res ? await res.json().catch(() => ({})) : {};
      if (res?.ok) {
        setRows((data.feedback as FeedbackRow[]) || []);
        setNewCount(typeof data.newCount === "number" ? data.newCount : 0);
        setThreadsAvailable(data.threads_available !== false);
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

  async function sendReply(r: FeedbackRow) {
    const check = validateReplyText(replies[r.id]);
    if (!check.ok) {
      toast(check.error, "error");
      return;
    }
    setBusy(r.id);
    try {
      const res = await fetch("/api/admin/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id, text: check.text }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast("התגובה נשלחה למשתמש/ת", "success");
        setReplies((prev) => ({ ...prev, [r.id]: "" }));
        load(filter);
      } else {
        toast((data as { error?: string }).error || "שגיאה בשליחת התגובה", "error");
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

      {!threadsAvailable && (
        <div className="mb-4 rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-800">
          התגובות בשרשור יופעלו אחרי הפעלת מיגרציה 020 (<code>feedback_messages</code>). בינתיים אפשר לשנות סטטוס בלבד.
        </div>
      )}

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
          {rows.map((r) => {
            const name = r.users?.full_name || "משתמש/ת";
            const awaitingUs = r.last_message_from === "user";
            return (
              <div key={r.id} className={`bg-white rounded-2xl border p-4 space-y-3 ${awaitingUs ? "border-pink-200" : "border-neutral-100"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-neutral-900">
                      {kindIcons[r.kind]} {r.subject}
                    </p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {FEEDBACK_KIND_LABELS[r.kind]} · {name} ({userTypeLabel[r.users?.type || ""] || r.users?.type || "?"})
                      {r.users?.phone ? ` · ${r.users.phone}` : ""} · {when(r.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {awaitingUs && <Badge variant="pink" size="sm">💬 המשתמש/ת הגיב/ה</Badge>}
                    <Badge variant={statusVariant[r.status] || "default"} size="sm">
                      {FEEDBACK_STATUS_LABELS[r.status] || r.status}
                    </Badge>
                  </div>
                </div>

                {/* The thread: the report first, then every reply in time order */}
                <div className="space-y-2">
                  {(r.thread || []).map((m) => (
                    <div key={m.id} className={`flex ${m.from_admin ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.from_admin ? "bg-pink-50 border border-pink-100 text-neutral-800 rounded-bl-md" : "bg-neutral-100 text-neutral-800 rounded-br-md"}`}>
                        <p className={`text-[10px] mb-0.5 font-semibold ${m.from_admin ? "text-pink-600" : "text-neutral-500"}`}>
                          {m.from_admin ? (m.id === "legacy-note" ? "אנחנו (הערה)" : "אנחנו") : name}
                        </p>
                        <p className="whitespace-pre-line break-words">{m.text}</p>
                        <p className="text-[10px] mt-1 text-left text-neutral-400" dir="ltr">{when(m.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {(r.page || r.user_agent) && (
                  <p className="text-[11px] text-neutral-400 break-all">
                    {r.page ? `מסך: ${r.page}` : ""}
                    {r.page && r.user_agent ? " · " : ""}
                    {r.user_agent || ""}
                  </p>
                )}

                <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                  <textarea
                    value={replies[r.id] ?? ""}
                    maxLength={REPLY_MAX}
                    disabled={!threadsAvailable}
                    onChange={(e) => setReplies((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    placeholder={threadsAvailable ? "תגובה למשתמש/ת — תישלח כהתראה ותופיע בפנייה שלו/ה" : "התגובות יופעלו אחרי מיגרציה 020"}
                    rows={2}
                    className="flex-1 px-3 py-2 rounded-xl border border-neutral-200 text-sm outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-500/10 resize-y disabled:bg-neutral-50"
                  />
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" loading={busy === r.id} disabled={!threadsAvailable || !(replies[r.id] || "").trim()} onClick={() => sendReply(r)}>
                      💬 שליחת תגובה
                    </Button>
                    {r.status !== "in_progress" && (
                      <Button size="sm" variant="secondary" loading={busy === r.id} onClick={() => update(r.id, { status: "in_progress" })}>
                        בטיפול
                      </Button>
                    )}
                    {r.status !== "closed" && (
                      <Button size="sm" variant="secondary" loading={busy === r.id} onClick={() => update(r.id, { status: "closed" })}>
                        סגירה
                      </Button>
                    )}
                    {r.status === "closed" && (
                      <Button size="sm" variant="secondary" loading={busy === r.id} onClick={() => update(r.id, { status: "new" })}>
                        פתיחה מחדש
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
