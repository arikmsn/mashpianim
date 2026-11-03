import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { rateLimitKey, retryAfterMessage, type RateLimitRule } from "@/lib/rate-limit-core";

export { RATE_LIMITS, clientIp } from "@/lib/rate-limit-core";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any, any, any, any, any>;

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

// Counts one hit for `<scope>:<subject>` in a fixed window (rate_limit_hit() in the database, migration 009).
// Fails open: if the counter can't be reached the request proceeds and the error is logged.
export async function checkRateLimit(admin: Admin, scope: string, subject: string, rule: RateLimitRule): Promise<RateLimitResult> {
  try {
    const { data, error } = await admin.rpc("rate_limit_hit", {
      p_key: rateLimitKey(scope, subject),
      p_limit: rule.limit,
      p_window_seconds: rule.windowSeconds,
    });
    if (error || !data) {
      console.error("[rate-limit] rpc error:", error?.message || "no data");
      return { allowed: true, retryAfterSeconds: 0 };
    }
    const d = data as { allowed?: boolean; retry_after_seconds?: number };
    return { allowed: d.allowed !== false, retryAfterSeconds: Number(d.retry_after_seconds) || 0 };
  } catch (err) {
    console.error("[rate-limit] error:", err);
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

export function rateLimitedResponse(result: RateLimitResult) {
  const retry = Math.max(1, result.retryAfterSeconds);
  return NextResponse.json(
    { error: retryAfterMessage(retry), code: "rate_limited", retryAfterSeconds: retry },
    { status: 429, headers: { "Retry-After": String(retry) } }
  );
}
