// Maps errors raised by the match_connection() database function to API responses.
import { CREDITS_CONTACT_NOTICE } from "./credits.ts";

export function mapMatchError(message: string | null | undefined): { error: string; status: number } {
  const m = message || "";
  if (m.includes("NO_CREDITS")) {
    // The brand presses the paid step; until online payment exists the package is loaded by the team
    return { error: `אין סרטונים בחבילה שלכם — ההתאמה נשמרת ותיפתח ברגע שייטענו סרטונים. ${CREDITS_CONTACT_NOTICE}`, status: 400 };
  }
  if (m.includes("CONNECTION_NOT_PENDING")) {
    return { error: "החיבור כבר לא ממתין", status: 400 };
  }
  if (m.includes("PRODUCT_FULL")) {
    return { error: "המוצר כבר מלא — כל מקומות היוצרים למוצר הזה תפוסים.", status: 409 };
  }
  if (m.includes("CONNECTION_NOT_FOUND") || m.includes("BRAND_NOT_FOUND")) {
    return { error: "חיבור לא נמצא", status: 404 };
  }
  return { error: "שגיאה ביצירת המאטץ'", status: 500 };
}

// Postgres unique_violation — a second active heart on the same creator/product pair
export function isUniqueViolation(error: { code?: string } | null | undefined): boolean {
  return !!error && error.code === "23505";
}
