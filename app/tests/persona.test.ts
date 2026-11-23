import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { otherPersona, parsePersona, resolvePersona, withType } from "../src/lib/persona.ts";

describe("identity colour of the auth screens (design package v3)", () => {
  test("parse and resolve", () => {
    assert.equal(parsePersona("brand"), "brand");
    assert.equal(parsePersona("creator"), "creator");
    assert.equal(parsePersona("admin"), null);
    assert.equal(parsePersona(undefined), null);
    assert.equal(resolvePersona("creator", "brand"), "creator", "the URL wins");
    assert.equal(resolvePersona(null, "brand"), "brand", "then the session");
    assert.equal(resolvePersona("x", "y"), null);
    assert.equal(otherPersona("brand"), "creator");
    assert.equal(otherPersona("creator"), "brand");
  });

  test("withType keeps existing query strings", () => {
    assert.equal(withType("/login", "brand"), "/login?type=brand");
    assert.equal(withType("/login?redirect=%2Fx", "creator"), "/login?redirect=%2Fx&type=creator");
    assert.equal(withType("/register", null), "/register");
  });
});
