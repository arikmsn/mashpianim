import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  isOwnPortfolioPath,
  isOwnConnectionVideoPath,
  isImagePath,
  thumbnailPathFromUrl,
  canUploadConnectionVideo,
  pickProductUpdates,
  PRODUCT_EDITABLE_FIELDS,
} from "../src/lib/authz.ts";

const UID = "11111111-1111-1111-1111-111111111111";
const OTHER = "99999999-9999-9999-9999-999999999999";
const CONN = "22222222-2222-2222-2222-222222222222";

describe("portfolio storage paths", () => {
  test("accepts a file directly under the caller's own folder", () => {
    assert.equal(isOwnPortfolioPath(`portfolio/${UID}/1730000000000.mp4`, UID), true);
  });

  test("rejects other folders, traversal, nesting, empty segments and non-strings", () => {
    assert.equal(isOwnPortfolioPath(`portfolio/${OTHER}/x.mp4`, UID), false);
    assert.equal(isOwnPortfolioPath(`portfolio/${UID}/../${OTHER}/x.mp4`, UID), false);
    assert.equal(isOwnPortfolioPath(`portfolio/${UID}/connections/${CONN}/x.mp4`, UID), false);
    assert.equal(isOwnPortfolioPath(`portfolio/${UID}/`, UID), false);
    assert.equal(isOwnPortfolioPath(`portfolio/${UID}//x.mp4`, UID), false);
    assert.equal(isOwnPortfolioPath(`/portfolio/${UID}/x.mp4`, UID), false);
    assert.equal(isOwnPortfolioPath(`${UID}/x.mp4`, UID), false);
    assert.equal(isOwnPortfolioPath(null, UID), false);
    assert.equal(isOwnPortfolioPath(42, UID), false);
    assert.equal(isOwnPortfolioPath(`portfolio/${UID}/x.mp4`, ""), false);
  });
});

describe("connection video storage paths", () => {
  test("accepts portfolio/<uid>/connections/<connection>/<file>", () => {
    assert.equal(isOwnConnectionVideoPath(`portfolio/${UID}/connections/${CONN}/1.mp4`, UID, CONN), true);
    assert.equal(isOwnConnectionVideoPath(`portfolio/${UID}/connections/${CONN}/1.jpg`, UID, CONN), true);
  });

  test("rejects another connection, another user, a plain portfolio path and deeper nesting", () => {
    assert.equal(isOwnConnectionVideoPath(`portfolio/${UID}/connections/${OTHER}/1.mp4`, UID, CONN), false);
    assert.equal(isOwnConnectionVideoPath(`portfolio/${OTHER}/connections/${CONN}/1.mp4`, UID, CONN), false);
    assert.equal(isOwnConnectionVideoPath(`portfolio/${UID}/1.mp4`, UID, CONN), false);
    assert.equal(isOwnConnectionVideoPath(`portfolio/${UID}/connections/${CONN}/a/1.mp4`, UID, CONN), false);
    assert.equal(isOwnConnectionVideoPath(`portfolio/${UID}/connections/${CONN}/1.mp4`, UID, ""), false);
    assert.equal(isOwnConnectionVideoPath(undefined, UID, CONN), false);
  });
});

describe("thumbnail helpers", () => {
  test("recognises image extensions only", () => {
    assert.equal(isImagePath("portfolio/x/1.jpg"), true);
    assert.equal(isImagePath("portfolio/x/1.JPEG"), true);
    assert.equal(isImagePath("portfolio/x/1.webp"), true);
    assert.equal(isImagePath("portfolio/x/1.mp4"), false);
    assert.equal(isImagePath(null), false);
  });

  test("extracts the object path from a public thumbnails URL", () => {
    assert.equal(
      thumbnailPathFromUrl(`https://p.supabase.co/storage/v1/object/public/thumbnails/portfolio/${UID}/1.jpg`),
      `portfolio/${UID}/1.jpg`
    );
    assert.equal(
      thumbnailPathFromUrl(`https://p.supabase.co/storage/v1/object/public/thumbnails/portfolio/${UID}/1.jpg?v=2`),
      `portfolio/${UID}/1.jpg`
    );
    assert.equal(thumbnailPathFromUrl(`https://p.supabase.co/storage/v1/object/sign/videos/portfolio/${UID}/1.mp4`), null);
    assert.equal(thumbnailPathFromUrl(null), null);
  });
});

describe("connection upload statuses", () => {
  test("only after delivery, during filming, or when a revision was requested", () => {
    for (const s of ["delivered", "filming", "revision_requested"]) assert.equal(canUploadConnectionVideo(s), true, s);
    for (const s of ["pending", "approved", "shipped", "uploaded", "in_review", "completed", "cancelled", "rejected"]) {
      assert.equal(canUploadConnectionVideo(s), false, s);
    }
    assert.equal(canUploadConnectionVideo(null), false);
  });
});

describe("product update allowlist (FUNC-02)", () => {
  test("category is not an editable product column", () => {
    assert.equal((PRODUCT_EDITABLE_FIELDS as readonly string[]).includes("category"), false);
    assert.equal((PRODUCT_EDITABLE_FIELDS as readonly string[]).includes("brand_id"), false);
  });

  test("drops category, brand_id and unknown keys; keeps allowed ones with their types", () => {
    const updates = pickProductUpdates({
      name: "שרשרת",
      category: "ביוטי",
      brand_id: OTHER,
      applicants_count: 9,
      max_creators: 4,
      price: "120",
      quantity: null,
      status: "paused",
      description: null,
    });
    assert.deepEqual(updates, { name: "שרשרת", price: 120, quantity: null, status: "paused", description: null, max_creators: 4 });
  });

  test("numeric fields accept numbers and numeric strings; junk and negatives are dropped; price cannot be cleared", () => {
    assert.deepEqual(pickProductUpdates({ price: 49.9, quantity: "3", digital_access_duration_days: 30.7 }), {
      price: 49.9,
      quantity: 3,
      digital_access_duration_days: 30,
    });
    assert.deepEqual(pickProductUpdates({ price: "abc", quantity: -1, digital_access_duration_days: "" }), {
      digital_access_duration_days: null,
    });
    assert.deepEqual(pickProductUpdates({ price: null, price_: 1 }), {});
  });

  test("non-object bodies and objects/booleans yield nothing", () => {
    assert.deepEqual(pickProductUpdates(null), {});
    assert.deepEqual(pickProductUpdates("x"), {});
    assert.deepEqual(pickProductUpdates([{ name: "x" }]), {});
    assert.deepEqual(pickProductUpdates({ name: { $set: "x" }, status: true }), {});
  });
});
