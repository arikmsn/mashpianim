import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { clientIp, rateLimitKey, retryAfterMessage, RATE_LIMITS } from "../src/lib/rate-limit-core.ts";

function headers(map: Record<string, string>) {
  return { get: (name: string) => map[name.toLowerCase()] ?? null };
}

describe("client IP extraction", () => {
  test("takes the first hop of x-forwarded-for", () => {
    assert.equal(clientIp(headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" })), "203.0.113.9");
  });
  test("falls back to x-real-ip, then unknown", () => {
    assert.equal(clientIp(headers({ "x-real-ip": "198.51.100.2" })), "198.51.100.2");
    assert.equal(clientIp(headers({})), "unknown");
    assert.equal(clientIp(headers({ "x-forwarded-for": " , " })), "unknown");
  });
});

describe("rate limit keys", () => {
  test("scope + normalised subject", () => {
    assert.equal(rateLimitKey("send-otp:phone", "+972500000001"), "send-otp:phone:+972500000001");
    assert.equal(rateLimitKey("dev-login:ip", "  203.0.113.9 "), "dev-login:ip:203.0.113.9");
  });
  test("empty or hostile subjects are bounded", () => {
    assert.equal(rateLimitKey("x", ""), "x:unknown");
    assert.equal(rateLimitKey("x", "A".repeat(500)).length, 2 + 200);
  });
  test("rules are positive", () => {
    for (const [name, rule] of Object.entries(RATE_LIMITS)) {
      assert.ok(rule.limit > 0 && rule.windowSeconds > 0, name);
    }
  });
});

describe("retry message", () => {
  test("rounds up to whole minutes", () => {
    assert.match(retryAfterMessage(30), /דקה/);
    assert.match(retryAfterMessage(61), /2 דקות/);
    assert.match(retryAfterMessage(600), /10 דקות/);
  });
});
