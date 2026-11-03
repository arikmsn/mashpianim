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
