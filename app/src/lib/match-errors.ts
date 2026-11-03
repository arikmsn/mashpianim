// Maps errors raised by the match_connection() database function to API responses.
export function mapMatchError(message: string | null | undefined): { error: string; status: number } {
  const m = message || "";
  if (m.includes("NO_CREDITS")) {
    return { error: "לעסק אין סרטונים זמינים כרגע. המאטץ' יישמר וייפתח ברגע שיתווספו סרטונים.", status: 400 };
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
