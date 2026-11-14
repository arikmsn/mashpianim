import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { CHAT_BLOCKED_TEXT, CHAT_BLOCKED_CODE, chatBlockedSubject, isChatBlocked } from "../src/lib/chat-block.ts";
import { CHAT_NOTIFICATION_TYPES } from "../src/lib/chat.ts";
import { detectContactInfo, filterContactInfo } from "../src/lib/moderation/chat-filter.ts";

describe("chat block (owner list 2026-11-14, item 5)", () => {
  test("the sentence both sides see is the owner's", () => {
    assert.equal(CHAT_BLOCKED_TEXT, "המערכת עצרה את ההתקשרות, יש לפנות לבירור");
    assert.equal(CHAT_BLOCKED_CODE, "chat_blocked");
  });

  test("blocked = blocked_at set", () => {
    assert.equal(isChatBlocked(null), false);
    assert.equal(isChatBlocked({}), false);
    assert.equal(isChatBlocked({ blocked_at: null }), false);
    assert.equal(isChatBlocked({ blocked_at: "" }), false);
    assert.equal(isChatBlocked({ blocked_at: "2026-11-14T10:00:00Z" }), true);
  });

  test("contact-form subject names the product when known", () => {
    assert.equal(chatBlockedSubject("קרם לחות"), "בירור על עצירת ההתקשרות — קרם לחות");
    assert.equal(chatBlockedSubject("  "), "בירור על עצירת ההתקשרות");
    assert.equal(chatBlockedSubject(null), "בירור על עצירת ההתקשרות");
  });

  test("the block / release notifications open the chat", () => {
    assert.equal(CHAT_NOTIFICATION_TYPES.has("chat_blocked"), true);
    assert.equal(CHAT_NOTIFICATION_TYPES.has("chat_unblocked"), true);
  });
});

describe("chat filter detection (no masking)", () => {
  test("names what the text carries, in filter order", () => {
    assert.deepEqual(detectContactInfo("תתקשרי 050-1234567"), ["מספר טלפון"]);
    assert.deepEqual(detectContactInfo("me@example.com ו-instagram.com/someone"), ["כתובת אימייל", "קישור לרשת חברתית"]);
    assert.deepEqual(detectContactInfo("@my.handle"), ["שם משתמש ברשת חברתית"]);
    assert.deepEqual(detectContactInfo("הסרטון יהיה מוכן ביום שלישי"), []);
  });

  test("detection agrees with the send-time filter", () => {
    for (const t of ["050-1234567", "a@b.co", "tiktok.com/@x", "@handle_1", "שלום, מה שלומך?"]) {
      assert.equal(detectContactInfo(t).length > 0, filterContactInfo(t).blocked, t);
    }
  });
});
