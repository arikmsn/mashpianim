import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { whatsappNotificationsEnabled } from "../src/lib/messaging-switch.ts";

describe("WhatsApp notifications switch (owner, 2026-11-12)", () => {
  test("off unless WHATSAPP_NOTIFICATIONS is exactly 'on'", () => {
    assert.equal(whatsappNotificationsEnabled(undefined), false, "unset → off (safe default after the restriction)");
    assert.equal(whatsappNotificationsEnabled(""), false);
    assert.equal(whatsappNotificationsEnabled("off"), false);
    assert.equal(whatsappNotificationsEnabled("true"), false, "only the explicit word turns it on");
    assert.equal(whatsappNotificationsEnabled("on"), true);
    assert.equal(whatsappNotificationsEnabled(" ON "), true);
  });
});
