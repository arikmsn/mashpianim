// Where a notification takes the user when tapped (pure, unit-tested).
// Notification `data` carries `connectionId` (always, for connection events) and `productId` (newer rows).
//
// `role` is the side the account acts on in the app (creator or brand) — for admins too: an admin with a
// creator profile is a creator here. Only report notifications ever lead into the admin area, and only
// for admins (`isAdmin`).

import { CHAT_NOTIFICATION_TYPES } from "./chat.ts";

export type NotificationLike = { type: string; data?: Record<string, unknown> | null };
export type ViewerRole = "creator" | "brand" | null | undefined;

function str(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

export function notificationHref(n: NotificationLike, role: ViewerRole, isAdmin = false): string | null {
  const connectionId = str(n.data?.connectionId);
  const productId = str(n.data?.productId);

  if (n.type === "feedback_received") return isAdmin ? "/admin/feedback" : null;
  if (n.type === "capacity_warning") return isAdmin ? "/admin" : null;
  // A reply or a status change on one of the user's reports opens that thread in the contact form (profile)
  if (n.type === "feedback_updated" || n.type === "feedback_reply") {
    const feedbackId = str(n.data?.feedbackId);
    return feedbackId ? `/profile?feedback=${feedbackId}` : "/profile";
  }
  if (n.type === "portfolio_video_removed") return "/profile";
  // Purchases (SUMIT): the business lands on its home (the credits card), admins on the businesses screen
  if (n.type === "credits_loaded") return role === "brand" ? "/brand" : "/profile";
  if (n.type === "purchase_received") return isAdmin ? "/admin/brands" : null;

  if (CHAT_NOTIFICATION_TYPES.has(n.type)) {
    return connectionId ? `/messages?connection=${connectionId}` : "/messages";
  }

  if (role === "brand") {
    return connectionId ? `/brand/connections?open=${connectionId}` : null;
  }

  if (role === "creator") {
    // The product page shows the brief, the journey and the actions; older rows without a product fall back
    // to the connections list, which highlights the card
    if (productId) return `/products/${productId}`;
    return connectionId ? `/connections?open=${connectionId}` : null;
  }

  return null;
}
