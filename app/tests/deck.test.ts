import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { MAX_DECK_PREVIEWS, nextPreviewIndex, previewsFromVideos } from "../src/lib/deck.ts";

describe("creator deck playlist (owner, 2026-11-23: play all her videos, not just one)", () => {
  test("newest first, capped, only playable videos", () => {
    const videos = Array.from({ length: 9 }, (_, i) => ({ url: i === 3 ? null : `https://v/${i}.mp4`, poster: `p${i}`, createdAt: `2026-11-0${(i % 9) + 1}T00:00:00Z` }));
    const list = previewsFromVideos(videos);
    assert.equal(list.length, MAX_DECK_PREVIEWS);
    assert.equal(list[0].url, "https://v/8.mp4", "newest first");
    assert.ok(list.every((p) => p.url !== null && !p.url.endsWith("/3.mp4")), "the unplayable one is skipped");
    assert.deepEqual(previewsFromVideos([]), []);
    assert.equal(previewsFromVideos(videos, 2).length, 2);
  });
  test("advancing wraps around; a single video stays put", () => {
    assert.equal(nextPreviewIndex(0, 3), 1);
    assert.equal(nextPreviewIndex(2, 3), 0);
    assert.equal(nextPreviewIndex(0, 1), 0);
    assert.equal(nextPreviewIndex(5, 0), 0);
  });
});
