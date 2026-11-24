// The admin's product list and editor (/admin/products, owner 2026-11-24): pure helpers, unit-tested.
import { pickProductUpdates } from "./authz.ts";
import { CLOSED_STATUSES } from "./connection-flow.ts";

export const ADMIN_PRODUCT_FILTERS = ["active", "paused", "deleted", "all"] as const;
export type AdminProductFilter = (typeof ADMIN_PRODUCT_FILTERS)[number];

export function isAdminProductFilter(value: unknown): value is AdminProductFilter {
  return typeof value === "string" && (ADMIN_PRODUCT_FILTERS as readonly string[]).includes(value);
}

export function productStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "active":
      return "פעיל";
    case "paused":
      return "מושהה";
    case "deleted":
      return "הוסר";
    default:
      return status || "—";
  }
}

export function productTypeLabel(type: string | null | undefined): string {
  return type === "digital" ? "דיגיטלי" : "פיזי";
}

// What the admin may change from the editor: the business's editable fields, with the status limited to
// active / paused (removal has its own button and closes the waiting hearts). Unknown keys are ignored.
export function pickAdminProductUpdates(input: unknown): Record<string, unknown> {
  const updates = pickProductUpdates(input);
  if (Object.hasOwn(updates, "status") && updates.status !== "active" && updates.status !== "paused") delete updates.status;
  // The admin never rewires ownership or the legacy link through the editor
  delete updates.source_url;
  // Typed text is trimmed; a product keeps its name when the editor sends an empty one
  for (const key of ["name", "description", "brief", "image_url", "shipping_policy", "shipping_address", "digital_access_instructions"]) {
    if (typeof updates[key] === "string") updates[key] = (updates[key] as string).trim();
  }
  if (updates.name === "") delete updates.name;
  return updates;
}

export interface ProductConnectionRow {
  status: string | null;
  initiated_by?: string | null;
  mutual_at?: string | null;
}

export interface ProductConnectionSummary {
  // Hearts still waiting (either side)
  waiting: number;
  // Matches from the approval on, chat open or finished
  matched: number;
  completed: number;
  closed: number;
}

// Counts for a product's row: waiting hearts, matches (approved and on), completed, closed early
export function summarizeProductConnections(rows: ProductConnectionRow[]): ProductConnectionSummary {
  const out: ProductConnectionSummary = { waiting: 0, matched: 0, completed: 0, closed: 0 };
  for (const r of rows) {
    const s = r.status || "";
    if (s === "pending") out.waiting++;
    else if (s === "completed") {
      out.matched++;
      out.completed++;
    } else if ((CLOSED_STATUSES as readonly string[]).includes(s)) out.closed++;
    else if (s) out.matched++;
  }
  return out;
}

// Null-safe search over product name, business name and phone
export function matchesProductSearch(row: { name?: string | null; shop_name?: string | null; phone?: string | null }, query: string): boolean {
  const q = (query || "").trim().toLowerCase();
  if (!q) return true;
  const hay = [row.name, row.shop_name, row.phone].map((v) => (v || "").toLowerCase());
  const alt = q.startsWith("0") ? `972${q.slice(1)}` : q;
  return hay.some((h) => h.includes(q) || h.includes(alt));
}
