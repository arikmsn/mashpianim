import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isBriefSnapshot, isVideoCard, CHAT_EVENT_TEXTS, FINAL_REVIEW_HOURS } from "../src/lib/chat.ts";
import { ISRAEL_REGIONS, isRegion, cleanRegion } from "../src/lib/regions.ts";

describe("chat cards (migration 016)", () => {
  test("brief and video cards are told apart by their data", () => {
    assert.equal(isBriefSnapshot({ product_name: "סרום", brief_data: null, brief: null, version: 1 }), true);
    assert.equal(isBriefSnapshot({ video_id: "v1" }), false);
    assert.equal(isBriefSnapshot(null), false);
    assert.equal(isVideoCard({ video_id: "v1", round: 2 }), true);
    assert.equal(isVideoCard({ product_name: "x", version: 1 }), false);
    assert.equal(isVideoCard("v1"), false);
  });

  test("the texts the app writes in a person's name", () => {
    assert.equal(CHAT_EVENT_TEXTS.briefApproved, "אישרתי את הבריף");
    assert.equal(CHAT_EVENT_TEXTS.packageReceived, "קיבלתי את החבילה");
    assert.equal(CHAT_EVENT_TEXTS.revisionPrefix, "דרוש שינוי: ");
    assert.equal(FINAL_REVIEW_HOURS, 24);
  });
});

describe("regions of Israel (feed filter)", () => {
  test("a fixed list; anything else clears", () => {
    assert.ok(ISRAEL_REGIONS.length >= 10);
    assert.equal(new Set(ISRAEL_REGIONS).size, ISRAEL_REGIONS.length);
    assert.equal(isRegion("תל אביב"), true);
    assert.equal(isRegion("Tel Aviv"), false);
    assert.equal(cleanRegion(" הדרום "), "הדרום");
    assert.equal(cleanRegion(""), null);
    assert.equal(cleanRegion(42), null);
    assert.equal(cleanRegion("<script>"), null);
  });
});
