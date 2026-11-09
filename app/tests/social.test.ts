import { test } from "node:test";
import assert from "node:assert/strict";
import { formatFollowersCount, socialReach } from "../src/lib/social.ts";

test("formatFollowersCount: compact, nothing for zero or junk", () => {
  assert.equal(formatFollowersCount(850), "850");
  assert.equal(formatFollowersCount(12_300), "12.3K");
  assert.equal(formatFollowersCount(12_000), "12K");
  assert.equal(formatFollowersCount(1_200_000), "1.2M");
  assert.equal(formatFollowersCount("4500"), "4.5K");
  assert.equal(formatFollowersCount(0), "");
  assert.equal(formatFollowersCount(null), "");
  assert.equal(formatFollowersCount("abc"), "");
});

test("socialReach shows platform + follower count, never the handle or a link", () => {
  const chips = socialReach({ tiktok: "@dana_creates", tiktokFollowers: 12_300, instagram: "", instagramFollowers: 0 });
  assert.deepEqual(chips, [{ platform: "tiktok", name: "TikTok", label: "12.3K עוקבים" }]);
  for (const c of chips) {
    assert.ok(!c.label.includes("dana"));
    assert.ok(!JSON.stringify(c).includes("http"));
  }
});

test("socialReach: a platform with a handle but no count still appears, without numbers", () => {
  const chips = socialReach({ tiktok: "", tiktokFollowers: 0, instagram: "someone", instagramFollowers: null });
  assert.deepEqual(chips, [{ platform: "instagram", name: "Instagram", label: "פעיל/ה ברשת" }]);
});

test("socialReach: nothing to show when there is neither a count nor a handle", () => {
  assert.deepEqual(socialReach({}), []);
  assert.deepEqual(socialReach({ tiktok: "  ", tiktokFollowers: 0 }), []);
});
