// Where a notification takes the user when tapped (pure, unit-tested).
// Notification `data` carries `connectionId` (always, for connection events) and `productId` (newer rows).

export type NotificationLike = { type: string; data?: Record<string, unknown> | null };
export type ViewerRole = "creator" | "brand" | "admin" | null | undefined;

function str(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

export function notificationHref(n: NotificationLike, role: ViewerRole): string | null {
  const connectionId = str(n.data?.connectionId);
  const productId = str(n.data?.productId);

  if (n.type === "portfolio_video_removed") return "/profile";

  if (n.type === "match" || n.type === "new_message") {
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

  if (role === "admin") {
    return connectionId ? "/admin/content" : null;
  }

  return null;
}
