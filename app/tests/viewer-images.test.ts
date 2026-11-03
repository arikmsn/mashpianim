import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { effectiveRole } from "../src/lib/viewer.ts";
import { toDirectImageUrl, driveFileId } from "../src/lib/images.ts";

describe("effective role", () => {
  test("creators and brands are themselves; admins act on the side they have a profile for", () => {
    assert.equal(effectiveRole("creator", null, "b"), "creator");
    assert.equal(effectiveRole("brand", "c", null), "brand");
    assert.equal(effectiveRole("admin", "c", "b"), "creator");
    assert.equal(effectiveRole("admin", null, "b"), "brand");
    assert.equal(effectiveRole("admin", null, null), "creator");
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
