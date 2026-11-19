import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { HEART_EXPIRY_DAYS, heartClosesWithProduct, heartExpiresUnanswered } from "../src/lib/hearts.ts";

const now = new Date("2026-11-19T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();

describe("heart expiry (owner, 2026-11-19: a creator's heart never expires by time)", () => {
  test("a business's unanswered heart expires after 7 days", () => {
    assert.equal(HEART_EXPIRY_DAYS, 7);
    assert.equal(heartExpiresUnanswered({ status: "pending", initiated_by: "brand", mutual_at: null, created_at: daysAgo(8) }, now), true);
    assert.equal(heartExpiresUnanswered({ status: "pending", initiated_by: "brand", mutual_at: null, created_at: daysAgo(6.9) }, now), false, "still inside the window");
  });
  test("a creator's heart never expires, however old", () => {
    for (const d of [8, 30, 365]) {
      assert.equal(heartExpiresUnanswered({ status: "pending", initiated_by: "creator", mutual_at: null, created_at: daysAgo(d) }, now), false, `${d} days`);
    }
  });
  test("mutual pairs and closed rows are never expired by this rule", () => {
    assert.equal(heartExpiresUnanswered({ status: "pending", initiated_by: "brand", mutual_at: daysAgo(10), created_at: daysAgo(12) }, now), false, "mutual waits for the business");
    assert.equal(heartExpiresUnanswered({ status: "cancelled", initiated_by: "brand", mutual_at: null, created_at: daysAgo(30) }, now), false);
    assert.equal(heartExpiresUnanswered({ status: "pending", initiated_by: "brand", mutual_at: null, created_at: null }, now), false, "no date → leave it");
  });
  test("removing a product closes every heart still waiting on it, nothing else", () => {
    assert.equal(heartClosesWithProduct({ status: "pending" }), true);
    for (const s of ["approved", "shipped", "completed", "cancelled", "rejected"]) assert.equal(heartClosesWithProduct({ status: s }), false, s);
  });
});
