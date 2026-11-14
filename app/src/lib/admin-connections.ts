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

// --- Transcript (batch B) ---------------------------------------------------------------------------------

export type MessageSide = "creator" | "brand" | "system" | "admin";

// Which side of the connection a message belongs to in the admin transcript. System rows are the app's own
// markers; a sender that is neither party is an admin (chat block / release markers carry the admin's id).
export function messageSide(
  m: { sender_id?: string | null; is_system?: boolean | null },
  creatorUserId: string | null | undefined,
  brandUserId: string | null | undefined
): MessageSide {
  if (m.is_system) return "system";
  if (m.sender_id && m.sender_id === creatorUserId) return "creator";
  if (m.sender_id && m.sender_id === brandUserId) return "brand";
  return "admin";
}

// `\b` knows only Latin word characters, so Hebrew words get their own boundary: not glued to other Hebrew letters
const HEB = "[\u0590-\u05FF]";
function hebWord(alternatives: string): string {
  return `(?:^|[^${HEB.slice(1, -1)}])(?:${alternatives})(?:$|[^${HEB.slice(1, -1)}])`;
}

// Hebrew and English digit words — a phone number dictated word by word slips past the digit patterns
const DIGIT_WORDS =
  "אפס|אחת|אחד|שתיים|שניים|שתים|שלוש|שלושה|ארבע|ארבעה|חמש|חמישה|שש|שישה|שבע|שבעה|שמונה|תשע|תשעה|zero|one|two|three|four|five|six|seven|eight|nine";
const DICTATED_PHONE = new RegExp(`(?:(?:^|[^${HEB.slice(1, -1)}a-z])(?:${DIGIT_WORDS})(?=$|[^${HEB.slice(1, -1)}a-z])[\s,\-.]*){5,}`, "i");

// A channel outside the platform, by name (substrings are fine for the brand names; short Hebrew words are bounded)
const CHANNEL_WORDS = new RegExp(
  [
    "וואטסאפ|ווטסאפ|וואצאפ|ווצאפ|whats ?app|טלגרם|telegram|אינסטגרם|אינסטה|insta(?:gram)?\b|טיקטוק|tik ?tok|פייסבוק|facebook|מסנג'ר|messenger|סנאפצ'אט|snapchat|לינקדאין|linkedin",
    "אימייל|אי-מייל|e-?mail|gmail|ג'ימייל|ג׳ימייל|hotmail|outlook|yahoo|\bsms\b|\bdm\b|הודעה פרטית|המספר שלי|מספר שלי|תשמור את המספר|תשמרי את המספר",
    hebWord("מייל|סמס|טלפון|פלאפון|תתקשר|תתקשרי|תתקשרו|להתקשר|אתקשר|חייג|חייגי|תחייג|תחייגי"),
  ].join("|"),
  "i"
);

// Phrasing that moves the conversation off the platform
const OFF_PLATFORM = new RegExp(
  [
    "מחוץ ל(?:אפליקציה|מערכת|פלטפורמה|אתר)|לא דרך ה(?:אפליקציה|מערכת|אתר|פלטפורמה)|בלי ה(?:אפליקציה|מערכת|פלטפורמה)",
    "ישירות (?:איתי|אליי|אלי|אלינו|אליך|אלייך|מולי)|נדבר בחוץ|נמשיך בחוץ",
    hebWord("בפרטי|באישי"),
  ].join("|"),
  "i"
);

// An address spelled out ("שטרודל", "נקודה קום", "(at)") or a bare domain
const SPELLED_ADDRESS = /שטרודל|כרוכית|\(at\)|\[at\]|\bat\s+gmail|נקודה\s*(?:קום|com)|דוט\s*(?:קום|com)|\bdot\s*com\b/i;
const BARE_DOMAIN = /\b[a-z0-9][a-z0-9-]{1,62}\.(?:com|co\.il|org\.il|net|org|io|me|ee|link|site|online|app|biz|info)\b/i;

// Why a chat message deserves an admin's second look: the hard hits the send-time filter names (`hardHits`, a
// message that got through the filter cannot carry them, but older rows can), plus the evasions the filter lets
// through — a number with odd spacing or in words, a channel name, off-platform phrasing, a spelled-out address,
// a bare domain. Empty = nothing suspicious.
export function contactWarnings(text: string | null | undefined, hardHits: (t: string) => string[] = () => []): string[] {
  const t = (text || "").trim();
  if (!t) return [];
  const out = new Set<string>(hardHits(t));
  const digits = t.replace(/[\s\-.()\u05BE\u2010-\u2015]/g, "");
  if (/(?:^|\D)(?:0|972|\+972)5\d{8}(?:\D|$)/.test(digits) || /(?:^|\D)(?:0|972|\+972)[2-4789]\d{7}(?:\D|$)/.test(digits)) {
    out.add("מספר טלפון (ברווחים או בסימנים)");
  }
  if (DICTATED_PHONE.test(t)) out.add("מספר טלפון במילים");
  if (CHANNEL_WORDS.test(t)) out.add("אזכור של ערוץ קשר חיצוני");
  if (OFF_PLATFORM.test(t)) out.add("הצעה לעבור לערוץ חיצוני");
  if (SPELLED_ADDRESS.test(t)) out.add("כתובת אימייל במילים");
  if (BARE_DOMAIN.test(t)) out.add("קישור / דומיין");
  return [...out];
}
