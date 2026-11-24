// "24.11.2026, 00:05" in Israel time for an ISO timestamp; "" when missing or unparsable (admin lists)
export function formatDateTimeHe(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Hebrew date echo for native date inputs: the browser labels its picker in its own language, so the
// chosen yyyy-mm-dd value is repeated next to the field as "3 בדצמבר 2026" (pure, unit-tested).
export function formatDateHe(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });
}
