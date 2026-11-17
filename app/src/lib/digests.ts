// WhatsApp digests instead of one message per event (owner, 2026-11-16, after the number was restricted for
// "automated or bulk messages"): creators hear once a day about the businesses that chose them, businesses get a
// weekly summary of the creators who chose their products. Each heart is announced once; messages go out at a
// quiet hour, a few per cron run, with a pause between them. Pure helpers, unit-tested; the sends live in
// lib/digests-server.ts.

export type DigestMode = "off" | "dry" | "on";

// WHATSAPP_DIGESTS: off (default) | dry (compose + log, send nothing — review in /admin/messages) | on
export function digestMode(env: { [key: string]: string | undefined } = process.env): DigestMode {
  const v = (env.WHATSAPP_DIGESTS || "").trim().toLowerCase();
  if (v === "on") return "on";
  if (v === "dry") return "dry";
  return "off";
}

export const ISRAEL_TZ = "Asia/Jerusalem";
export const CREATOR_DIGEST_HOUR = 18; // 18:00–18:59 Israel time, every day
export const BRAND_DIGEST_HOUR = 10; // 10:00–10:59 Israel time …
export const BRAND_DIGEST_WEEKDAY = 0; // … on Sundays
export const HEART_WINDOW_DAYS = 7; // hearts expire after a week, so older ones are never announced
export const SENDS_PER_RUN = 25; // the cron runs every 15 minutes; the rest goes out on the next run of the hour
export const SEND_GAP_MS = 700;

export function localParts(now: Date, timeZone: string = ISRAEL_TZ): { hour: number; weekday: number; dateKey: string } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hour12: false, weekday: "short" }).formatToParts(now);
  const hourRaw = Number(parts.find((p) => p.type === "hour")?.value || "0");
  const hour = hourRaw === 24 ? 0 : hourRaw;
  const weekdayName = parts.find((p) => p.type === "weekday")?.value || "Sun";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekdayName);
  return { hour, weekday: weekday < 0 ? 0 : weekday, dateKey: now.toLocaleDateString("en-CA", { timeZone }) };
}

export function creatorDigestDue(now: Date, timeZone: string = ISRAEL_TZ): boolean {
  return localParts(now, timeZone).hour === CREATOR_DIGEST_HOUR;
}

export function brandDigestDue(now: Date, timeZone: string = ISRAEL_TZ): boolean {
  const p = localParts(now, timeZone);
  return p.weekday === BRAND_DIGEST_WEEKDAY && p.hour === BRAND_DIGEST_HOUR;
}

export interface HeartForDigest {
  connectionId: string;
  brandName: string;
  productName: string;
  createdAt: string;
}

// Hearts not yet announced in an earlier digest (announced ids come from message_log.meta.heart_ids)
export function newHeartsFor(hearts: HeartForDigest[], announced: ReadonlySet<string>): HeartForDigest[] {
  return hearts.filter((h) => !announced.has(h.connectionId));
}

function firstName(name: string | null | undefined): string {
  return (name || "").trim().split(/\s+/)[0] || "";
}

// "💗 היי דנה! 2 עסקים סימנו אותך …" — one line per heart, newest first, at most 6 listed
export function creatorDigestText(name: string | null | undefined, hearts: HeartForDigest[], appUrl: string): string {
  const n = hearts.length;
  const who = firstName(name);
  const greeting = who ? `היי ${who}!` : "היי!";
  const headline = n === 1 ? "עסק אחד סימן אותך במשפיען אונליין:" : `${n} עסקים סימנו אותך במשפיען אונליין:`;
  const sorted = [...hearts].sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
  const lines = sorted.slice(0, 6).map((h) => `• ${h.brandName} — "${h.productName}"`);
  if (sorted.length > 6) lines.push(`• ועוד ${sorted.length - 6}…`);
  return `💗 ${greeting}\n${headline}\n${lines.join("\n")}\n\nכל לב מחכה 7 ימים. היכנסי לאשר או לדחות:\n${appUrl}/connections`;
}

export interface BrandDigestNumbers {
  newHearts: number; // creators who chose the business's products this week
  waitingMutual: number; // matches waiting for the business's confirmation
  waitingTotal: number; // every unanswered creator heart
}

export function brandDigestText(shopName: string | null | undefined, n: BrandDigestNumbers, appUrl: string): string {
  const shop = (shopName || "").trim();
  const lines: string[] = [`📊 *סיכום שבועי${shop ? ` — ${shop}` : ""}*`];
  lines.push(n.newHearts === 1 ? "💗 יוצר/ת אחד/ת סימן/ה את המוצרים שלכם השבוע" : `💗 ${n.newHearts} יוצרים סימנו את המוצרים שלכם השבוע`);
  if (n.waitingMutual > 0) lines.push(n.waitingMutual === 1 ? "🎉 מאטץ' אחד מחכה לאישורכם" : `🎉 ${n.waitingMutual} מאטצ'ים מחכים לאישורכם`);
  if (n.waitingTotal > 0) lines.push(n.waitingTotal === 1 ? "⏳ לב אחד עדיין בלי תשובה" : `⏳ ${n.waitingTotal} לבבות עדיין בלי תשובה`);
  lines.push("", "היכנסו לבחור יוצרים ולהתחיל שיתופי פעולה:", `${appUrl}/brand/connections`);
  return lines.join("\n");
}

// A business gets the weekly summary when something happened: a new heart this week or a match waiting
export function brandDigestWorthSending(n: BrandDigestNumbers): boolean {
  return n.newHearts > 0 || n.waitingMutual > 0;
}

// --- SMS for phones with no WhatsApp chat (owner, 2026-11-17) ---------------------------------------------
// A WhatsApp digest may only go into an existing chat (lib/otp-channel.ts WHATSAPP_KNOWN_BEFORE); creators and
// businesses without one get a short SMS instead (one UCS-2 segment, ≤ 70 characters, no emoji) — unless
// DIGEST_SMS=off, in which case they are skipped. The short links /c and /b are redirects in next.config.ts.
export function digestSmsEnabled(env: { [key: string]: string | undefined } = process.env): boolean {
  return (env.DIGEST_SMS || "").trim().toLowerCase() !== "off";
}

export const DIGEST_SMS_MAX_CHARS = 70;
export const SMS_LINK_CREATOR = "mashpian.online/c"; // → /connections
export const SMS_LINK_BRAND = "mashpian.online/b"; // → /brand/connections

export function creatorDigestSms(count: number): string {
  const who = count === 1 ? "עסק אחד סימן אותך" : `${count} עסקים סימנו אותך`;
  return `משפיען: ${who}! יש לך 7 ימים לאשר: ${SMS_LINK_CREATOR}`;
}

// "ו-" before a number, "ו" before a word
function and(s: string): string {
  return /^\d/.test(s) ? `ו-${s}` : `ו${s}`;
}

export function brandDigestSms(n: BrandDigestNumbers): string {
  const parts: string[] = [];
  if (n.newHearts > 0) parts.push(n.newHearts === 1 ? "יוצר/ת סימן/ה אתכם" : `${n.newHearts} יוצרים סימנו אתכם`);
  if (n.waitingMutual > 0) parts.push(n.waitingMutual === 1 ? "מאטץ' אחד מחכה" : `${n.waitingMutual} מאטצ'ים מחכים`);
  const what = parts.length === 2 ? `${parts[0]} ${and(parts[1])}` : parts[0] || "יש חדש בחיבורים שלכם";
  return `משפיען: ${what}: ${SMS_LINK_BRAND}`;
}
