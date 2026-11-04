// Chat message kinds and the notifications that open the chat (pure, unit-tested).
import type { BriefSnapshot } from "./brief.ts";

export type MessageKind = "text" | "brief" | "video" | "event";

export interface VideoCardData {
  video_id: string;
  // Added at read time (signed URLs expire)
  url?: string | null;
  thumbnail_url?: string | null;
  // 1 = first upload, 2 = the revised one
  round?: number;
}

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
