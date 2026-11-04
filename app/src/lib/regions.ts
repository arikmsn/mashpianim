// Regions of Israel a business can declare (feed filter "אזור בארץ"); pure, unit-tested.
export const ISRAEL_REGIONS = [
  "צפון",
  "חיפה והקריות",
  "השרון",
  "המרכז",
  "תל אביב",
  "ירושלים והסביבה",
  "השפלה",
  "הדרום",
  "אילת",
  "יהודה ושומרון",
  "כל הארץ / אונליין",
] as const;

export type Region = (typeof ISRAEL_REGIONS)[number];

export function isRegion(value: unknown): value is Region {
  return typeof value === "string" && (ISRAEL_REGIONS as readonly string[]).includes(value);
}

// null when empty or not in the list
export function cleanRegion(value: unknown): Region | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return isRegion(t) ? t : null;
}
