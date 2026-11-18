import { test, describe, before } from "node:test";
import assert from "node:assert/strict";

// video-links reads NEXT_SUPABASE_URL once at import time, so set it before importing the module
process.env.NEXT_SUPABASE_URL = "https://proj.supabase.co";
let videoUrl: (p: string | null | undefined) => string | null;
let videoUrls: (paths: (string | null | undefined)[]) => Map<string, string>;
before(async () => {
  ({ videoUrl, videoUrls } = await import("../src/lib/video-links.ts"));
});

describe("public video URLs (owner, 2026-11-18: make the bucket public so the CDN serves the files)", () => {
  test("a storage path becomes the stable /object/public/videos/ URL, segments encoded", () => {
    assert.equal(
      videoUrl("portfolio/abc-123/1794678220986.mp4"),
      "https://proj.supabase.co/storage/v1/object/public/videos/portfolio/abc-123/1794678220986.mp4"
    );
    // A space or other unsafe char in a segment is encoded, slashes kept
    assert.equal(
      videoUrl("portfolio/u 1/clip (1).mov"),
      "https://proj.supabase.co/storage/v1/object/public/videos/portfolio/u%201/clip%20(1).mov"
    );
  });

  test("a value that is already a full URL is returned as-is; blanks are null", () => {
    assert.equal(videoUrl("https://cdn.example.com/x.mp4"), "https://cdn.example.com/x.mp4");
    assert.equal(videoUrl(null), null);
    assert.equal(videoUrl(""), null);
    assert.equal(videoUrl(undefined), null);
  });

  test("the batch keeps one entry per path and drops blanks", () => {
    const map = videoUrls(["portfolio/a/1.mp4", null, "portfolio/a/1.mp4", "portfolio/b/2.mp4", ""]);
    assert.deepEqual([...map.keys()].sort(), ["portfolio/a/1.mp4", "portfolio/b/2.mp4"]);
    assert.equal(map.get("portfolio/b/2.mp4"), "https://proj.supabase.co/storage/v1/object/public/videos/portfolio/b/2.mp4");
    assert.equal(videoUrls([]).size, 0);
  });
});
