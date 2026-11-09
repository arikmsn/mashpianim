import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseInstant,
  sameFieldValue,
  changedConnectionFields,
  isQuietConnectionUpdate,
  hasUnreadFromOthers,
  QUIET_CONNECTION_FIELDS,
} from "../src/lib/chat.ts";

// The 2026-11-09 flood: opening a chat marked it read, the row update came back over Realtime, the chat
// reloaded and marked it read again. These helpers are what stops that loop.

test("parseInstant reads both PostgREST and Realtime timestamp spellings as the same instant", () => {
  const rest = parseInstant("2026-11-09T17:54:47.606332+00:00");
  const realtime = parseInstant("2026-11-09 17:54:47.606332+00");
  assert.ok(!Number.isNaN(rest));
  assert.equal(rest, realtime);
  assert.ok(Number.isNaN(parseInstant("approved")));
  assert.ok(Number.isNaN(parseInstant(3)));
  assert.ok(Number.isNaN(parseInstant(null)));
});

test("sameFieldValue: empties alike, timestamps by instant, other values by string", () => {
  assert.equal(sameFieldValue(null, undefined), true);
  assert.equal(sameFieldValue("", null), true);
  assert.equal(sameFieldValue(null, "x"), false);
  assert.equal(sameFieldValue(1, "1"), true);
  assert.equal(sameFieldValue("approved", "shipped"), false);
  assert.equal(sameFieldValue("2026-11-09T17:54:47.606332+00:00", "2026-11-09 17:54:47.606332+00"), true);
  assert.equal(sameFieldValue("2026-11-09T17:54:47+00:00", "2026-11-09T17:54:48+00:00"), false);
  assert.equal(sameFieldValue({ a: 1 }, { a: 1 }), true);
});

test("a read-marker update is quiet; a status or brief change is not", () => {
  const prev = {
    id: "c1",
    status: "approved",
    brief_posted_at: "2026-11-09T17:00:00+00:00",
    brief_approved_at: null,
    creator_read_at: "2026-11-09T17:50:00+00:00",
    brand_read_at: null,
    products: { name: "x" },
  };
  const readMarker = { ...prev, creator_read_at: "2026-11-09 17:54:47.606332+00", updated_at: "2026-11-09 17:54:47+00" };
  delete (readMarker as Record<string, unknown>).products;
  assert.deepEqual(changedConnectionFields(prev, readMarker).sort(), ["creator_read_at", "updated_at"]);
  assert.equal(isQuietConnectionUpdate(prev, readMarker), true);

  const approved = { ...readMarker, brief_approved_at: "2026-11-09 17:55:00+00" };
  assert.equal(isQuietConnectionUpdate(prev, approved), false);
  const shipped = { ...readMarker, status: "shipped" };
  assert.equal(isQuietConnectionUpdate(prev, shipped), false);

  // Same timestamps in the other spelling: nothing changed → quiet
  assert.equal(isQuietConnectionUpdate(prev, { ...prev, brief_posted_at: "2026-11-09 17:00:00+00" }), true);
  // Nothing to compare with yet → reload
  assert.equal(isQuietConnectionUpdate(null, readMarker), false);
  for (const f of ["creator_read_at", "brand_read_at"]) assert.ok(QUIET_CONNECTION_FIELDS.has(f));
  assert.ok(!QUIET_CONNECTION_FIELDS.has("status"));
});

test("hasUnreadFromOthers mirrors the unread rule: someone else's message newer than my read marker", () => {
  const msgs = [
    { senderId: "me", createdAt: "2026-11-09T17:10:00+00:00" },
    { senderId: "them", createdAt: "2026-11-09T17:20:00+00:00" },
  ];
  assert.equal(hasUnreadFromOthers(msgs, "me", null), true);
  assert.equal(hasUnreadFromOthers(msgs, "me", "2026-11-09T17:25:00+00:00"), false);
  assert.equal(hasUnreadFromOthers(msgs, "me", "2026-11-09T17:15:00+00:00"), true);
  // Only my own messages → nothing to mark
  assert.equal(hasUnreadFromOthers([msgs[0]], "me", null), false);
  // Viewer unknown → be safe and mark
  assert.equal(hasUnreadFromOthers([msgs[0]], null, "2026-11-09T17:25:00+00:00"), false);
  assert.equal(hasUnreadFromOthers([msgs[0]], null, null), true);
  assert.equal(hasUnreadFromOthers([], "me", null), false);
});
