// An admin stopping a connection's chat (owner list 2026-11-14, item 5). Pure, unit-tested, no framework imports.
// `connections.blocked_at / blocked_reason / blocked_by` (migration 019) carry the state; the API routes the two
// parties use refuse new messages, briefs, deliverables and status moves while it is set, and both chats show
// CHAT_BLOCKED_TEXT with a way to contact us.

export const CHAT_BLOCKED_TEXT = "המערכת עצרה את ההתקשרות, יש לפנות לבירור";
export const CHAT_UNBLOCKED_TEXT = "ההתקשרות שוחררה — אפשר להמשיך בשיחה";
export const CHAT_BLOCKED_CODE = "chat_blocked";

// Subject the contact form opens with from a stopped chat
export function chatBlockedSubject(productName?: string | null): string {
  const p = (productName || "").trim();
  return p ? `בירור על עצירת ההתקשרות — ${p}` : "בירור על עצירת ההתקשרות";
}

export function isChatBlocked(conn: { blocked_at?: unknown } | null | undefined): boolean {
  return !!conn && typeof conn.blocked_at === "string" && conn.blocked_at.length > 0;
}
