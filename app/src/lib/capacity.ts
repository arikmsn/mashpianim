// Supabase capacity watch (pure, unit-tested). The admin dashboard shows the gauge and the daily cron warns
// the admins when storage or the database nears the plan limit, so the upgrade happens before uploads fail.
// Egress (bandwidth) is not measurable from SQL — only the Supabase dashboard shows it.

const KB = 1024;
const MB = 1024 * KB;
const GB = 1024 * MB;

export type SupabasePlan = "free" | "pro";

// The project moved to Pro on 2026-11-10 (owner); the limits below are the plan's included quotas
export const SUPABASE_PLAN: SupabasePlan = "pro";

export const PLAN_LIMITS: Record<SupabasePlan, { label: string; storageBytes: number; dbBytes: number }> = {
  free: { label: "Free", storageBytes: 1 * GB, dbBytes: 500 * MB },
  pro: { label: "Pro", storageBytes: 100 * GB, dbBytes: 8 * GB },
};

export const WARN_RATIO = 0.7;
export const CRITICAL_RATIO = 0.9;

// What platform_usage() (migration 014) returns
export interface PlatformUsage {
  db_bytes: number;
  storage_bytes: number;
  storage_objects?: number;
  videos_bytes?: number;
  measured_at?: string;
}

export type CapacityLevel = "ok" | "warn" | "critical";

export interface CapacityGauge {
  used: number;
  limit: number;
  ratio: number; // 0..1+
  level: CapacityLevel;
}

export interface CapacityStatus {
  plan: SupabasePlan;
  planLabel: string;
  level: CapacityLevel;
  storage: CapacityGauge;
  db: CapacityGauge;
  // Hebrew line for the notification / dashboard; null when everything is fine
  message: string | null;
}

export function formatBytes(bytes: number): string {
  const n = Math.max(0, Number(bytes) || 0);
  if (n >= GB) return `${(n / GB).toFixed(n >= 10 * GB ? 0 : 1)} GB`;
  if (n >= MB) return `${Math.round(n / MB)} MB`;
  if (n >= KB) return `${Math.round(n / KB)} KB`;
  return `${n} B`;
}

function levelFor(ratio: number): CapacityLevel {
  if (ratio >= CRITICAL_RATIO) return "critical";
  if (ratio >= WARN_RATIO) return "warn";
  return "ok";
}

function gauge(used: number, limit: number): CapacityGauge {
  const u = Math.max(0, Number(used) || 0);
  const ratio = limit > 0 ? u / limit : 0;
  return { used: u, limit, ratio, level: levelFor(ratio) };
}

export function capacityStatus(usage: PlatformUsage, plan: SupabasePlan = SUPABASE_PLAN): CapacityStatus {
  const limits = PLAN_LIMITS[plan];
  const storage = gauge(usage.storage_bytes, limits.storageBytes);
  const db = gauge(usage.db_bytes, limits.dbBytes);
  const worst: CapacityLevel = storage.level === "critical" || db.level === "critical"
    ? "critical"
    : storage.level === "warn" || db.level === "warn" ? "warn" : "ok";

  const parts: string[] = [];
  if (storage.level !== "ok") parts.push(`אחסון הקבצים ב-${Math.round(storage.ratio * 100)}% (${formatBytes(storage.used)} מתוך ${formatBytes(storage.limit)})`);
  if (db.level !== "ok") parts.push(`מסד הנתונים ב-${Math.round(db.ratio * 100)}% (${formatBytes(db.used)} מתוך ${formatBytes(db.limit)})`);

  let message: string | null = null;
  if (parts.length > 0) {
    const tail = worst === "critical"
      ? "העלאות ייכשלו בקרוב — יש לשדרג את תוכנית Supabase עכשיו."
      : "מומלץ לשדרג את תוכנית Supabase בימים הקרובים.";
    message = `${parts.join("; ")}. ${tail}`;
  }

  return { plan, planLabel: limits.label, level: worst, storage, db, message };
}
