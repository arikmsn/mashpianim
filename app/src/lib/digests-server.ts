// The digests, run from the cron (every 15 minutes) inside their hour windows. Server-only.
// Channel rule (owner, 2026-11-17): WhatsApp only into a chat that already exists with our number
// (lib/whatsapp-known.ts); everyone else gets a short SMS (DIGEST_SMS=off skips them instead). Volume control:
// at most SENDS_PER_RUN messages per run, SEND_GAP_MS apart; each heart is announced once
// (message_log.meta.heart_ids), a business gets one summary a week. WHATSAPP_DIGESTS=dry composes and logs
// everything with status "dry" and sends nothing — the owner reviews the texts in /admin/messages first.
import type { SupabaseClient } from "@supabase/supabase-js";
import { getGreenAPI } from "@/lib/adapters/greenapi";
import { getTwilio } from "@/lib/adapters/twilio";
import { logMessage, type MessageChannel } from "@/lib/message-log";
import { toE164 } from "@/lib/otp-channel";
import { knownWhatsAppPhones } from "@/lib/whatsapp-known";
import {
  HEART_WINDOW_DAYS,
  SENDS_PER_RUN,
  SEND_GAP_MS,
  brandDigestSms,
  brandDigestText,
  brandDigestWorthSending,
  creatorDigestSms,
  creatorDigestText,
  digestSmsEnabled,
  newHeartsFor,
  type DigestMode,
  type HeartForDigest,
} from "@/lib/digests";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any, any, any, any, any>;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.mashpian.online";

export interface DigestRunResult {
  eligible: number;
  sent: number; // WhatsApp sends
  sms: number; // SMS sends (no WhatsApp chat)
  dry: number;
  failed: number;
  skipped: number; // nothing new for them
  skipped_no_channel: number; // no chat and SMS digests off
  error?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function emptyResult(): DigestRunResult {
  return { eligible: 0, sent: 0, sms: 0, dry: 0, failed: 0, skipped: 0, skipped_no_channel: 0 };
}

// Sends (or, in dry mode, only composes) one digest; the caller logs it with its own meta
async function deliver(mode: DigestMode, channel: MessageChannel, phone: string, body: string): Promise<"sent" | "dry" | "failed"> {
  if (mode === "dry") return "dry";
  if (channel === "whatsapp") {
    const api = getGreenAPI();
    if (!api) return "failed";
    const r = await api.sendWhatsApp({ to: phone, body });
    return r.success ? "sent" : "failed";
  }
  const twilio = getTwilio();
  const to = toE164(phone);
  if (!twilio || !to) return "failed";
  const r = await twilio.sendSMS({ to, body });
  return r.success ? "sent" : "failed";
}

function count(out: DigestRunResult, channel: MessageChannel, status: "sent" | "dry" | "failed") {
  if (status === "dry") out.dry += 1;
  else if (status === "failed") out.failed += 1;
  else if (channel === "sms") out.sms += 1;
  else out.sent += 1;
}

// Creators: every unanswered heart a business sent in the last week that no digest mentioned yet
export async function runCreatorDigest(admin: Admin, mode: DigestMode, now: Date = new Date(), limit = SENDS_PER_RUN, gapMs = SEND_GAP_MS): Promise<DigestRunResult> {
  const out = emptyResult();
  const since = new Date(now.getTime() - HEART_WINDOW_DAYS * 86_400_000).toISOString();
  const { data, error } = await admin
    .from("connections")
    .select(`
      id, created_at,
      products(name),
      brand_profiles!connections_brand_id_fkey(shop_name, users(full_name)),
      creator_profiles!connections_creator_id_fkey(user_id, users(id, full_name, phone, is_active))
    `)
    .eq("initiated_by", "brand")
    .eq("status", "pending")
    .is("mutual_at", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) {
    out.error = error.message;
    return out;
  }

  // Group the hearts by creator
  const byCreator = new Map<string, { user: any; hearts: HeartForDigest[] }>();
  for (const c of (data || []) as any[]) {
    const user = c.creator_profiles?.users;
    if (!user?.id || !user.phone || user.is_active === false) continue;
    const entry = byCreator.get(user.id) || { user, hearts: [] };
    entry.hearts.push({
      connectionId: c.id,
      brandName: c.brand_profiles?.shop_name || c.brand_profiles?.users?.full_name || "עסק",
      productName: c.products?.name || "מוצר",
      createdAt: c.created_at,
    });
    byCreator.set(user.id, entry);
  }
  if (byCreator.size === 0) return out;

  // What earlier digests already announced (the last 8 days cover the 7-day heart window)
  const logSince = new Date(now.getTime() - (HEART_WINDOW_DAYS + 1) * 86_400_000).toISOString();
  const { data: logRows, error: logErr } = await admin
    .from("message_log")
    .select("user_id, meta")
    .eq("kind", "digest_creator")
    .in("status", ["sent", "dry"])
    .gte("created_at", logSince)
    .in("user_id", [...byCreator.keys()]);
  if (logErr) {
    // Without the log (migration 023) nothing is deduplicated — refuse rather than spam
    out.error = `message_log: ${logErr.message}`;
    return out;
  }
  const announced = new Map<string, Set<string>>();
  for (const r of (logRows || []) as { user_id: string | null; meta: { heart_ids?: unknown } | null }[]) {
    if (!r.user_id) continue;
    const set = announced.get(r.user_id) || new Set<string>();
    for (const id of Array.isArray(r.meta?.heart_ids) ? (r.meta!.heart_ids as unknown[]) : []) if (typeof id === "string") set.add(id);
    announced.set(r.user_id, set);
  }
  const known = await knownWhatsAppPhones(admin, [...byCreator.values()].map((e) => e.user.phone));
  const smsOk = digestSmsEnabled();

  let sends = 0;
  for (const [userId, { user, hearts }] of byCreator) {
    const fresh = newHeartsFor(hearts, announced.get(userId) || new Set());
    if (fresh.length === 0) {
      out.skipped += 1;
      continue;
    }
    const digits = String(user.phone).replace(/\D/g, "");
    const channel: MessageChannel = known.get(digits) ? "whatsapp" : "sms";
    if (channel === "sms" && !smsOk) {
      out.skipped_no_channel += 1;
      continue;
    }
    out.eligible += 1;
    if (sends >= limit) continue; // the next run of the hour takes the rest
    const body = channel === "whatsapp" ? creatorDigestText(user.full_name, fresh, APP_URL) : creatorDigestSms(fresh.length);
    const status = await deliver(mode, channel, user.phone, body);
    await logMessage({
      channel,
      kind: "digest_creator",
      phone: user.phone,
      userId,
      status,
      meta: { heart_ids: fresh.map((h) => h.connectionId), hearts: fresh.length, text: body },
    });
    count(out, channel, status);
    sends += 1;
    if (mode === "on" && gapMs > 0) await sleep(gapMs);
  }
  return out;
}

// Businesses: one summary a week when creators chose their products or a match waits for them
export async function runBrandDigest(admin: Admin, mode: DigestMode, now: Date = new Date(), limit = SENDS_PER_RUN, gapMs = SEND_GAP_MS): Promise<DigestRunResult> {
  const out = emptyResult();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const { data, error } = await admin
    .from("connections")
    .select(`
      id, created_at, initiated_by, mutual_at,
      brand_profiles!connections_brand_id_fkey(shop_name, users(id, full_name, phone, is_active))
    `)
    .eq("status", "pending")
    .limit(5000);
  if (error) {
    out.error = error.message;
    return out;
  }

  const byBrand = new Map<string, { user: any; shop: string; newHearts: number; waitingMutual: number; waitingTotal: number }>();
  for (const c of (data || []) as any[]) {
    const user = c.brand_profiles?.users;
    if (!user?.id || !user.phone || user.is_active === false) continue;
    const entry = byBrand.get(user.id) || { user, shop: c.brand_profiles?.shop_name || "", newHearts: 0, waitingMutual: 0, waitingTotal: 0 };
    if (c.mutual_at) entry.waitingMutual += 1;
    else if (c.initiated_by === "creator") {
      entry.waitingTotal += 1;
      if (c.created_at >= weekAgo) entry.newHearts += 1;
    }
    byBrand.set(user.id, entry);
  }
  const candidates = [...byBrand.entries()].filter(([, e]) => brandDigestWorthSending(e));
  if (candidates.length === 0) return out;

  const { data: logRows, error: logErr } = await admin
    .from("message_log")
    .select("user_id")
    .eq("kind", "digest_brand")
    .in("status", ["sent", "dry"])
    .gte("created_at", new Date(now.getTime() - 6 * 86_400_000).toISOString())
    .in("user_id", candidates.map(([id]) => id));
  if (logErr) {
    out.error = `message_log: ${logErr.message}`;
    return out;
  }
  const already = new Set(((logRows || []) as { user_id: string | null }[]).map((r) => r.user_id).filter((v): v is string => !!v));
  const known = await knownWhatsAppPhones(admin, candidates.map(([, e]) => e.user.phone));
  const smsOk = digestSmsEnabled();

  let sends = 0;
  for (const [userId, e] of candidates) {
    if (already.has(userId)) {
      out.skipped += 1;
      continue;
    }
    const digits = String(e.user.phone).replace(/\D/g, "");
    const channel: MessageChannel = known.get(digits) ? "whatsapp" : "sms";
    if (channel === "sms" && !smsOk) {
      out.skipped_no_channel += 1;
      continue;
    }
    out.eligible += 1;
    if (sends >= limit) continue;
    const numbers = { newHearts: e.newHearts, waitingMutual: e.waitingMutual, waitingTotal: e.waitingTotal };
    const body = channel === "whatsapp" ? brandDigestText(e.shop, numbers, APP_URL) : brandDigestSms(numbers);
    const status = await deliver(mode, channel, e.user.phone, body);
    await logMessage({
      channel,
      kind: "digest_brand",
      phone: e.user.phone,
      userId,
      status,
      meta: { new_hearts: e.newHearts, waiting_mutual: e.waitingMutual, waiting_total: e.waitingTotal, text: body },
    });
    count(out, channel, status);
    sends += 1;
    if (mode === "on" && gapMs > 0) await sleep(gapMs);
  }
  return out;
}

// What the last digest run did, for /admin/messages (site_settings row "digests_last_run")
export async function recordDigestRun(admin: Admin, summary: Record<string, unknown>): Promise<void> {
  try {
    const { error } = await admin.from("site_settings").upsert({ id: "digests_last_run", data: summary, updated_at: new Date().toISOString() } as any, { onConflict: "id" });
    if (error) console.error("[cron] digests last-run record failed:", error.message);
  } catch (err) {
    console.error("[cron] digests last-run record error:", err);
  }
}
