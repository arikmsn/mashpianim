// Pure pieces of the rate limiter (no framework imports, unit-tested).

export interface RateLimitRule {
  limit: number;
  windowSeconds: number;
}

// Per-phone limits are the real abuse lever (3 OTP sends per 10 min per number). The per-IP limits are
// deliberately loose since 2026-11-10: creators sign up in groups from one venue, and Israeli mobile carriers
// put many phones behind one CGNAT address, so a tight per-IP limit blocks real people before it blocks an
// attacker (the WhatsApp cost of a spray is still bounded per number).
export const RATE_LIMITS = {
  sendOtpPhone: { limit: 3, windowSeconds: 10 * 60 },
  sendOtpIp: { limit: 40, windowSeconds: 10 * 60 },
  verifyOtpPhone: { limit: 10, windowSeconds: 10 * 60 },
  verifyOtpIp: { limit: 120, windowSeconds: 10 * 60 },
  devLoginIp: { limit: 10, windowSeconds: 15 * 60 },
  registerIp: { limit: 60, windowSeconds: 60 * 60 },
  // In-app reports (bugs / requests / contact) per signed-in user
  feedbackUser: { limit: 5, windowSeconds: 60 * 60 },
} as const satisfies Record<string, RateLimitRule>;

// First hop of x-forwarded-for (set by Vercel), else x-real-ip, else "unknown"
export function clientIp(headers: { get(name: string): string | null }): string {
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first;
  return headers.get("x-real-ip")?.trim() || "unknown";
}

// "<scope>:<subject>" — subject normalised and bounded so a hostile header can't bloat the key
export function rateLimitKey(scope: string, subject: string): string {
  const cleaned = String(subject || "unknown").trim().toLowerCase().slice(0, 200);
  return `${scope}:${cleaned || "unknown"}`;
}

export function retryAfterMessage(retryAfterSeconds: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return minutes === 1 ? "יותר מדי ניסיונות. נסו שוב בעוד דקה." : `יותר מדי ניסיונות. נסו שוב בעוד ${minutes} דקות.`;
}
