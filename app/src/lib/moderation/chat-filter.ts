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

export function filterContactInfo(text: string): {
  filtered: string;
  blocked: boolean;
  reason?: string;
} {
  let filtered = text;
  let blocked = false;
  const reasons: string[] = [];

  for (const pattern of PHONE_PATTERNS) {
    if (pattern.test(filtered)) {
      blocked = true;
      reasons.push("מספר טלפון");
      filtered = filtered.replace(pattern, "***");
    }
    pattern.lastIndex = 0;
  }

  if (EMAIL_PATTERN.test(filtered)) {
    blocked = true;
    reasons.push("כתובת אימייל");
    filtered = filtered.replace(EMAIL_PATTERN, "***");
    EMAIL_PATTERN.lastIndex = 0;
  }

  for (const pattern of SOCIAL_URL_PATTERNS) {
    if (pattern.test(filtered)) {
      blocked = true;
      reasons.push("קישור לרשת חברתית");
      filtered = filtered.replace(pattern, "***");
    }
    pattern.lastIndex = 0;
  }

  if (SOCIAL_HANDLE_PATTERN.test(filtered)) {
    blocked = true;
    reasons.push("שם משתמש ברשת חברתית");
    filtered = filtered.replace(SOCIAL_HANDLE_PATTERN, "***");
    SOCIAL_HANDLE_PATTERN.lastIndex = 0;
  }

  if (blocked) {
    const unique = [...new Set(reasons)];
    return {
      filtered,
      blocked: true,
      reason: `לא ניתן לשתף פרטי קשר אישיים (${unique.join(", ")})`,
    };
  }

  return { filtered, blocked: false };
}
