import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { contactWarnings, messageSide } from "../src/lib/admin-connections.ts";
import { detectContactInfo as hardHits } from "../src/lib/moderation/chat-filter.ts";
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

describe("admin transcript (batch B)", () => {
  test("message side", () => {
    assert.equal(messageSide({ sender_id: "c1", is_system: false }, "c1", "b1"), "creator");
    assert.equal(messageSide({ sender_id: "b1", is_system: false }, "c1", "b1"), "brand");
    assert.equal(messageSide({ sender_id: "b1", is_system: true }, "c1", "b1"), "system");
    assert.equal(messageSide({ sender_id: "admin", is_system: false }, "c1", "b1"), "admin");
    assert.equal(messageSide({ sender_id: null }, null, null), "admin");
  });

  test("clean chat talk raises nothing", () => {
    for (const t of [
      "הסרטון יהיה מוכן ביום שלישי",
      "אפשרות 1 מתוך 5, המחיר 199 ש\"ח",
      "נפגשים ב-14:30, הקוד 1234",
      "קיבלתי את החבילה, תודה!",
      "דרוש שינוי: הלוגו לא נראה בפריים",
      "אני מצלמת מחר בבוקר ומעלה עד הערב",
      "ההתקשרות איתכם נעימה מאוד",
      "",
      null,
    ]) {
      assert.deepEqual(contactWarnings(t, hardHits), [], String(t));
    }
  });

  test("hard hits from the send-time filter come first", () => {
    assert.deepEqual(contactWarnings("תתקשרי 050-1234567", hardHits).slice(0, 1), ["מספר טלפון"]);
    assert.ok(contactWarnings("me@example.com", hardHits).includes("כתובת אימייל"));
  });

  test("evasions the filter lets through are flagged", () => {
    assert.ok(contactWarnings("0 5 0 - 1 2 3 4 5 6 7", hardHits).includes("מספר טלפון (ברווחים או בסימנים)"));
    assert.ok(contactWarnings("05.0.12.34.567 תשמרי", hardHits).includes("מספר טלפון (ברווחים או בסימנים)"));
    assert.ok(contactWarnings("אפס חמש אפס אחת שתיים שלוש ארבע", hardHits).includes("מספר טלפון במילים"));
    assert.ok(contactWarnings("zero five zero one two three", hardHits).includes("מספר טלפון במילים"));
    assert.ok(contactWarnings("תשלחי לי בוואטסאפ", hardHits).includes("אזכור של ערוץ קשר חיצוני"));
    assert.ok(contactWarnings("יש לך מייל?", hardHits).includes("אזכור של ערוץ קשר חיצוני"));
    assert.ok(contactWarnings("תתקשר אליי בערב", hardHits).includes("אזכור של ערוץ קשר חיצוני"));
    assert.ok(contactWarnings("נדבר מחוץ לאפליקציה", hardHits).includes("הצעה לעבור לערוץ חיצוני"));
    assert.ok(contactWarnings("תכתבי לי בפרטי", hardHits).includes("הצעה לעבור לערוץ חיצוני"));
    assert.ok(contactWarnings("השם שלי שטרודל ג'ימייל", hardHits).includes("כתובת אימייל במילים"));
    assert.ok(contactWarnings("הכל באתר linktr.ee/me", hardHits).includes("קישור / דומיין"));
  });

  test("Hebrew words are bounded (סמסונג is a phone brand, not an SMS)", () => {
    assert.deepEqual(contactWarnings("צילמתי בסמסונג החדש", hardHits), []);
    assert.deepEqual(contactWarnings("ההתקשרות הזו נעימה", hardHits), []);
  });
});
