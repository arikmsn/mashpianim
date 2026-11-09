import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { brandRevealedToCreator, hideBrand } from "../src/lib/connection-flow.ts";
import { toPublicProduct } from "../src/lib/authz.ts";

describe("who the business is (owner's rule, 2026-11-09)", () => {
  test("hidden until the business chose the creator", () => {
    assert.equal(brandRevealedToCreator(null), false);
    assert.equal(brandRevealedToCreator(undefined), false);
    // her own heart, unanswered / declined / withdrawn
    assert.equal(brandRevealedToCreator({ status: "pending", initiated_by: "creator", mutual_at: null }), false);
    assert.equal(brandRevealedToCreator({ status: "rejected", initiated_by: "creator" }), false);
    assert.equal(brandRevealedToCreator({ status: "cancelled", initiated_by: "creator", approved_at: null }), false);
  });

  test("revealed by a heart from the business, a heart back, or the match", () => {
    assert.equal(brandRevealedToCreator({ status: "pending", initiated_by: "brand" }), true);
    assert.equal(brandRevealedToCreator({ status: "pending", initiated_by: "creator", mutual_at: "2026-11-09T10:00:00Z" }), true);
    for (const s of ["approved", "shipped", "delivered", "filming", "uploaded", "in_review", "revision_requested", "completed"]) {
      assert.equal(brandRevealedToCreator({ status: s, initiated_by: "creator" }), true, s);
    }
    // a match that was later cancelled still had a chat — the business was already known
    assert.equal(brandRevealedToCreator({ status: "cancelled", initiated_by: "creator", approved_at: "2026-11-09T10:00:00Z" }), true);
  });

  test("the hidden product shape keeps the product, drops the business, and survives the public allowlist", () => {
    const hidden = hideBrand({ id: "p1", name: "שרשרת", brand_name: "מגנוליה", brand_user_id: "u1", logo_url: "https://x/logo.png", brand_region: "תל אביב", brand_revealed: true });
    assert.equal(hidden.brand_name, "");
    assert.equal(hidden.brand_user_id, null);
    assert.equal(hidden.logo_url, null);
    assert.equal(hidden.brand_revealed, false);
    assert.equal(hidden.brand_region, "תל אביב");
    const pub = toPublicProduct(hidden);
    assert.equal(pub.brand_revealed, false);
    assert.equal(pub.name, "שרשרת");
  });
});
