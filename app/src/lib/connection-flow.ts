// Pure rules of the connection lifecycle shared by API routes and pages (no framework imports, unit-tested).

// Chat is open from the match until the connection closes
export const CHAT_OPEN_STATUSES = [
  "approved",
  "shipped",
  "delivered",
  "filming",
  "uploaded",
  "in_review",
  "revision_requested",
] as const;

export const CLOSED_STATUSES = ["completed", "cancelled", "rejected"] as const;

export function isChatOpen(status: unknown): boolean {
  return typeof status === "string" && (CHAT_OPEN_STATUSES as readonly string[]).includes(status);
}

// A closed connection still shows its chat (read-only) when it was ever matched
export function hasChatHistory(conn: { status: unknown; approved_at?: string | null }): boolean {
  if (isChatOpen(conn.status)) return true;
  return typeof conn.status === "string" && (CLOSED_STATUSES as readonly string[]).includes(conn.status) && !!conn.approved_at;
}

// The brand reviews a deliverable as soon as it is uploaded; the admin step (in_review) is optional (FLOW-01)
export const BRAND_REVIEW_STATUSES = ["uploaded", "in_review"] as const;

export function canBrandReview(status: unknown): boolean {
  return typeof status === "string" && (BRAND_REVIEW_STATUSES as readonly string[]).includes(status);
}
