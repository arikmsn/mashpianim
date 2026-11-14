import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { aggregateCreators, displayName, formatFollowers, lastSeenLabel, matchesSearch, isMatched } from "../src/lib/admin-creators.ts";

describe("admin creators helpers (owner list, 2026-11-14)", () => {
  test("counts split portfolio / taken down / collaboration, hearts from businesses and matches", () => {
    const videos = [
      { creator_id: "u1", connection_id: null, status: "approved" },
      { creator_id: "u1", connection_id: null, status: "pending" },
      { creator_id: "u1", connection_id: null, status: "rejected" },
      { creator_id: "u1", connection_id: "c1", status: "approved" },
      { creator_id: "u2", connection_id: "c2", status: "uploaded" },
      { creator_id: null, connection_id: null, status: "approved" },
    ];
    const connections = [
      { creator_id: "p1", initiated_by: "brand", status: "pending" },
      { creator_id: "p1", initiated_by: "creator", status: "approved" },
      { creator_id: "p1", initiated_by: "brand", status: "completed" },
      { creator_id: "p2", initiated_by: "creator", status: "cancelled" },
      { creator_id: "p9", initiated_by: "brand", status: "approved" }, // unknown profile → ignored
    ];
    const agg = aggregateCreators(videos, connections, { p1: "u1", p2: "u2" });
    assert.deepEqual(agg.u1, { videosPortfolio: 2, videosRemoved: 1, videosCollab: 1, heartsFromBrands: 2, matches: 2 });
    assert.deepEqual(agg.u2, { videosPortfolio: 0, videosRemoved: 0, videosCollab: 1, heartsFromBrands: 0, matches: 0 });
    assert.equal(agg.u9, undefined);
    assert.equal(isMatched("pending"), false);
    assert.equal(isMatched("shipped"), true);
  });

  test("display name falls back to the phone, never to undefined (the old screen crashed on it)", () => {
    assert.equal(displayName("עדי", "+972585979474"), "עדי");
    assert.equal(displayName("  ", "+972585979474"), "ללא שם (+972585979474)");
    assert.equal(displayName(null, null), "ללא שם");
  });

  test("followers and last-seen labels", () => {
    assert.equal(formatFollowers(950), "950");
    assert.equal(formatFollowers(12500), "12.5K");
    assert.equal(formatFollowers(2000), "2K");
    assert.equal(formatFollowers(1_500_000), "1.5M");
    assert.equal(formatFollowers(null), "0");
    const now = new Date("2026-11-14T12:00:00Z");
    assert.equal(lastSeenLabel(null, now), "אף פעם");
    assert.equal(lastSeenLabel("2026-11-14T08:00:00Z", now), "היום");
    assert.equal(lastSeenLabel("2026-11-13T08:00:00Z", now), "אתמול");
    assert.equal(lastSeenLabel("2026-11-11T08:00:00Z", now), "לפני 3 ימים");
    assert.equal(lastSeenLabel("2026-10-20T08:00:00Z", now), "לפני 3 שבועות");
    assert.equal(lastSeenLabel("2026-08-01T08:00:00Z", now), "לפני 3 חודשים");
  });

  test("search is null-safe and matches name or phone", () => {
    assert.equal(matchesSearch({ name: null, phone: null }, "ע"), false);
    assert.equal(matchesSearch({ name: "עדי", phone: "+972585979474" }, "ע"), true);
    assert.equal(matchesSearch({ name: "עדי", phone: "+972585979474" }, "058-597"), true);
    assert.equal(matchesSearch({ name: "עדי", phone: null }, ""), true);
  });
});
