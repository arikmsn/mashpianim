"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Input, Modal, Textarea, useToast } from "@/components/ui";
import { fetchJson } from "@/lib/client-cache";
import {
  FEEDBACK_KINDS,
  FEEDBACK_KIND_LABELS,
  FEEDBACK_STATUS_LABELS,
  MESSAGE_MAX,
  SUBJECT_MAX,
  validateFeedback,
  type FeedbackKind,
  type FeedbackStatus,
} from "@/lib/feedback";

interface FeedbackRow {
  id: string;
  kind: FeedbackKind;
  subject: string;
  message: string;
  status: FeedbackStatus;
  admin_note: string | null;
  created_at: string;
}

const kindIcons: Record<FeedbackKind, string> = { bug: "🐞", request: "💡", contact: "✉️" };
const statusVariant: Record<FeedbackStatus, "warning" | "info" | "success"> = { new: "warning", in_progress: "info", closed: "success" };

// "Contact us / report a problem" for both roles. Sends to POST /api/feedback and lists the user's own reports.
export function FeedbackModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [kind, setKind] = useState<FeedbackKind>("bug");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [mine, setMine] = useState<FeedbackRow[] | null>(null);

  useEffect(() => {
    if (!open) return;
    fetchJson<{ feedback?: FeedbackRow[] }>("/api/feedback").then((d) => setMine(d?.feedback || []));
  }, [open]);

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

  return (
    <Modal open={open} onClose={onClose} title="צור קשר / דיווח על תקלה" size="md" className="max-h-[90vh] overflow-y-auto">
      <div className="space-y-4">
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
        <p className="text-[11px] text-neutral-400">נצרף אוטומטית את המסך שממנו נשלחה הפנייה. התשובה תגיע כהתראה באפליקציה.</p>
        <Button fullWidth loading={sending} onClick={submit}>
          שליחה
        </Button>

        {mine && mine.length > 0 && (
          <div className="border-t border-neutral-100 pt-4 space-y-2">
            <p className="text-sm font-bold text-neutral-800">הפניות שלי</p>
            {mine.map((f) => (
              <div key={f.id} className="bg-neutral-50 rounded-xl p-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate">
                    {kindIcons[f.kind]} {f.subject}
                  </p>
                  <Badge variant={statusVariant[f.status] || "default"} size="sm">
                    {FEEDBACK_STATUS_LABELS[f.status] || f.status}
                  </Badge>
                </div>
                <p className="text-xs text-neutral-500 line-clamp-2">{f.message}</p>
                {f.admin_note && <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-2 py-1">תשובה: {f.admin_note}</p>}
                <p className="text-[10px] text-neutral-400">{new Date(f.created_at).toLocaleDateString("he-IL")}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
