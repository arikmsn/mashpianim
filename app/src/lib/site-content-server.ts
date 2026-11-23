// Server side of the content registry: reads the admin's overrides from `site_content`, merges them over the
// schema defaults (lib/site-content.ts) and fills the {variables} from the stats section and site_settings.
// No cookies are touched, so server components can stay static (ISR, revalidate = 60) and the admin's save
// makes the new text appear through revalidatePath.

import { createClient } from "@supabase/supabase-js";
import { TERMS_VERSION } from "./legal";
import { getCreditPrices, getFirstPurchaseDiscount, getTimelineSettings } from "./settings";
import { contentVars, mergeSiteContent, resolveSiteContent, type ContentVars, type SiteContent } from "./site-content";

export interface SiteContentMeta {
  [sectionId: string]: { updated_at: string | null; updated_by: string | null; updated_by_name: string | null };
}

export interface SiteContentRows {
  rows: Record<string, unknown>;
  meta: SiteContentMeta;
}

function publicClient() {
  const url = process.env.NEXT_SUPABASE_URL;
  const key = process.env.SUPABASE_SEC_KEY || process.env.NEXT_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function adminClient() {
  const url = process.env.NEXT_SUPABASE_URL;
  const key = process.env.SUPABASE_SEC_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// The stored rows as they are (section id → data) plus who saved them and when
export async function loadSiteContentRows(): Promise<SiteContentRows> {
  const client = publicClient();
  if (!client) return { rows: {}, meta: {} };
  try {
    const { data, error } = await client.from("site_content").select("id, data, updated_at, updated_by");
    if (error || !data) return { rows: {}, meta: {} };
    const rows: Record<string, unknown> = {};
    const meta: SiteContentMeta = {};
    const editorIds = new Set<string>();
    for (const row of data as { id: string; data: unknown; updated_at: string | null; updated_by: string | null }[]) {
      rows[row.id] = row.data;
      meta[row.id] = { updated_at: row.updated_at || null, updated_by: row.updated_by || null, updated_by_name: null };
      if (row.updated_by) editorIds.add(row.updated_by);
    }
    // The editors' names, when we may read users (service role)
    const admin = adminClient();
    if (admin && editorIds.size) {
      const { data: users } = await admin.from("users").select("id, full_name").in("id", [...editorIds]);
      const names = new Map(((users || []) as { id: string; full_name: string | null }[]).map((u) => [u.id, u.full_name]));
      for (const m of Object.values(meta)) if (m.updated_by) m.updated_by_name = names.get(m.updated_by) || null;
    }
    return { rows, meta };
  } catch {
    return { rows: {}, meta: {} };
  }
}

// The variables the public pages substitute ({price_min}, {discount}, {days}); counts come from the content itself
export async function loadContentSettings(): Promise<{ priceMin: number | null; discount: number | null; days: number | null }> {
  const admin = adminClient();
  if (!admin) return { priceMin: null, discount: null, days: null };
  try {
    const [prices, discount, timelines] = await Promise.all([getCreditPrices(admin), getFirstPurchaseDiscount(admin), getTimelineSettings(admin)]);
    return { priceMin: prices.single, discount, days: timelines.filming_days };
  } catch {
    return { priceMin: null, discount: null, days: null };
  }
}

export interface LoadedSiteContent {
  // Merged and with the variables filled in: what the pages render
  content: SiteContent;
  // Merged, variables left as {name}: what the admin edits
  raw: SiteContent;
  vars: ContentVars;
  meta: SiteContentMeta;
}

export async function getSiteContent(): Promise<LoadedSiteContent> {
  const [{ rows, meta }, settings] = await Promise.all([loadSiteContentRows(), loadContentSettings()]);
  const raw = mergeSiteContent(rows);
  const vars = contentVars(raw, settings);
  return { content: resolveSiteContent(raw, vars), raw, vars, meta };
}

// The terms version users must have accepted: the admin's stored version (bumped on a material change) or the
// code constant. Used by the acceptance route and by the gate.
export async function getTermsVersion(): Promise<string> {
  const { rows } = await loadSiteContentRows();
  const stored = rows.legal_terms;
  const v = stored && typeof stored === "object" ? (stored as { version?: unknown }).version : null;
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : TERMS_VERSION;
}
