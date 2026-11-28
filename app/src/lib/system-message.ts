// A message from the team to one user (owner, 2026-11-28): the admin writes a title and a text in /admin/creators,
// the user gets it in the bell as "הודעת מערכת". One-way: the notification opens nothing and cannot be answered.
// Pure (unit-tested); the route is app/api/admin/creators/[id]/message.

export const SYSTEM_MESSAGE_TYPE = "system_message";
export const SYSTEM_MESSAGE_LABEL = "הודעת מערכת";
export const SYSTEM_MESSAGE_TITLE_MAX = 80;
export const SYSTEM_MESSAGE_BODY_MAX = 1000;

export type SystemMessageInput = { title: string; body: string };

// Trimmed values, or the Hebrew reason they cannot be sent
export function validateSystemMessage(input: unknown): { ok: true; value: SystemMessageInput } | { ok: false; error: string } {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const body = typeof raw.body === "string" ? raw.body.replace(/\r\n?/g, "\n").trim() : "";
  if (!title) return { ok: false, error: "חסרה כותרת" };
  if (!body) return { ok: false, error: "חסר תוכן להודעה" };
  if (title.length > SYSTEM_MESSAGE_TITLE_MAX) return { ok: false, error: `הכותרת ארוכה מדי (עד ${SYSTEM_MESSAGE_TITLE_MAX} תווים)` };
  if (body.length > SYSTEM_MESSAGE_BODY_MAX) return { ok: false, error: `ההודעה ארוכה מדי (עד ${SYSTEM_MESSAGE_BODY_MAX} תווים)` };
  return { ok: true, value: { title, body } };
}
