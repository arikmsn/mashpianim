// Hebrew date echo for native date inputs: the browser labels its picker in its own language, so the
// chosen yyyy-mm-dd value is repeated next to the field as "3 בדצמבר 2026" (pure, unit-tested).
export function formatDateHe(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });
}
