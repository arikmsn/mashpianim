import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isChatOpen, hasChatHistory, canBrandReview } from "../src/lib/connection-flow.ts";
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

describe("brief on products", () => {
  test("brands can edit it, creators never see it in public product data", () => {
    assert.deepEqual(pickProductUpdates({ brief: "טקסט", category: "x" }), { brief: "טקסט" });
    assert.deepEqual(pickProductUpdates({ brief: null }), { brief: null });
    assert.equal("brief" in toPublicProduct({ id: "1", name: "x", brief: "secret" }), false);
  });
});
