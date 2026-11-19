import { test, describe, before } from "node:test";
import assert from "node:assert/strict";

// video-links reads NEXT_SUPABASE_URL once at import time, so set it before importing the module
process.env.NEXT_SUPABASE_URL = "https://proj.supabase.co";
let videoUrl: (p: string | null | undefined) => string | null;
let videoUrls: (paths: (string | null | undefined)[]) => Map<string, string>;
let signedDeliverableUrls: (admin: any, paths: (string | null | undefined)[]) => Promise<Map<string, string>>;
let deliverableThumbPath: (u: string | null | undefined) => string | null;
let DELIVERABLES_BUCKET: string;
before(async () => {
  ({ videoUrl, videoUrls, signedDeliverableUrls, deliverableThumbPath, DELIVERABLES_BUCKET } = await import("../src/lib/video-links.ts"));
});

// A stand-in for the service-role storage client
function fakeAdmin() {
  const calls: { bucket: string; paths: string[] }[] = [];
  const admin = {
    storage: {
      from(bucket: string) {
        return {
          async createSignedUrls(paths: string[]) {
            calls.push({ bucket, paths });
            return { data: paths.map((p) => ({ path: p, signedUrl: `https://proj.supabase.co/storage/v1/object/sign/${bucket}/${p}?token=t` })) };
          },
        };
      },
    },
  };
  return { admin, calls };
}

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

describe("private deliverable URLs (owner, 2026-11-18: keep delivery videos private)", () => {
  test("signs from the private deliverables bucket, deduped, blanks dropped", async () => {
    const { admin, calls } = fakeAdmin();
    const map = await signedDeliverableUrls(admin, ["d/1.mp4", null, "d/1.mp4", "d/2.mov", ""]);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].bucket, DELIVERABLES_BUCKET);
    assert.deepEqual(calls[0].paths.sort(), ["d/1.mp4", "d/2.mov"]);
    assert.ok(map.get("d/2.mov")?.includes("/object/sign/deliverables/d/2.mov"));
    assert.equal(map.size, 2);
  });
  test("no paths means no storage call", async () => {
    const { admin, calls } = fakeAdmin();
    const map = await signedDeliverableUrls(admin, [null, "", undefined]);
    assert.equal(map.size, 0);
    assert.equal(calls.length, 0);
  });

  test("a deliverable poster path is recovered from a bare path or a legacy public thumbnails URL", () => {
    const path = "portfolio/u/connections/c/1794248818703.jpg";
    assert.equal(deliverableThumbPath(path), path, "already a bare path");
    assert.equal(deliverableThumbPath(`https://proj.supabase.co/storage/v1/object/public/thumbnails/${path}`), path, "legacy public URL");
    assert.equal(deliverableThumbPath(`https://proj.supabase.co/storage/v1/object/sign/deliverables/${path}?token=t`), path, "already-signed URL");
    assert.equal(deliverableThumbPath(null), null);
    assert.equal(deliverableThumbPath(""), null);
  });
});
