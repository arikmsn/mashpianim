import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  isChatOpen,
  hasChatHistory,
  canBrandReview,
  isOccupyingStatus,
  normalizeMaxCreators,
  spotsLeft,
  isProductFull,
  brandBucket,
  heartState,
  flowNextAction,
} from "../src/lib/connection-flow.ts";
import { mapMatchError } from "../src/lib/match-errors.ts";
import { buildBriefMessage, sanitizeBriefData, briefDataLines, hasBriefContent } from "../src/lib/brief.ts";
import { pickProductUpdates, toPublicProduct } from "../src/lib/authz.ts";

describe("chat lifecycle", () => {
  test("open from match until the connection closes", () => {
    for (const s of ["approved", "shipped", "delivered", "filming", "uploaded", "in_review", "revision_requested"]) {
      assert.equal(isChatOpen(s), true, s);
    }
    for (const s of ["pending", "completed", "cancelled", "rejected", null, undefined, 42]) {
      assert.equal(isChatOpen(s), false, String(s));
    }
  });

  test("closed connections keep a read-only chat only if they were matched", () => {
    assert.equal(hasChatHistory({ status: "completed", approved_at: "2026-11-02T20:00:00Z" }), true);
    assert.equal(hasChatHistory({ status: "cancelled", approved_at: "2026-11-02T20:00:00Z" }), true);
    assert.equal(hasChatHistory({ status: "cancelled", approved_at: null }), false); // withdrawn heart
    assert.equal(hasChatHistory({ status: "rejected" }), false);
    assert.equal(hasChatHistory({ status: "shipped" }), true);
  });
});

describe("brand review (FLOW-01)", () => {
  test("the brand reviews right after upload, or after the optional admin step", () => {
    assert.equal(canBrandReview("uploaded"), true);
    assert.equal(canBrandReview("in_review"), true);
    for (const s of ["filming", "delivered", "completed", "revision_requested", ""]) assert.equal(canBrandReview(s), false, s);
  });
});

describe("brief message", () => {
  const base = { name: "שרשרת לגבר", price: 149, product_type: "physical", description: "שרשרת כסף" };

  test("without a brand brief: the fill-in template with the description", () => {
    const text = buildBriefMessage(base);
    assert.match(text, /📦 בריף — שרשרת לגבר/);
    assert.match(text, /שווי: ₪149 · פיזי/);
    assert.match(text, /מה המוצר: שרשרת כסף/);
    assert.match(text, /\(העסק ישלים\)/);
    assert.match(text, /זכויות שימוש/);
  });

  test("with a brand brief: the brand's text replaces the template, format lines stay", () => {
    const text = buildBriefMessage({ ...base, brief: "  להדגיש את הסוגר המגנטי. בלי מוזיקה ברקע.  " });
    assert.match(text, /להדגיש את הסוגר המגנטי\. בלי מוזיקה ברקע\./);
    assert.doesNotMatch(text, /\(העסק ישלים\)/);
    assert.match(text, /פורמט: וידאו/);
    assert.doesNotMatch(text, /^ {2}/m);
  });

  test("blank brief falls back to the template; digital products are labelled", () => {
    assert.match(buildBriefMessage({ ...base, brief: "   " }), /\(העסק ישלים\)/);
    assert.match(buildBriefMessage({ name: "קורס", price: 99, product_type: "digital" }), /₪99 · דיגיטלי/);
  });
});

describe("creator slots per product (BRAND-01)", () => {
  test("every status from the match on occupies a slot; hearts and closed-without-match don't", () => {
    for (const s of ["approved", "shipped", "delivered", "filming", "uploaded", "in_review", "revision_requested", "completed"]) {
      assert.equal(isOccupyingStatus(s), true, s);
    }
    for (const s of ["pending", "cancelled", "rejected", null]) assert.equal(isOccupyingStatus(s), false, String(s));
  });

  test("max_creators is optional: null/junk = no limit, numbers are clamped to 1–50", () => {
    assert.equal(normalizeMaxCreators(undefined), null);
    assert.equal(normalizeMaxCreators(null), null);
    assert.equal(normalizeMaxCreators("abc"), null);
    assert.equal(normalizeMaxCreators(0), null);
    assert.equal(normalizeMaxCreators("5"), 5);
    assert.equal(normalizeMaxCreators(7.9), 7);
    assert.equal(normalizeMaxCreators(999), 50);
  });

  test("spots left never goes negative; no limit reads as null and is never full", () => {
    assert.equal(spotsLeft(3, 0), 3);
    assert.equal(spotsLeft(3, 2), 1);
    assert.equal(spotsLeft(3, 3), 0);
    assert.equal(spotsLeft(3, 9), 0);
    assert.equal(spotsLeft(null, 1), null);
    assert.equal(isProductFull(3, 3), true);
    assert.equal(isProductFull(3, 2), false);
    assert.equal(isProductFull(null, 500), false);
  });

  test("the database refusal maps to a 409", () => {
    const r = mapMatchError("P0001: PRODUCT_FULL");
    assert.equal(r.status, 409);
    assert.match(r.error, /מלא/);
  });

  test("brands edit max_creators within 1–50; null clears the limit; 0 and junk are dropped", () => {
    assert.deepEqual(pickProductUpdates({ max_creators: "4" }), { max_creators: 4 });
    assert.deepEqual(pickProductUpdates({ max_creators: 0 }), {});
    assert.deepEqual(pickProductUpdates({ max_creators: 500 }), { max_creators: 50 });
    assert.deepEqual(pickProductUpdates({ max_creators: null }), { max_creators: null });
    assert.equal(toPublicProduct({ id: "1", max_creators: 3, spots_left: 2, occupied: 1 }).spots_left, 2);
  });
});

describe("hearts, mutual hearts and the brand's lists (2026-11-04)", () => {
  test("pending hearts fall into the three brand lists, the rest into active / done", () => {
    assert.equal(brandBucket({ status: "pending", initiated_by: "creator" }), "chose_you");
    assert.equal(brandBucket({ status: "pending", initiated_by: "brand" }), "my_list");
    assert.equal(brandBucket({ status: "pending", initiated_by: "creator", mutual_at: "2026-11-04T10:00:00Z" }), "match");
    assert.equal(brandBucket({ status: "pending", initiated_by: "brand", mutual_at: "2026-11-04T10:00:00Z" }), "match");
    for (const s of ["approved", "shipped", "delivered", "filming", "uploaded", "in_review", "revision_requested"]) {
      assert.equal(brandBucket({ status: s }), "active", s);
    }
    for (const s of ["completed", "cancelled", "rejected"]) assert.equal(brandBucket({ status: s }), "done", s);
  });

  test("each side knows whether a heart waits on it", () => {
    assert.equal(heartState({ initiated_by: "creator" }, "brand"), "needs_me");
    assert.equal(heartState({ initiated_by: "creator" }, "creator"), "waiting_other");
    assert.equal(heartState({ initiated_by: "brand" }, "creator"), "needs_me");
    assert.equal(heartState({ initiated_by: "brand", mutual_at: "x" }, "brand"), "match");
  });

  test("the next-action line explains the mutual state to both sides", () => {
    const brand = flowNextAction("pending", "brand", { initiatedBy: "creator", mutual: true });
    assert.equal(brand.mine, true);
    assert.match(brand.text, /אשרו את החיבור/);
    const creator = flowNextAction("pending", "creator", { initiatedBy: "brand", mutual: true });
    assert.equal(creator.mine, false);
    assert.match(creator.text, /אישור הסופי של העסק/);
    assert.match(flowNextAction("pending", "brand", { initiatedBy: "creator" }).text, /לב בחזרה/);
  });
});

describe("structured brief (migration 015)", () => {
  test("only known sections and options survive; empty input clears", () => {
    const data = sanitizeBriefData({
      types: ["אנבוקסינג", "לא קיים", 7],
      length: ["30–60 שנ'"],
      bogus: ["x"],
      messages: "  להגיד שהמוצר ללא סוכר  ",
    });
    assert.deepEqual(data, { types: ["אנבוקסינג"], length: ["30–60 שנ'"], messages: "להגיד שהמוצר ללא סוכר" });
    assert.equal(sanitizeBriefData({ types: [], messages: "   " }), null);
    assert.equal(sanitizeBriefData("text"), null);
    assert.equal(sanitizeBriefData(null), null);
  });

  test("renders one line per section plus the key messages", () => {
    const lines = briefDataLines({ types: ["אנבוקסינג", "שימוש / הדגמה"], platforms: ["TikTok"], messages: "בלי סוכר" });
    assert.deepEqual(lines, ["סוג הסרטון: אנבוקסינג, שימוש / הדגמה", "פלטפורמת יעד: TikTok", "מסרים מרכזיים:", "בלי סוכר"]);
    assert.equal(hasBriefContent(null, ""), false);
    assert.equal(hasBriefContent(null, "הערה"), true);
    assert.equal(hasBriefContent({ types: ["אנבוקסינג"] }, null), true);
  });

  test("the chat message carries the structured brief and the notes; a chosen format replaces the default line", () => {
    const text = buildBriefMessage({
      name: "סרום",
      price: 120,
      product_type: "physical",
      brief: "בלי מוזיקה",
      brief_data: { types: ["אנבוקסינג"], length: ["60–90 שנ'"] },
    });
    assert.match(text, /סוג הסרטון: אנבוקסינג/);
    assert.match(text, /אורך הסרטון: 60–90 שנ'/);
    assert.match(text, /הערות מהעסק:\nבלי מוזיקה/);
    assert.doesNotMatch(text, /פורמט: וידאו 15–45/);
    assert.match(text, /זכויות שימוש/);
    // no picks at all → the old template
    assert.match(buildBriefMessage({ name: "x", brief_data: { types: [] } }), /(העסק ישלים)/);
  });

  test("brands edit brief_data and a custom category through the allowlist", () => {
    assert.deepEqual(pickProductUpdates({ brief_data: { types: ["אנבוקסינג"], junk: 1 } }), { brief_data: { types: ["אנבוקסינג"] } });
    assert.deepEqual(pickProductUpdates({ brief_data: null }), { brief_data: null });
    assert.deepEqual(pickProductUpdates({ brief_data: "text" }), {});
    assert.deepEqual(pickProductUpdates({ category_custom: "  מוצרי   טבע  " }), { category_custom: "מוצרי טבע" });
    assert.deepEqual(pickProductUpdates({ category_custom: "" }), { category_custom: null });
    // a typed value that is a feed category is not a custom label
    assert.deepEqual(pickProductUpdates({ category_custom: "ביוטי" }), { category_custom: null });
    // the shop link never reaches creators
    assert.equal("source_url" in toPublicProduct({ id: "1", source_url: "https://shop" }), false);
    assert.equal(toPublicProduct({ id: "1", category_custom: "מוצרי טבע" }).category_custom, "מוצרי טבע");
  });
});

describe("brief on products", () => {
  test("brands can edit it, creators never see it in public product data", () => {
    assert.deepEqual(pickProductUpdates({ brief: "טקסט", category: "x" }), { brief: "טקסט" });
    assert.deepEqual(pickProductUpdates({ brief: null }), { brief: null });
    assert.equal("brief" in toPublicProduct({ id: "1", name: "x", brief: "secret" }), false);
  });
});
