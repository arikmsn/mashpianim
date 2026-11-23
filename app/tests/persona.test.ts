import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { homeForRole, manifestHref, otherPersona, parsePersona, personaForRole, resolvePersona, withType } from "../src/lib/persona.ts";

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

  test("the signed-in role and the installed app follow the persona", () => {
    assert.equal(personaForRole("brand"), "brand");
    assert.equal(personaForRole("creator"), "creator");
    assert.equal(personaForRole("admin"), null, "admins keep whatever the device remembered");
    assert.equal(personaForRole(null), null);
    assert.equal(manifestHref("creator"), "/api/manifest?persona=creator");
    assert.equal(manifestHref("brand"), "/api/manifest?persona=brand");
    assert.equal(manifestHref(null), "/manifest.json");
  });

  test("homeForRole sends creators to the feed and businesses to the gallery; admins and unknown roles stay", () => {
    assert.equal(homeForRole("creator"), "/feed");
    assert.equal(homeForRole("brand"), "/brand");
    assert.equal(homeForRole("admin"), null);
    assert.equal(homeForRole(undefined), null);
  });

  test("withType keeps existing query strings", () => {
    assert.equal(withType("/login", "brand"), "/login?type=brand");
    assert.equal(withType("/login?redirect=%2Fx", "creator"), "/login?redirect=%2Fx&type=creator");
    assert.equal(withType("/register", null), "/register");
  });
});
