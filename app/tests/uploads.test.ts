import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_VIDEO_BYTES,
  MAX_VIDEO_MB,
  detectImageType,
  extensionForImage,
  isAllowedVideoType,
  storageUploadErrorMessage,
  videoFileProblem,
} from "../src/lib/uploads.ts";
import { parseTimelines, DEFAULT_TIMELINES } from "../src/lib/settings.ts";

describe("video pre-flight", () => {
  test("accepts common phone formats and unknown (empty) types", () => {
    for (const t of ["video/mp4", "video/quicktime", "video/webm", "VIDEO/MP4", ""]) assert.equal(isAllowedVideoType(t), true, t);
    for (const t of ["image/png", "application/octet-stream", "video/x-matroska"]) assert.equal(isAllowedVideoType(t), false, t);
  });

  test("size limit is reported in Hebrew with the cap", () => {
    assert.equal(videoFileProblem({ size: MAX_VIDEO_BYTES, type: "video/mp4" }), null);
    const msg = videoFileProblem({ size: MAX_VIDEO_BYTES + 1, type: "video/mp4" });
    assert.ok(msg && msg.includes(`${MAX_VIDEO_MB}MB`));
    assert.match(videoFileProblem({ size: 10, type: "image/png" }) || "", /פורמט/);
  });
});

describe("image sniffing", () => {
  test("recognises JPEG, PNG and WebP by magic bytes", () => {
    assert.equal(detectImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0])), "image/jpeg");
    assert.equal(detectImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])), "image/png");
    const webp = new Uint8Array(16);
    [0x52, 0x49, 0x46, 0x46].forEach((b, i) => (webp[i] = b));
    [0x57, 0x45, 0x42, 0x50].forEach((b, i) => (webp[8 + i] = b));
    assert.equal(detectImageType(webp), "image/webp");
  });

  test("rejects anything else, including renamed executables and SVG", () => {
    assert.equal(detectImageType(new Uint8Array([0x4d, 0x5a, 0x90, 0x00])), null); // MZ
    assert.equal(detectImageType(new TextEncoder().encode("<svg xmlns=")), null);
    assert.equal(detectImageType(new Uint8Array([])), null);
  });

  test("extension follows the detected type, not the file name", () => {
    assert.equal(extensionForImage("image/jpeg"), "jpg");
    assert.equal(extensionForImage("image/png"), "png");
    assert.equal(extensionForImage("image/webp"), "webp");
  });
});

describe("storage error messages", () => {
  test("too large / wrong type / auth / generic", () => {
    assert.match(storageUploadErrorMessage(413, ""), /גדול/);
    assert.match(storageUploadErrorMessage(400, '{"message":"The object exceeded the maximum allowed size"}'), /גדול/);
    assert.match(storageUploadErrorMessage(400, '{"message":"mime type video/x-matroska is not supported"}'), /פורמט/);
    assert.match(storageUploadErrorMessage(403, ""), /התחברו/);
    assert.match(storageUploadErrorMessage(500, "boom"), /שגיאה/);
  });
});

describe("timeline settings parsing", () => {
  test("defaults when missing or junk, accepts numbers and numeric strings", () => {
    assert.deepEqual(parseTimelines(null), DEFAULT_TIMELINES);
    assert.deepEqual(parseTimelines({ shipping_days: "5", filming_days: 14, review_days: "x", max_revisions: "0" }), {
      shipping_days: 5,
      filming_days: 14,
      review_days: DEFAULT_TIMELINES.review_days,
      max_revisions: 0,
    });
    assert.equal(parseTimelines({ shipping_days: -3 }).shipping_days, DEFAULT_TIMELINES.shipping_days);
    assert.equal(parseTimelines({ max_revisions: 99 }).max_revisions, DEFAULT_TIMELINES.max_revisions);
  });
});
