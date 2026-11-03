// Chat timestamps (pure, unit-tested): the time shown on every bubble and the day separators between
// messages. `timeZone` is only for tests — in the browser the viewer's own zone applies.

function dayKey(d: Date, timeZone?: string): string {
  // en-CA formats as YYYY-MM-DD, which sorts and compares as a plain string
  return d.toLocaleDateString("en-CA", { timeZone });
}

function toDate(value: string | Date): Date | null {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// "14:05" — empty when the value is not a date
export function formatMessageTime(value: string | Date, timeZone?: string): string {
  const d = toDate(value);
  if (!d) return "";
  return d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", timeZone });
}

// Two messages fall on the same calendar day (in the viewer's zone)
export function sameDay(a: string | Date, b: string | Date, timeZone?: string): boolean {
  const da = toDate(a);
  const db = toDate(b);
  if (!da || !db) return false;
  return dayKey(da, timeZone) === dayKey(db, timeZone);
}

// "היום" / "אתמול" / "3 בנובמבר" / "3 בנובמבר 2025" (a different year)
export function dayLabel(value: string | Date, now: Date = new Date(), timeZone?: string): string {
  const d = toDate(value);
  if (!d) return "";
  const key = dayKey(d, timeZone);
  if (key === dayKey(now, timeZone)) return "היום";
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (key === dayKey(yesterday, timeZone)) return "אתמול";
  const sameYear = key.slice(0, 4) === dayKey(now, timeZone).slice(0, 4);
  return d.toLocaleDateString("he-IL", sameYear ? { day: "numeric", month: "long", timeZone } : { day: "numeric", month: "long", year: "numeric", timeZone });
}
