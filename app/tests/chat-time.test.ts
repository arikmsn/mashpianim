import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { formatMessageTime, sameDay, dayLabel } from "../src/lib/chat-time.ts";

const TZ = "Asia/Jerusalem";
// A fixed "now": 2026-11-03 20:30 Israel time (UTC+2 in November)
const NOW = new Date("2026-11-03T18:30:00Z");

describe("chat timestamps", () => {
  test("bubble time is hours:minutes in the viewer's zone", () => {
    assert.equal(formatMessageTime("2026-11-03T12:05:00Z", TZ), "14:05");
    assert.equal(formatMessageTime("2026-11-03T22:30:00Z", TZ), "00:30");
    assert.equal(formatMessageTime("not a date", TZ), "");
  });

  test("same day follows the viewer's calendar, not UTC", () => {
    // 23:30 UTC is already the next day in Israel
    assert.equal(sameDay("2026-11-03T10:00:00Z", "2026-11-03T20:00:00Z", TZ), true);
    assert.equal(sameDay("2026-11-03T10:00:00Z", "2026-11-03T23:30:00Z", TZ), false);
    assert.equal(sameDay("garbage", "2026-11-03T10:00:00Z", TZ), false);
  });

  test("day separators read today / yesterday / a date", () => {
    assert.equal(dayLabel("2026-11-03T08:00:00Z", NOW, TZ), "היום");
    assert.equal(dayLabel("2026-11-02T08:00:00Z", NOW, TZ), "אתמול");
    assert.equal(dayLabel("2026-10-28T08:00:00Z", NOW, TZ), "28 באוקטובר");
    assert.equal(dayLabel("2025-12-31T08:00:00Z", NOW, TZ), "31 בדצמבר 2025");
    assert.equal(dayLabel("", NOW, TZ), "");
  });
});
