import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any, any, any, any, any>;

// Timelines the admin can tune in /admin/settings (site_settings row id "timelines").
export interface Timelines {
  shipping_days: number;
  filming_days: number;
  review_days: number;
  max_revisions: number;
}

export const DEFAULT_TIMELINES: Timelines = {
  shipping_days: 7,
  filming_days: 10,
  review_days: 7,
  max_revisions: 2,
};

function positiveInt(value: unknown, fallback: number, max: number): number {
  if (value === undefined || value === null || value === "") return fallback;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  return i >= 0 && i <= max ? i : fallback;
}

// Pure: tolerates missing keys, strings from the admin form, and junk
export function parseTimelines(data: unknown): Timelines {
  const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  return {
    shipping_days: Math.max(1, positiveInt(d.shipping_days, DEFAULT_TIMELINES.shipping_days, 365)),
    filming_days: Math.max(1, positiveInt(d.filming_days, DEFAULT_TIMELINES.filming_days, 365)),
    review_days: Math.max(1, positiveInt(d.review_days, DEFAULT_TIMELINES.review_days, 365)),
    max_revisions: positiveInt(d.max_revisions, DEFAULT_TIMELINES.max_revisions, 10),
  };
}

export async function getTimelineSettings(admin: Admin): Promise<Timelines> {
  try {
    const { data } = await admin.from("site_settings").select("data").eq("id", "timelines").maybeSingle();
    return parseTimelines((data as { data?: unknown } | null)?.data);
  } catch {
    return { ...DEFAULT_TIMELINES };
  }
}
