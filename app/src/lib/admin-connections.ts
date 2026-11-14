// Pure helpers for the admin connections ("חיבורים") screens (unit-tested). No framework imports.

export type AdminConnectionFilter = "all" | "active" | "matched" | "pending" | "blocked";

export function isAdminConnectionFilter(v: unknown): v is AdminConnectionFilter {
  return v === "all" || v === "active" || v === "matched" || v === "pending" || v === "blocked";
}

// A match = the business confirmed (status past pending); "active" = a match that is still running
export function isMatchedStatus(status: string | null | undefined): boolean {
  return !!status && !["pending", "rejected", "cancelled"].includes(status);
}
export function isActiveStatus(status: string | null | undefined): boolean {
  return isMatchedStatus(status) && status !== "completed";
}

// One Hebrew line for the status column
export function connectionStatusLabel(status: string | null | undefined, initiatedBy?: string | null, mutualAt?: string | null): string {
  switch (status) {
    case "pending":
      if (mutualAt) return "מאטץ' — ממתין לאישור העסק";
      return initiatedBy === "brand" ? "לב מהעסק — ממתין ליוצר/ת" : "לב מהיוצר/ת — ממתין לעסק";
    case "approved":
      return "אושר — צ'אט פתוח";
    case "shipped":
      return "המוצר נשלח";
    case "delivered":
      return "המוצר הגיע";
    case "filming":
      return "בצילום";
    case "uploaded":
    case "in_review":
      return "סרטון בבדיקת העסק";
    case "revision_requested":
      return "נדרש תיקון";
    case "completed":
      return "הושלם";
    case "cancelled":
      return "בוטל";
    case "rejected":
      return "נדחה";
    default:
      return status || "—";
  }
}

export function applyConnectionFilter<T extends { status: string | null; blocked_at?: string | null }>(rows: T[], filter: AdminConnectionFilter): T[] {
  switch (filter) {
    case "active":
      return rows.filter((r) => isActiveStatus(r.status) && !r.blocked_at);
    case "matched":
      return rows.filter((r) => isMatchedStatus(r.status));
    case "pending":
      return rows.filter((r) => r.status === "pending");
    case "blocked":
      return rows.filter((r) => !!r.blocked_at);
    default:
      return rows;
  }
}
