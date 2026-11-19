// Which unanswered hearts expire (owner, 2026-11-19): a business's heart to a creator still waits 7 days for an
// answer; a creator's heart on a product never expires by time — it stays until the business answers or removes
// the product (the cron used to cancel both after 7 days, and 578 creator hearts were lost). Pure, unit-tested;
// the cron (api/cron/deadlines) and the product delete route apply it.

export const HEART_EXPIRY_DAYS = 7;

export interface HeartRow {
  status: string | null | undefined;
  initiated_by: string | null | undefined;
  mutual_at: string | null | undefined;
  created_at: string | null | undefined;
}

// A one-sided, still-pending heart the BUSINESS sent more than HEART_EXPIRY_DAYS ago
export function heartExpiresUnanswered(conn: HeartRow, now: Date = new Date()): boolean {
  if (conn.status !== "pending") return false;
  if (conn.mutual_at) return false; // both hearted: waits for the business's confirmation, never expires
  if (conn.initiated_by !== "brand") return false; // a creator's heart stays
  const created = conn.created_at ? Date.parse(conn.created_at) : NaN;
  if (!Number.isFinite(created)) return false;
  return now.getTime() - created > HEART_EXPIRY_DAYS * 86_400_000;
}

// When a business removes a product, every heart still waiting on it (either side, mutual or not) is closed
export function heartClosesWithProduct(conn: Pick<HeartRow, "status">): boolean {
  return conn.status === "pending";
}
