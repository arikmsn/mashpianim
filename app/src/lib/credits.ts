// Credits — "סרטונים בחבילה" (1 credit = 1 video). Pure helpers shared by the brand screens and API copy;
// no framework imports so they can be unit-tested.
//
// Until the payment provider (SUMIT) is connected there is no self-service purchase (decided by the owner on
// 2026-11-10): every business starts with 0 credits (`brand_profiles.total_credits` defaults to 0 and the register
// route never grants any), and a business that wants a package asks through the in-app contact form. An admin
// then loads the credits in /admin/brands. Every screen that used to say "buy" shows the notice below and leads
// to the contact form (`components/features/credits-access.tsx`).

// The owner's wording, shown wherever a business would otherwise buy
export const CREDITS_CONTACT_NOTICE = "אנא פנו אלינו בצור קשר (שבתוך האתר) לקבלת גישה.";
export const CREDITS_HOW_TO = `רכישת סרטונים עדיין לא מתבצעת דרך האתר. ${CREDITS_CONTACT_NOTICE} נחזור אליכם, נסכם חבילה ונטעין את הסרטונים לחשבון.`;
export const CREDITS_CONTACT_SUBJECT = "רכישת סרטונים — בקשת גישה";

// fresh = never loaded (a new business), empty = the package is used up, last = one left, ok = otherwise
export type CreditsState = "fresh" | "empty" | "last" | "ok";

function count(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

export function creditsRemaining(total: unknown, used: unknown): number {
  return Math.max(0, count(total) - count(used));
}

export function creditsState(total: unknown, used: unknown): CreditsState {
  const remaining = creditsRemaining(total, used);
  if (remaining === 0) return count(total) === 0 ? "fresh" : "empty";
  return remaining === 1 ? "last" : "ok";
}

// One Hebrew sentence about the package, for the credits card and the purchase notice
export function creditsSummary(total: unknown, used: unknown): string {
  switch (creditsState(total, used)) {
    case "fresh":
      return "עדיין אין סרטונים בחבילה שלכם. כדי לאשר חיבור עם יוצר/ת צריך סרטון אחד בחבילה.";
    case "empty":
      return "הסרטונים בחבילה נגמרו.";
    case "last":
      return "נותר סרטון אחד בחבילה.";
    default:
      return `נותרו ${creditsRemaining(total, used)} סרטונים בחבילה.`;
  }
}

// Hint under the credits card: only when the business cannot approve anything (never loaded / used up)
export function creditsCardHint(total: unknown, used: unknown): string | null {
  const state = creditsState(total, used);
  if (state !== "fresh" && state !== "empty") return null;
  return `${creditsSummary(total, used)} ${CREDITS_CONTACT_NOTICE}`;
}
