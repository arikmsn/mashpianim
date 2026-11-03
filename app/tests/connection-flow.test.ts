import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  isChatOpen,
  hasChatHistory,
  canBrandReview,
  isOccupyingStatus,
  normalizeMaxCreators,
  spotsLeft,
  DEFAULT_MAX_CREATORS,
} from "../src/lib/connection-flow.ts";
import { mapMatchError } from "../src/lib/match-errors.ts";
import { buildBriefMessage } from "../src/lib/brief.ts";
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

  test("max_creators falls back to the default and is clamped to 1–50", () => {
    assert.equal(normalizeMaxCreators(undefined), DEFAULT_MAX_CREATORS);
    assert.equal(normalizeMaxCreators("abc"), DEFAULT_MAX_CREATORS);
    assert.equal(normalizeMaxCreators(0), DEFAULT_MAX_CREATORS);
    assert.equal(normalizeMaxCreators("5"), 5);
    assert.equal(normalizeMaxCreators(7.9), 7);
    assert.equal(normalizeMaxCreators(999), 50);
  });

  test("spots left never goes negative", () => {
    assert.equal(spotsLeft(3, 0), 3);
    assert.equal(spotsLeft(3, 2), 1);
    assert.equal(spotsLeft(3, 3), 0);
    assert.equal(spotsLeft(3, 9), 0);
    assert.equal(spotsLeft(null, 1), DEFAULT_MAX_CREATORS - 1);
  });

  test("the database refusal maps to a 409", () => {
    const r = mapMatchError("P0001: PRODUCT_FULL");
    assert.equal(r.status, 409);
    assert.match(r.error, /מלא/);
  });

  test("brands edit max_creators within 1–50; 0 and junk are dropped", () => {
    assert.deepEqual(pickProductUpdates({ max_creators: "4" }), { max_creators: 4 });
    assert.deepEqual(pickProductUpdates({ max_creators: 0 }), {});
    assert.deepEqual(pickProductUpdates({ max_creators: 500 }), { max_creators: 50 });
    assert.deepEqual(pickProductUpdates({ max_creators: null }), {});
    assert.equal(toPublicProduct({ id: "1", max_creators: 3, spots_left: 2, occupied: 1 }).spots_left, 2);
  });
});

describe("brief on products", () => {
  test("brands can edit it, creators never see it in public product data", () => {
    assert.deepEqual(pickProductUpdates({ brief: "טקסט", category: "x" }), { brief: "טקסט" });
    assert.deepEqual(pickProductUpdates({ brief: null }), { brief: null });
    assert.equal("brief" in toPublicProduct({ id: "1", name: "x", brief: "secret" }), false);
  });
});
