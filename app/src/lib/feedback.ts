// In-app reports (bugs, requests, contact) — validation shared by the form and the API (pure, unit-tested).

export const FEEDBACK_KINDS = ["bug", "request", "contact"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const FEEDBACK_STATUSES = ["new", "in_progress", "closed"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const FEEDBACK_KIND_LABELS: Record<FeedbackKind, string> = {
  bug: "דיווח על תקלה",
  request: "בקשה / רעיון",
  contact: "יצירת קשר",
};

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: "חדש",
  in_progress: "בטיפול",
  closed: "סגור",
};

export const SUBJECT_MAX = 120;
export const MESSAGE_MAX = 4000;

export interface FeedbackInput {
  kind: FeedbackKind;
  subject: string;
  message: string;
  page: string | null;
}

export type FeedbackValidation = { ok: true; value: FeedbackInput } | { ok: false; error: string };

export function isFeedbackKind(value: unknown): value is FeedbackKind {
  return typeof value === "string" && (FEEDBACK_KINDS as readonly string[]).includes(value);
}

export function isFeedbackStatus(value: unknown): value is FeedbackStatus {
  return typeof value === "string" && (FEEDBACK_STATUSES as readonly string[]).includes(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function validateFeedback(body: unknown): FeedbackValidation {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  if (!isFeedbackKind(b.kind)) return { ok: false, error: "יש לבחור סוג פנייה" };
  const subject = text(b.subject);
  const message = text(b.message);
  if (subject.length < 2) return { ok: false, error: "יש לכתוב נושא (לפחות 2 תווים)" };
  if (subject.length > SUBJECT_MAX) return { ok: false, error: `הנושא ארוך מדי (עד ${SUBJECT_MAX} תווים)` };
  if (message.length < 5) return { ok: false, error: "יש לפרט את הפנייה (לפחות 5 תווים)" };
  if (message.length > MESSAGE_MAX) return { ok: false, error: `ההודעה ארוכה מדי (עד ${MESSAGE_MAX} תווים)` };
  const page = text(b.page).slice(0, 300) || null;
  return { ok: true, value: { kind: b.kind, subject, message, page } };
}

// --- Threads (owner list 2026-11-14, item 6; migration 020) ---------------------------------------------------
// A report is the first message of a thread; our replies and the user's follow-ups are `feedback_messages` rows.

export const REPLY_MAX = 4000;

export type ReplyValidation = { ok: true; text: string } | { ok: false; error: string };

export function validateReplyText(value: unknown): ReplyValidation {
  const t = text(value);
  if (t.length < 1) return { ok: false, error: "כתבו תגובה" };
  if (t.length > REPLY_MAX) return { ok: false, error: `התגובה ארוכה מדי (עד ${REPLY_MAX} תווים)` };
  return { ok: true, text: t };
}

export type ThreadSide = "user" | "admin";

// Where a reply moves the report: we answered → "בטיפול" (a closed one reopens the same way); the user wrote
// again → a closed report is "חדש" again, an open one keeps its state.
export function statusAfterReply(current: FeedbackStatus, from: ThreadSide): FeedbackStatus {
  if (from === "admin") return "in_progress";
  return current === "closed" ? "new" : current;
}

export interface ThreadMessage {
  id: string;
  from_admin: boolean;
  text: string;
  created_at: string;
}

// The thread as both sides read it: the report itself opens it, then the replies in time order. A legacy
// `admin_note` (the one-line answer from before threads existed) shows as our reply when no real reply from us
// exists yet, so nothing an admin already wrote disappears.
export function buildThread(
  feedback: { message: string; created_at: string; admin_note?: string | null; updated_at?: string | null },
  replies: ThreadMessage[]
): ThreadMessage[] {
  const rest = [...replies];
  if (feedback.admin_note && !replies.some((r) => r.from_admin)) {
    rest.push({ id: "legacy-note", from_admin: true, text: feedback.admin_note, created_at: feedback.updated_at || feedback.created_at });
  }
  rest.sort((a, b) => (Date.parse(a.created_at) || 0) - (Date.parse(b.created_at) || 0));
  return [{ id: "report", from_admin: false, text: feedback.message, created_at: feedback.created_at }, ...rest];
}

// PostgREST's answer when migration 020 has not run yet (no `feedback_messages` table / columns): the screens
// then work without threads instead of failing.
export function isThreadsNotReadyError(error: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205" || error.code === "PGRST204" || error.code === "42703") return true;
  const m = error.message || "";
  return /feedback_messages|last_message_at|last_message_from/.test(m) && /not find|does not exist|schema cache/i.test(m);
}
