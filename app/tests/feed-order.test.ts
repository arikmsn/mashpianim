import { test } from "node:test";
import assert from "node:assert/strict";
import { orderKey, shuffledBySeed, shuffledBySeedBy } from "../src/lib/feed-order.ts";
import { mergeIncomingMessage, settleLocalMessage, isLocalMessageId } from "../src/lib/chat.ts";

test("the business's gallery shuffles creators by userId with the same session seed (owner, 2026-11-18)", () => {
  const creators = Array.from({ length: 30 }, (_, i) => ({ userId: `u${i}`, name: `creator ${i}` }));
  const a = shuffledBySeedBy(creators, "visit-1", (c) => c.userId).map((c) => c.userId);
  const again = shuffledBySeedBy(creators, "visit-1", (c) => c.userId).map((c) => c.userId);
  const other = shuffledBySeedBy(creators, "visit-2", (c) => c.userId).map((c) => c.userId);
  assert.deepEqual(a, again, "stable within a visit (realtime refreshes must not reorder)");
  assert.notDeepEqual(a, other, "a new visit starts somewhere else");
  assert.notDeepEqual(a, creators.map((c) => c.userId));
  assert.equal(new Set(a).size, 30);
  // The same positions as the id-based helper
  assert.deepEqual(a, shuffledBySeed(creators.map((c) => ({ id: c.userId })), "visit-1").map((c) => c.id));
});

test("the deck order is stable for one seed and different for another (owner: random גלו, 2026-11-09)", () => {
  const items = Array.from({ length: 40 }, (_, i) => ({ id: `p${i}` }));
  const a1 = shuffledBySeed(items, "seed-a").map((p) => p.id);
  const a2 = shuffledBySeed(items, "seed-a").map((p) => p.id);
  const b = shuffledBySeed(items, "seed-b").map((p) => p.id);
  assert.deepEqual(a1, a2);
  assert.notDeepEqual(a1, b);
  assert.notDeepEqual(a1, items.map((p) => p.id), "not the insertion order");
  assert.equal(new Set(a1).size, 40, "nothing lost or duplicated");
  assert.equal(orderKey("x", "s"), orderKey("x", "s"));
  assert.notEqual(orderKey("x", "s"), orderKey("y", "s"));
});

test("a Realtime copy of our own message replaces the optimistic one instead of duplicating it", () => {
  const local = { id: "local-1", text: "מה שלומך?", senderId: "me" };
  const saved = { id: "m-9", text: "מה שלומך?", senderId: "me" };
  const theirs = { id: "m-10", text: "מה שלומך?", senderId: "them" };
  assert.ok(isLocalMessageId(local.id));
  assert.ok(!isLocalMessageId(saved.id));
  // Realtime first
  assert.deepEqual(mergeIncomingMessage([local], saved), [saved]);
  // Same text from the other side is a different message
  assert.deepEqual(mergeIncomingMessage([saved], theirs), [saved, theirs]);
  // Already listed → unchanged
  assert.deepEqual(mergeIncomingMessage([saved], saved), [saved]);
  // POST response first
  assert.deepEqual(settleLocalMessage([local], "local-1", saved), [saved]);
  // POST response after Realtime already delivered the row → the optimistic copy goes
  assert.deepEqual(settleLocalMessage([saved, local], "local-1", saved), [saved]);
  // No saved row in the response → keep what we have
  assert.deepEqual(settleLocalMessage([local], "local-1", null), [local]);
});
