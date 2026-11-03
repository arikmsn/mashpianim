import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { availableRoles, effectiveRole } from "../src/lib/viewer.ts";
import { toDirectImageUrl, driveFileId } from "../src/lib/images.ts";

describe("roles an account holds", () => {
  test("type plus profiles decide the available roles", () => {
    assert.deepEqual(availableRoles("creator", "c", null), ["creator"]);
    assert.deepEqual(availableRoles("brand", null, "b"), ["brand"]);
    assert.deepEqual(availableRoles("creator", "c", "b"), ["creator", "brand"]);
    assert.deepEqual(availableRoles("admin", "c", "b"), ["creator", "brand", "admin"]);
    assert.deepEqual(availableRoles("admin", null, null), ["admin"]);
  });
});

describe("effective role of a session", () => {
  test("the chosen role wins when the account holds it", () => {
    assert.equal(effectiveRole("admin", "c", "b", "admin"), "admin");
    assert.equal(effectiveRole("admin", "c", "b", "creator"), "creator");
    assert.equal(effectiveRole("admin", "c", "b", "brand"), "brand");
    assert.equal(effectiveRole("creator", "c", "b", "brand"), "brand");
  });

  test("a role the account doesn't hold is ignored", () => {
    assert.equal(effectiveRole("creator", "c", null, "admin"), "creator");
    assert.equal(effectiveRole("brand", null, "b", "creator"), "brand");
  });

  test("without a choice: own type; admins fall back to the side they have a profile for", () => {
    assert.equal(effectiveRole("creator", null, "b"), "creator");
    assert.equal(effectiveRole("brand", "c", null), "brand");
    assert.equal(effectiveRole("admin", "c", "b"), "creator");
    assert.equal(effectiveRole("admin", null, "b"), "brand");
    assert.equal(effectiveRole("admin", null, null), "admin");
  });
});

describe("product image urls", () => {
  const id = "1-V5WQ8fbebhxmW9orQaEebdpouiuEQHD";

  test("every Google Drive form becomes the embeddable thumbnail url", () => {
    const expected = `https://lh3.googleusercontent.com/d/${id}=w1200`;
    assert.equal(toDirectImageUrl(`https://drive.google.com/file/d/${id}/view?usp=sharing`), expected);
    assert.equal(toDirectImageUrl(`https://drive.google.com/uc?export=view&id=${id}`), expected);
    assert.equal(toDirectImageUrl(`https://drive.google.com/open?id=${id}`), expected);
    assert.equal(toDirectImageUrl(`https://drive.usercontent.google.com/download?id=${id}&export=view`), expected);
    assert.equal(driveFileId("https://example.com/x.jpg"), null);
  });

  test("other urls pass through; blanks become null", () => {
    assert.equal(toDirectImageUrl("https://images.unsplash.com/photo-1?w=400"), "https://images.unsplash.com/photo-1?w=400");
    assert.equal(toDirectImageUrl("  "), null);
    assert.equal(toDirectImageUrl(null), null);
  });
});
