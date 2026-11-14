import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { applyConnectionFilter, connectionStatusLabel, isActiveStatus, isAdminConnectionFilter, isMatchedStatus } from "../src/lib/admin-connections.ts";

describe("admin connections helpers (owner list, 2026-11-14)", () => {
  test("status lines", () => {
    assert.equal(connectionStatusLabel("pending", "creator", null), "לב מהיוצר/ת — ממתין לעסק");
    assert.equal(connectionStatusLabel("pending", "brand", null), "לב מהעסק — ממתין ליוצר/ת");
    assert.equal(connectionStatusLabel("pending", "creator", "2026-11-14T00:00:00Z"), "מאטץ' — ממתין לאישור העסק");
    assert.equal(connectionStatusLabel("approved"), "אושר — צ'אט פתוח");
    assert.equal(connectionStatusLabel("in_review"), "סרטון בבדיקת העסק");
    assert.equal(connectionStatusLabel("weird"), "weird");
    assert.equal(connectionStatusLabel(null), "—");
  });

  test("matched / active and the list filters", () => {
    assert.equal(isMatchedStatus("pending"), false);
    assert.equal(isMatchedStatus("approved"), true);
    assert.equal(isActiveStatus("completed"), false);
    assert.equal(isActiveStatus("filming"), true);
    const rows = [
      { id: 1, status: "pending", blocked_at: null },
      { id: 2, status: "approved", blocked_at: null },
      { id: 3, status: "completed", blocked_at: null },
      { id: 4, status: "filming", blocked_at: "2026-11-14T00:00:00Z" },
      { id: 5, status: "cancelled", blocked_at: null },
    ];
    assert.deepEqual(applyConnectionFilter(rows, "all").map((r) => r.id), [1, 2, 3, 4, 5]);
    assert.deepEqual(applyConnectionFilter(rows, "active").map((r) => r.id), [2], "running matches that are not blocked");
    assert.deepEqual(applyConnectionFilter(rows, "matched").map((r) => r.id), [2, 3, 4]);
    assert.deepEqual(applyConnectionFilter(rows, "pending").map((r) => r.id), [1]);
    assert.deepEqual(applyConnectionFilter(rows, "blocked").map((r) => r.id), [4]);
    assert.equal(isAdminConnectionFilter("active"), true);
    assert.equal(isAdminConnectionFilter("x"), false);
  });
});
