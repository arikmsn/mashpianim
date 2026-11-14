"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Input, Modal, Textarea, useToast } from "@/components/ui";
import { fetchJson } from "@/lib/client-cache";
import {
  FEEDBACK_KINDS,
  FEEDBACK_KIND_LABELS,
  FEEDBACK_STATUS_LABELS,
  MESSAGE_MAX,
  REPLY_MAX,
  SUBJECT_MAX,
  validateFeedback,
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
  status: FeedbackStatus;
  admin_note: string | null;
  created_at: string;
  last_message_at?: string | null;
  last_message_from?: "user" | "admin" | null;
  replies?: number;
}

const kindIcons: Record<FeedbackKind, string> = { bug: "🐞", request: "💡", contact: "✉️" };
const statusVariant: Record<FeedbackStatus, "warning" | "info" | "success"> = { new: "warning", in_progress: "info", closed: "success" };

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
  // Presets for a specific entry point (e.g. "buy credits" opens a contact request). They apply when the
  // component mounts — render it with a `key` that changes with the intent.
  initialKind?: FeedbackKind;
  initialSubject?: string;
  intro?: string;
  title?: string;
  // A report whose thread opens at once (a notification deep link: /profile?feedback=<id>)
  initialFeedbackId?: string | null;
}

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// "Contact us / report a problem" for both roles. Sends to POST /api/feedback and lists the user's own reports;
// each report opens as a thread — what they sent, what we answered, their follow-ups (owner list 2026-11-14).
export function FeedbackModal({ open, onClose, initialKind, initialSubject, intro, title, initialFeedbackId }: FeedbackModalProps) {
  const { toast } = useToast();
  const [kind, setKind] = useState<FeedbackKind>(initialKind || "bug");
  const [subject, setSubject] = useState(initialSubject || "");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [mine, setMine] = useState<FeedbackRow[] | null>(null);
  const [threadsAvailable, setThreadsAvailable] = useState(true);
  // undefined = nothing chosen yet (the deep-linked report opens), null = everything collapsed
  const [expandedState, setExpandedState] = useState<string | null | undefined>(undefined);
  const expanded = expandedState === undefined ? initialFeedbackId || null : expandedState;
  const [thread, setThread] = useState<{ id: string; messages: ThreadMessage[] } | null>(null);
  const [reply, setReply] = useState("");
  const [replying, setReplying] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetchJson<{ feedback?: FeedbackRow[]; threads_available?: boolean }>("/api/feedback").then((d) => {
      setMine(d?.feedback || []);
      if (typeof d?.threads_available === "boolean") setThreadsAvailable(d.threads_available);
    });
  }, [open]);

  // The open thread: the report plus its replies
  useEffect(() => {
    if (!open || !expanded) return;
    let cancelled = false;
    fetchJson<{ messages?: ThreadMessage[]; threads_available?: boolean }>(`/api/feedback/${expanded}`).then((d) => {
      if (cancelled || !d) return;
      setThread({ id: expanded, messages: d.messages || [] });
      if (typeof d.threads_available === "boolean") setThreadsAvailable(d.threads_available);
    });
    return () => {
      cancelled = true;
    };
  }, [open, expanded]);

  async function submit() {
    const check = validateFeedback({ kind, subject, message, page: typeof window !== "undefined" ? window.location.pathname : null });
    if (!check.ok) {
      toast(check.error, "error");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(check.value),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast("הפנייה נשלחה — נחזור אליך בהקדם 🙏", "success");
        setSubject("");
        setMessage("");
        setMine((prev) => [data.feedback as FeedbackRow, ...(prev || [])]);
      } else {
        toast((data as { error?: string }).error || "שגיאה בשליחת הפנייה", "error");
      }
    } catch {
      toast("שגיאה בשליחת הפנייה", "error");
    } finally {
      setSending(false);
    }
  }

  async function sendReply() {
    if (!expanded) return;
    const check = validateReplyText(reply);
    if (!check.ok) {
      toast(check.error, "error");
      return;
    }
    setReplying(true);
    try {
      const res = await fetch(`/api/feedback/${expanded}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: check.text }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const saved = data.message as ThreadMessage;
        setThread((prev) => (prev && prev.id === expanded ? { ...prev, messages: [...prev.messages, saved] } : prev));
        setMine((prev) =>
          (prev || []).map((f) =>
            f.id === expanded
              ? { ...f, status: (data.status as FeedbackStatus) || f.status, replies: (f.replies || 0) + 1, last_message_from: "user", last_message_at: saved.created_at }
              : f
          )
        );
        setReply("");
        toast("התגובה נשלחה", "success");
      } else {
        toast((data as { error?: string }).error || "שגיאה בשליחת התגובה", "error");
      }
    } catch {
      toast("שגיאה בשליחת התגובה", "error");
    } finally {
      setReplying(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title || "צור קשר / דיווח על תקלה"} size="md" className="max-h-[90vh] overflow-y-auto">
      <div className="space-y-4">
        {intro && <p className="text-sm text-neutral-600 bg-pink-50 rounded-xl px-3 py-2">{intro}</p>}
        <div className="flex gap-2">
          {FEEDBACK_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`flex-1 py-2 px-2 rounded-xl text-xs font-medium border transition-colors ${
                kind === k ? "bg-pink-500 text-white border-pink-500" : "bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50"
              }`}
            >
              {kindIcons[k]} {FEEDBACK_KIND_LABELS[k]}
            </button>
          ))}
        </div>

        <Input
          label="נושא"
          value={subject}
          maxLength={SUBJECT_MAX}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={kind === "bug" ? "מה לא עבד?" : kind === "request" ? "מה היה עוזר לך?" : "במה נוכל לעזור?"}
        />
        <Textarea
          label="פירוט"
          value={message}
          maxLength={MESSAGE_MAX}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={kind === "bug" ? "מה עשית, מה ציפית שיקרה ומה קרה בפועל" : "כמה שיותר פרטים — זה עוזר לנו"}
          rows={4}
        />
        <p className="text-[11px] text-neutral-400">נצרף אוטומטית את המסך שממנו נשלחה הפנייה. התשובה תגיע כהתראה באפליקציה ותופיע כאן, בפנייה עצמה.</p>
        <Button fullWidth loading={sending} onClick={submit}>
          שליחה
        </Button>

        {mine && mine.length > 0 && (
          <div className="border-t border-neutral-100 pt-4 space-y-2">
            <p className="text-sm font-bold text-neutral-800">הפניות שלי</p>
            {mine.map((f) => {
              const isOpen = expanded === f.id;
              const hasAnswer = f.last_message_from === "admin" || (!!f.admin_note && !f.replies);
              return (
                <div key={f.id} className={`rounded-xl border ${isOpen ? "border-pink-200 bg-white" : "border-transparent bg-neutral-50"}`}>
                  <button
                    type="button"
                    onClick={() => setExpandedState(isOpen ? null : f.id)}
                    className="w-full text-right p-3 space-y-1"
                    aria-expanded={isOpen}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">
                        {kindIcons[f.kind]} {f.subject}
                      </p>
                      <span className="flex items-center gap-1 shrink-0">
                        {hasAnswer && <Badge variant="pink" size="sm">💬 יש תשובה</Badge>}
                        <Badge variant={statusVariant[f.status] || "default"} size="sm">
                          {FEEDBACK_STATUS_LABELS[f.status] || f.status}
                        </Badge>
                      </span>
                    </div>
                    {!isOpen && <p className="text-xs text-neutral-500 line-clamp-2">{f.message}</p>}
                    <p className="text-[10px] text-neutral-400">
                      {new Date(f.created_at).toLocaleDateString("he-IL")}
                      {f.replies ? ` · ${f.replies} תגובות` : ""}
                      {isOpen ? " · לסגירה" : " · לפתיחת השיחה"}
                    </p>
                  </button>

                  {isOpen && (
                    <div className="px-3 pb-3 space-y-2">
                      {!thread || thread.id !== f.id ? (
                        <p className="text-xs text-neutral-400">טוען את השיחה...</p>
                      ) : (
                        thread.messages.map((m) => (
                          <div key={m.id} className={`flex ${m.from_admin ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.from_admin ? "bg-white border border-neutral-200 text-neutral-800 rounded-bl-md" : "bg-pink-500 text-white rounded-br-md"}`}>
                              <p className={`text-[10px] mb-0.5 ${m.from_admin ? "text-pink-600 font-semibold" : "text-pink-100"}`}>{m.from_admin ? "משפיען אונליין" : "אני"}</p>
                              <p className="whitespace-pre-wrap break-words">{m.text}</p>
                              <p className={`text-[10px] mt-1 text-left ${m.from_admin ? "text-neutral-400" : "text-pink-100"}`} dir="ltr">{when(m.created_at)}</p>
                            </div>
                          </div>
                        ))
                      )}
                      {threadsAvailable ? (
                        <div className="flex gap-2 items-end pt-1">
                          <textarea
                            value={reply}
                            maxLength={REPLY_MAX}
                            onChange={(e) => setReply(e.target.value)}
                            placeholder={f.status === "closed" ? "הפנייה סגורה — תגובה תפתח אותה מחדש" : "כתבו תגובה..."}
                            rows={2}
                            className="flex-1 px-3 py-2 rounded-xl bg-neutral-50 border border-neutral-100 text-sm outline-none focus:border-pink-300 resize-y"
                          />
                          <Button size="sm" loading={replying} disabled={!reply.trim()} onClick={sendReply}>
                            שליחה
                          </Button>
                        </div>
                      ) : (
                        <p className="text-[11px] text-neutral-400">לתגובה נוספת — שלחו פנייה חדשה למעלה.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
