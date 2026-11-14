const PHONE_PATTERNS = [
  /0[5]\d[-\s]?\d{3}[-\s]?\d{4}/g,
  /\+972[-\s]?\d{1,2}[-\s]?\d{3}[-\s]?\d{4}/g,
  /972[-\s]?\d{1,2}[-\s]?\d{3}[-\s]?\d{4}/g,
];

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const SOCIAL_URL_PATTERNS = [
  /(?:https?:\/\/)?(?:www\.)?instagram\.com\/[a-zA-Z0-9_.]+/gi,
  /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@?[a-zA-Z0-9_.]+/gi,
  /(?:https?:\/\/)?(?:www\.)?facebook\.com\/[a-zA-Z0-9_.]+/gi,
  /(?:https?:\/\/)?wa\.me\/\d+/gi,
  /(?:https?:\/\/)?t\.me\/[a-zA-Z0-9_]+/gi,
  /(?:https?:\/\/)?(?:www\.)?twitter\.com\/[a-zA-Z0-9_]+/gi,
  /(?:https?:\/\/)?(?:www\.)?x\.com\/[a-zA-Z0-9_]+/gi,
];

const SOCIAL_HANDLE_PATTERN = /@[a-zA-Z0-9_.]{3,30}\b/g;

// One pass over the text: each kind of contact detail is masked in turn, so a later pattern never re-reads an
// earlier hit (the "@" of a masked e-mail address is not a social handle). Shared by the send-time filter and
// the admin's detection so both name the same reasons.
function scan(text: string): { filtered: string; reasons: string[] } {
  let filtered = text;
  const reasons: string[] = [];

  for (const pattern of PHONE_PATTERNS) {
    if (pattern.test(filtered)) {
      reasons.push("מספר טלפון");
      filtered = filtered.replace(pattern, "***");
    }
    pattern.lastIndex = 0;
  }

  if (EMAIL_PATTERN.test(filtered)) {
    reasons.push("כתובת אימייל");
    filtered = filtered.replace(EMAIL_PATTERN, "***");
    EMAIL_PATTERN.lastIndex = 0;
  }

  for (const pattern of SOCIAL_URL_PATTERNS) {
    if (pattern.test(filtered)) {
      reasons.push("קישור לרשת חברתית");
      filtered = filtered.replace(pattern, "***");
    }
    pattern.lastIndex = 0;
  }

  if (SOCIAL_HANDLE_PATTERN.test(filtered)) {
    reasons.push("שם משתמש ברשת חברתית");
    filtered = filtered.replace(SOCIAL_HANDLE_PATTERN, "***");
    SOCIAL_HANDLE_PATTERN.lastIndex = 0;
  }

  return { filtered, reasons: [...new Set(reasons)] };
}

// Detection only (no masking): which kinds of contact details the text carries, in the order the filter names
// them. Used by the admin transcript to flag messages; `filterContactInfo` keeps blocking at send time.
export function detectContactInfo(text: string): string[] {
  return scan(text).reasons;
}

export function filterContactInfo(text: string): {
  filtered: string;
  blocked: boolean;
  reason?: string;
} {
  const { filtered, reasons } = scan(text);
  if (reasons.length > 0) {
    return {
      filtered,
      blocked: true,
      reason: `לא ניתן לשתף פרטי קשר אישיים (${reasons.join(", ")})`,
    };
  }
  return { filtered, blocked: false };
}
