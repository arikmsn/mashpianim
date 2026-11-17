// Which channel carries the login code (owner, 2026-11-12): WhatsApp through GreenAPI, or SMS through Twilio.
// Pure helpers, no framework imports (unit-tested).
//
// Background: the day after launch WhatsApp restricted the business number connected to GreenAPI (an unofficial
// automation) — it could not start new chats, so first-time sign-ups silently never got their code (GreenAPI
// still answered "sent"). SMS is the channel WhatsApp cannot block. The default channel is an env switch
// (OTP_DEFAULT_CHANNEL) so the owner can flip it without a code change; the login screen always offers the
// other channel ("לא קיבלתם? שלחו ב-SMS"), and the server falls back to SMS when the WhatsApp send fails.

export const OTP_CHANNELS = ["whatsapp", "sms"] as const;
export type OtpChannel = (typeof OTP_CHANNELS)[number];

export function isOtpChannel(value: unknown): value is OtpChannel {
  return typeof value === "string" && (OTP_CHANNELS as readonly string[]).includes(value);
}

// OTP_DEFAULT_CHANNEL=sms makes SMS the first choice; anything else keeps WhatsApp first
export function defaultOtpChannel(env: string | undefined | null): OtpChannel {
  return (env || "").trim().toLowerCase() === "sms" ? "sms" : "whatsapp";
}

// What the client asked for wins when valid; otherwise the configured default
export function resolveOtpChannel(requested: unknown, env?: string | null): OtpChannel {
  return isOtpChannel(requested) ? requested : defaultOtpChannel(env);
}

export function otherOtpChannel(channel: OtpChannel): OtpChannel {
  return channel === "sms" ? "whatsapp" : "sms";
}

export function otpChannelLabel(channel: OtpChannel): string {
  return channel === "sms" ? "ב-SMS" : "בוואטסאפ";
}

// One UCS-2 SMS segment holds 70 characters; Hebrew always encodes as UCS-2. No link, no emoji (keeps it short
// and avoids carrier filtering); the code sits at the end so it is easy to spot.
export const OTP_SMS_MAX_CHARS = 70;

export function otpSmsText(code: string): string {
  return `משפיען אונליין: קוד הכניסה שלך ${code}. תקף ל-5 דקות.`;
}

// A Twilio sender is either a number in E.164 or an alphanumeric id: 1–11 characters, letters / digits / spaces,
// at least one letter (so "Mashpian" works, "Mashpian_Online" does not). Checked once at start-up so a wrong
// TWILIO_SMS_FROM shows up as one clear log line instead of a failing send per user.
export function isValidTwilioSender(from: string | null | undefined): boolean {
  if (!from) return false;
  const v = from.trim();
  if (/^\+\d{8,15}$/.test(v)) return true;
  return v.length >= 1 && v.length <= 11 && /^[A-Za-z0-9 ]+$/.test(v) && /[A-Za-z]/.test(v);
}

// Twilio wants E.164 ("+972501234567"); our normaliser may return digits without the plus
export function toE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = String(phone).replace(/[^\d]/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

// --- Smart channel (owner, 2026-11-17: "what can go by WhatsApp goes by WhatsApp, the rest by SMS") ---------
// A WhatsApp send through GreenAPI is only safe into a chat that already exists with our number: the restriction
// of 2026-11-12 was about opening new chats in bulk. A phone counts as a known chat when it got a WhatsApp from
// us before (the message log) or the account was created before the restriction (every code went by WhatsApp
// then). Known chats get the login code by WhatsApp (free); everyone else by SMS (paid, cannot be blocked).
export const WHATSAPP_KNOWN_BEFORE = "2026-11-12T08:00:00Z";

// OTP_SMART_CHANNEL=off disables the routing (then OTP_DEFAULT_CHANNEL alone decides)
export function smartOtpEnabled(env: string | undefined | null): boolean {
  return (env || "").trim().toLowerCase() !== "off";
}

export function phoneDigits(phone: string | null | undefined): string {
  return String(phone || "").replace(/\D/g, "");
}

export function isKnownWhatsAppUser(facts: { createdAt?: string | null; whatsappSent?: boolean }, cutoff: string = WHATSAPP_KNOWN_BEFORE): boolean {
  if (facts.whatsappSent) return true;
  const t = facts.createdAt ? Date.parse(facts.createdAt) : NaN;
  return Number.isFinite(t) && t < Date.parse(cutoff);
}

// The client's explicit choice wins; else a known chat goes by WhatsApp when smart routing is on; else the default
export function chooseOtpChannel(p: { requested?: unknown; defaultEnv?: string | null; smartEnv?: string | null; knownWhatsApp: boolean }): OtpChannel {
  if (isOtpChannel(p.requested)) return p.requested;
  if (smartOtpEnabled(p.smartEnv) && p.knownWhatsApp) return "whatsapp";
  return defaultOtpChannel(p.defaultEnv);
}
