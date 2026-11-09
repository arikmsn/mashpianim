import { test } from "node:test";
import assert from "node:assert/strict";
import { orderKey, shuffledBySeed } from "../src/lib/feed-order.ts";
import { mergeIncomingMessage, settleLocalMessage, isLocalMessageId } from "../src/lib/chat.ts";

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
