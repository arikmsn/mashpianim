import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PRODUCT_CATEGORIES, isProductCategory, toFeedCategory, resolveProductCategory } from "../src/lib/categories.ts";
import { pickProductUpdates } from "../src/lib/authz.ts";

describe("product categories", () => {
  test("eight feed categories, matched exactly", () => {
    assert.equal(PRODUCT_CATEGORIES.length, 8);
    assert.equal(isProductCategory("אופנה"), true);
    assert.equal(isProductCategory("אופנה "), false);
    assert.equal(isProductCategory("fashion"), false);
  });

  test("registration categories map onto feed categories", () => {
    assert.equal(toFeedCategory("ביוטי וטיפוח"), "ביוטי");
    assert.equal(toFeedCategory("ניקיון ובית"), "בית וגינה");
    assert.equal(toFeedCategory("חיות מחמד"), "כללי");
    assert.equal(toFeedCategory("ספורט"), "ספורט");
    assert.equal(toFeedCategory("לא קיים"), null);
  });

  test("a product takes the picked category, else the brand's first mapped one, else the default", () => {
    assert.equal(resolveProductCategory("טכנולוגיה", ["אופנה"]), "טכנולוגיה");
    assert.equal(resolveProductCategory("nonsense", ["ניקיון ובית", "אופנה"]), "בית וגינה");
    assert.equal(resolveProductCategory(undefined, ["???"]), "כללי");
    assert.equal(resolveProductCategory(null, []), "כללי");
  });

  test("PUT accepts only a real category and ignores anything else", () => {
    assert.deepEqual(pickProductUpdates({ category: "ביוטי" }), { category: "ביוטי" });
    assert.deepEqual(pickProductUpdates({ category: "whatever" }), {});
    assert.deepEqual(pickProductUpdates({ category: 7 }), {});
  });
});
