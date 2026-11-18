import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { SIGNED_TTL_SECONDS, _resetVideoLinkCache, cachedVideoUrl, signedVideoUrl, signedVideoUrls } from "../src/lib/video-links.ts";

// A stand-in for the Storage client: every signing call hands out a new token, like the real one
function fakeAdmin() {
  const calls: string[][] = [];
  let n = 0;
  const admin = {
    storage: {
      from() {
        return {
          async createSignedUrl(path: string) {
            calls.push([path]);
            n += 1;
            return { data: { signedUrl: `https://x/sign/${path}?token=t${n}` } };
          },
          async createSignedUrls(paths: string[]) {
            calls.push(paths);
            return { data: paths.map((p) => ({ path: p, signedUrl: `https://x/sign/${p}?token=t${++n}` })) };
          },
        };
      },
    },
  };
  return { admin: admin as any, calls };
}

describe("signed video URLs are reused for most of a day (owner, 2026-11-18: slow videos — the CDN never had them)", () => {
  beforeEach(() => _resetVideoLinkCache());

  test("the second request for the same path gets the same URL without signing again", async () => {
    const { admin, calls } = fakeAdmin();
    const a = await signedVideoUrl(admin, "portfolio/u/1.mp4");
    const b = await signedVideoUrl(admin, "portfolio/u/1.mp4");
    assert.equal(a, b);
    assert.equal(calls.length, 1);
    assert.equal(cachedVideoUrl("portfolio/u/1.mp4"), a);
    assert.equal(cachedVideoUrl("portfolio/u/2.mp4"), null);
  });

  test("an entry close to its expiry is signed afresh", async () => {
    const { admin } = fakeAdmin();
    const a = await signedVideoUrl(admin, "p");
    // 23 hours later the URL has an hour left — too close to hand out
    assert.equal(cachedVideoUrl("p", Date.now() + (SIGNED_TTL_SECONDS - 3600) * 1000), null);
    assert.equal(cachedVideoUrl("p", Date.now() + 3600_000), a, "an hour in, still good");
  });

  test("a batch signs only the misses, in one call, and returns every path", async () => {
    const { admin, calls } = fakeAdmin();
    await signedVideoUrl(admin, "a");
    const map = await signedVideoUrls(admin, ["a", "b", "c", "b"]);
    assert.deepEqual([...map.keys()].sort(), ["a", "b", "c"]);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[1], ["b", "c"], "only the two misses, once each");
    const again = await signedVideoUrls(admin, ["a", "b", "c"]);
    assert.equal(calls.length, 2, "all cached now");
    assert.deepEqual([...again.values()], [...map.values()]);
  });
});
