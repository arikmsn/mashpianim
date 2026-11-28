import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { SYSTEM_MESSAGE_BODY_MAX, SYSTEM_MESSAGE_LABEL, SYSTEM_MESSAGE_TITLE_MAX, SYSTEM_MESSAGE_TYPE, validateSystemMessage } from "../src/lib/system-message.ts";
import { notificationHref } from "../src/lib/notification-links.ts";

describe("system message from the admin to a creator (owner, 2026-11-28)", () => {
  test("title and text are required, trimmed and bounded", () => {
    assert.deepEqual(validateSystemMessage({ title: "  עדכון  ", body: " שלום\r\nשורה שנייה " }), { ok: true, value: { title: "עדכון", body: "שלום\nשורה שנייה" } });
    assert.equal(validateSystemMessage({ title: "", body: "x" }).ok, false);
    assert.equal(validateSystemMessage({ title: "x", body: "   " }).ok, false);
    assert.equal(validateSystemMessage(null).ok, false);
    assert.equal(validateSystemMessage({ title: 5, body: ["x"] }).ok, false);
    assert.equal(validateSystemMessage({ title: "x".repeat(SYSTEM_MESSAGE_TITLE_MAX), body: "y".repeat(SYSTEM_MESSAGE_BODY_MAX) }).ok, true);
    const long = validateSystemMessage({ title: "x".repeat(SYSTEM_MESSAGE_TITLE_MAX + 1), body: "y" });
    assert.equal(long.ok, false);
    if (!long.ok) assert.match(long.error, /ארוכה/);
    assert.equal(validateSystemMessage({ title: "x", body: "y".repeat(SYSTEM_MESSAGE_BODY_MAX + 1) }).ok, false);
  });

  test("the bell shows it under the system label and it opens nothing (no reply path)", () => {
    assert.equal(SYSTEM_MESSAGE_TYPE, "system_message");
    assert.equal(SYSTEM_MESSAGE_LABEL, "הודעת מערכת");
    for (const role of ["creator", "brand", null] as const) {
      assert.equal(notificationHref({ type: SYSTEM_MESSAGE_TYPE, data: { role: "creator" } }, role), null);
      assert.equal(notificationHref({ type: SYSTEM_MESSAGE_TYPE, data: { role: "creator" } }, role, true), null);
    }
  });
});
