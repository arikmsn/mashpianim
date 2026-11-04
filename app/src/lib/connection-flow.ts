// Pure rules of the connection lifecycle shared by API routes and pages (no framework imports, unit-tested).

export type FlowRole = "creator" | "brand";

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

// Connections that occupy one of a product's creator slots (max_creators): everything from the match on
export const OCCUPYING_STATUSES = [...CHAT_OPEN_STATUSES, "completed"] as const;

export function isOccupyingStatus(status: unknown): boolean {
  return typeof status === "string" && (OCCUPYING_STATUSES as readonly string[]).includes(status);
}

// A product's creator limit is optional since 2026-11-04: null = no limit, the brand decides per match
export function normalizeMaxCreators(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(50, Math.floor(n));
}

// null = unlimited
export function spotsLeft(maxCreators: unknown, occupied: number): number | null {
  const max = normalizeMaxCreators(maxCreators);
  if (max === null) return null;
  return Math.max(0, max - Math.max(0, occupied || 0));
}

export function isProductFull(maxCreators: unknown, occupied: number): boolean {
  const left = spotsLeft(maxCreators, occupied);
  return left !== null && left <= 0;
}

// --- Hearts and the brand's lists -------------------------------------------------------------------
// A connection starts as a heart (pending). Both sides hearting = a match waiting for the brand's
// confirmation (mutual_at set, status still pending). The brand confirming (match_connection) deducts
// one credit, sets approved and opens the chat.

export type BrandBucket = "chose_you" | "my_list" | "match" | "active" | "done";

export const BRAND_BUCKETS: { id: BrandBucket; label: string; empty: string }[] = [
  { id: "chose_you", label: "בחרו בך", empty: "עדיין אף יוצר/ת לא סימן/ה אתכם — הוסיפו מוצרים ושלחו לבבות" },
  { id: "my_list", label: "הרשימה שלי", empty: "אין לבבות שממתינים לתשובת היוצרים" },
  { id: "match", label: "מאטץ'", empty: "אין מאטצ'ים שממתינים לאישורכם" },
  { id: "active", label: "פעילים", empty: "אין חיבורים פעילים" },
  { id: "done", label: "הסתיימו", empty: "אין חיבורים שהסתיימו" },
];

export function brandBucket(conn: { status: unknown; initiated_by?: unknown; mutual_at?: unknown }): BrandBucket {
  const status = typeof conn.status === "string" ? conn.status : "";
  if (status === "pending") {
    if (conn.mutual_at) return "match";
    return conn.initiated_by === "brand" ? "my_list" : "chose_you";
  }
  if ((CHAT_OPEN_STATUSES as readonly string[]).includes(status)) return "active";
  return "done";
}

// What a pending heart means for the viewer; "match" = both hearted, the brand confirms
export type HeartState = "waiting_other" | "needs_me" | "match";

export function heartState(conn: { initiated_by?: unknown; mutual_at?: unknown }, role: FlowRole): HeartState {
  if (conn.mutual_at) return "match";
  const mine = (conn.initiated_by === "brand" ? "brand" : "creator") === role;
  return mine ? "waiting_other" : "needs_me";
}

// The brand reviews a deliverable as soon as it is uploaded; the admin step (in_review) is optional (FLOW-01)
export const BRAND_REVIEW_STATUSES = ["uploaded", "in_review"] as const;

export function canBrandReview(status: unknown): boolean {
  return typeof status === "string" && (BRAND_REVIEW_STATUSES as readonly string[]).includes(status);
}

// --- Journey timeline (product page, connection cards) ---------------------------------------------

// The five milestones both sides see; "shipped"/"delivered" read as access sent/received for digital products
export const FLOW_STEPS = [
  { key: "match", label: "מאטץ'" },
  { key: "shipped", label: "משלוח" },
  { key: "delivered", label: "קבלה" },
  { key: "uploaded", label: "סרטון" },
  { key: "completed", label: "אישור" },
] as const;

const STEP_BY_STATUS: Record<string, number> = {
  approved: 0,
  shipped: 1,
  delivered: 2,
  filming: 2,
  uploaded: 3,
  in_review: 3,
  revision_requested: 3,
  completed: 4,
};

// Index of the last milestone reached (-1 before the match or when the connection never got going)
export function flowStepIndex(status: unknown): number {
  if (typeof status !== "string") return -1;
  return STEP_BY_STATUS[status] ?? -1;
}

// One line per side saying what happens next; `mine` = this side has to act
export function flowNextAction(
  status: unknown,
  role: FlowRole,
  opts: { initiatedBy?: string | null; deliveryType?: string | null; mutual?: boolean } = {}
): { text: string; mine: boolean } {
  const digital = opts.deliveryType === "digital";
  const s = typeof status === "string" ? status : "";
  switch (s) {
    case "pending":
      if (opts.mutual) {
        return role === "creator"
          ? { text: "יש מאטץ'! ממתינים לאישור הסופי של העסק", mine: false }
          : { text: "יש מאטץ' — אשרו את החיבור כדי להתחיל (סרטון אחד מהחבילה)", mine: true };
      }
      if (opts.initiatedBy === "brand") {
        return role === "creator"
          ? { text: "העסק סימן אתכם — אשרו אם מתאים לכם", mine: true }
          : { text: "ממתינים לתשובת היוצר/ת", mine: false };
      }
      return role === "creator"
        ? { text: "הלב נשלח — ממתינים לתשובת העסק", mine: false }
        : { text: "היוצר/ת בחר/ה בכם — סמנו לב בחזרה", mine: true };
    case "approved":
      return role === "brand"
        ? { text: digital ? "שלחו את פרטי הגישה" : "שלחו את המוצר ועדכנו מספר מעקב", mine: true }
        : { text: digital ? "ממתינים לפרטי הגישה מהעסק" : "ממתינים למשלוח מהעסק", mine: false };
    case "shipped":
      return role === "creator"
        ? { text: digital ? "אשרו שקיבלתם את הגישה" : "אשרו קבלה כשהמוצר מגיע", mine: true }
        : { text: digital ? "ממתינים לאישור קבלת הגישה" : "המוצר בדרך — ממתינים לאישור קבלה", mine: false };
    case "delivered":
    case "filming":
      return role === "creator"
        ? { text: "צלמו והעלו את הסרטון", mine: true }
        : { text: "היוצר/ת מצלם/ת — הסרטון יופיע כאן", mine: false };
    case "uploaded":
    case "in_review":
      return role === "brand"
        ? { text: "צפו בסרטון ואשרו או בקשו תיקון", mine: true }
        : { text: "הסרטון אצל העסק לבדיקה", mine: false };
    case "revision_requested":
      return role === "creator"
        ? { text: "העסק ביקש תיקון — העלו גרסה מתוקנת", mine: true }
        : { text: "ממתינים לגרסה מתוקנת מהיוצר/ת", mine: false };
    case "completed":
      return { text: "החיבור הושלם — הסרטון אושר", mine: false };
    case "cancelled":
      return { text: "החיבור בוטל", mine: false };
    case "rejected":
      return { text: "הלב נדחה", mine: false };
    default:
      return { text: "", mine: false };
  }
}

// Which deadline is running for the current status (shown next to the timeline)
export function activeDeadlineField(status: unknown): "ship_deadline" | "deliver_deadline" | "film_deadline" | "review_deadline" | null {
  switch (status) {
    case "approved":
      return "ship_deadline";
    case "shipped":
      return "deliver_deadline";
    case "delivered":
    case "filming":
    case "revision_requested":
      return "film_deadline";
    case "uploaded":
    case "in_review":
      return "review_deadline";
    default:
      return null;
  }
}
