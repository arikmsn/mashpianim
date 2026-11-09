// Chat message kinds and the notifications that open the chat (pure, unit-tested).
import type { BriefSnapshot } from "./brief.ts";

export type MessageKind = "text" | "brief" | "video" | "event";

export interface VideoCardData {
  video_id: string;
  // Added at read time (signed URLs expire)
  url?: string | null;
  thumbnail_url?: string | null;
  status?: string | null;
  // 1 = first upload, 2 = the revised one
  round?: number;
  // Several options per round: 1, 2, 3… in upload order
  option?: number;
  final?: boolean;
}

// How many videos a creator may put in front of the brand per round (the brand picks; the chat stays usable)
export const MAX_DELIVERABLES_PER_ROUND = 5;

export type MessageData = BriefSnapshot | VideoCardData | Record<string, unknown>;

export function isBriefSnapshot(data: unknown): data is BriefSnapshot {
  return !!data && typeof data === "object" && "product_name" in (data as Record<string, unknown>) && "version" in (data as Record<string, unknown>);
}

export function isVideoCard(data: unknown): data is VideoCardData {
  return !!data && typeof data === "object" && typeof (data as Record<string, unknown>).video_id === "string";
}

// Texts the app writes into the chat in a person's name (the owner's spec: they read like the person said it)
export const CHAT_EVENT_TEXTS = {
  briefApproved: "אישרתי את הבריף",
  packageReceived: "קיבלתי את החבילה",
  revisionPrefix: "דרוש שינוי: ",
} as const;

// Review window after the revised (final) upload: the brand answers within a day or it closes automatically
export const FINAL_REVIEW_HOURS = 24;

// --- Realtime hygiene ---------------------------------------------------------------------------------------
// Columns of `connections` that move without the chat needing to reload: our own "mark as read" and
// bookkeeping. Reloading on them made a loop (open chat → mark read → row update → realtime → reload → mark
// read …) that sent ~70 requests a second from one phone on 2026-11-09 and starved Supabase Auth.
export const QUIET_CONNECTION_FIELDS: ReadonlySet<string> = new Set(["creator_read_at", "brand_read_at", "updated_at"]);

// Postgres timestamps arrive in two spellings (PostgREST "2026-11-09T17:54:47.606332+00:00", Realtime
// "2026-11-09 17:54:47.606332+00"); both become the same instant. Non-timestamps give NaN.
export function parseInstant(value: unknown): number {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(value)) return NaN;
  const normalised = value
    .replace(" ", "T")
    .replace(/(\.\d{3})\d+/, "$1")
    .replace(/([+-]\d{2})$/, "$1:00");
  return Date.parse(normalised);
}

// Equal for our purposes: null / undefined / "" alike, timestamps by instant, everything else by value.
export function sameFieldValue(a: unknown, b: unknown): boolean {
  const emptyA = a === null || a === undefined || a === "";
  const emptyB = b === null || b === undefined || b === "";
  if (emptyA || emptyB) return emptyA && emptyB;
  if (typeof a === "object" || typeof b === "object") return JSON.stringify(a) === JSON.stringify(b);
  if (String(a) === String(b)) return true;
  const ta = parseInstant(a);
  const tb = parseInstant(b);
  return !Number.isNaN(ta) && !Number.isNaN(tb) && ta === tb;
}

// Keys of `next` whose value differs from `prev`
export function changedConnectionFields(prev: Record<string, unknown>, next: Record<string, unknown>): string[] {
  return Object.keys(next).filter((key) => !sameFieldValue(prev[key], next[key]));
}

// True when a realtime update touched only quiet fields (or nothing): merge it locally, don't refetch.
export function isQuietConnectionUpdate(prev: Record<string, unknown> | null | undefined, next: Record<string, unknown>): boolean {
  if (!prev) return false;
  return changedConnectionFields(prev, next).every((key) => QUIET_CONNECTION_FIELDS.has(key));
}

// Does the chat hold messages from the other side that this viewer hasn't marked read yet? Mirrors
// /api/messages/unread (sender ≠ me, newer than my read marker). An unknown viewer counts as "yes".
export function hasUnreadFromOthers(
  messages: { senderId: string; createdAt: string }[],
  myUserId: string | null | undefined,
  readAt: string | null | undefined
): boolean {
  const since = readAt ? parseInstant(readAt) : NaN;
  return messages.some((m) => {
    if (myUserId && m.senderId === myUserId) return false;
    if (Number.isNaN(since)) return true;
    const at = parseInstant(m.createdAt);
    return Number.isNaN(at) || at > since;
  });
}

// Notification types whose tap opens the chat (everything after the match lives there)
export const CHAT_NOTIFICATION_TYPES = new Set([
  "match",
  "new_message",
  "brief_posted",
  "brief_updated",
  "brief_approved",
  "connection_approved",
  "product_shipped",
  "product_delivered",
  "video_uploaded",
  "video_ready_for_review",
  "revision_requested",
  "video_revision",
  "connection_completed",
  "video_approved",
  "connection_cancelled",
  "connection_auto_cancelled",
  "shipping_deadline_warning",
  "filming_deadline_warning",
  "review_deadline_warning",
]);
