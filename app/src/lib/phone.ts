// Israeli mobile numbers (pure, unit-tested). The app signs people in by WhatsApp OTP, so only a real
// Israeli mobile number is accepted: 05X-XXXXXXX, or the same with the 972 country code.

const ISRAELI_MOBILE_PREFIXES = /^5[0-9]$/; // 050–059

// Returns the E.164 form (+9725XXXXXXXX) or null when the input is not an Israeli mobile number
export function normalizeIsraeliMobile(input: unknown): string | null {
  if (typeof input !== "string") return null;
  let digits = input.replace(/[\s\-().]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (!/^\d+$/.test(digits)) return null;
  if (digits.startsWith("972")) digits = digits.slice(3);
  else if (digits.startsWith("0")) digits = digits.slice(1);
  else return null;
  // What is left must be 5X + 7 digits
  if (digits.length !== 9 || !ISRAELI_MOBILE_PREFIXES.test(digits.slice(0, 2))) return null;
  return `+972${digits}`;
}

export const PHONE_ERROR = "מספר הטלפון לא תקין — הזינו מספר נייד ישראלי (05X-XXXXXXX)";
