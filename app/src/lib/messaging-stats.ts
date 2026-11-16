// Counts over the message log for the admin (pure, unit-tested). Days are counted in Israel's time zone, so
// "today" is the owner's today.

export const ISRAEL_TZ = "Asia/Jerusalem";

export interface MessageLogRow {
  channel: string;
  status: string;
  created_at: string;
}

export interface ChannelCounts {
  today: number;
  week: number;
  month: number;
  failed_month: number;
}

export interface MessageCounts {
  sms: ChannelCounts;
  whatsapp: ChannelCounts;
}

export function dayKey(value: string | Date, timeZone: string = ISRAEL_TZ): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA", { timeZone });
}

function empty(): ChannelCounts {
  return { today: 0, week: 0, month: 0, failed_month: 0 };
}

// today = the same local day; week = the last 7 days (rolling); month = the last 30 days (rolling)
export function bucketCounts(rows: MessageLogRow[], now: Date = new Date(), timeZone: string = ISRAEL_TZ): MessageCounts {
  const out: MessageCounts = { sms: empty(), whatsapp: empty() };
  const today = dayKey(now, timeZone);
  const weekAgo = now.getTime() - 7 * 86_400_000;
  const monthAgo = now.getTime() - 30 * 86_400_000;
  for (const r of rows) {
    const bucket = r.channel === "sms" ? out.sms : r.channel === "whatsapp" ? out.whatsapp : null;
    if (!bucket) continue;
    const t = new Date(r.created_at).getTime();
    if (Number.isNaN(t) || t < monthAgo || t > now.getTime() + 60_000) continue;
    if (r.status === "failed") {
      bucket.failed_month += 1;
      continue;
    }
    if (r.status !== "sent") continue; // dry runs are not sends
    bucket.month += 1;
    if (t >= weekAgo) bucket.week += 1;
    if (dayKey(r.created_at, timeZone) === today) bucket.today += 1;
  }
  return out;
}

export interface DailyPoint {
  date: string;
  sms: number;
  whatsapp: number;
  failed: number;
  dry: number;
}

// One row per local day, newest first, for the last `days` days (days with nothing sent included)
export function dailySeries(rows: MessageLogRow[], days: number, now: Date = new Date(), timeZone: string = ISRAEL_TZ): DailyPoint[] {
  const byDay = new Map<string, DailyPoint>();
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getTime() - i * 86_400_000);
    const key = dayKey(d, timeZone);
    byDay.set(key, { date: key, sms: 0, whatsapp: 0, failed: 0, dry: 0 });
  }
  for (const r of rows) {
    const p = byDay.get(dayKey(r.created_at, timeZone));
    if (!p) continue;
    if (r.status === "failed") p.failed += 1;
    else if (r.status === "dry") p.dry += 1;
    else if (r.channel === "sms") p.sms += 1;
    else if (r.channel === "whatsapp") p.whatsapp += 1;
  }
  return [...byDay.values()];
}
