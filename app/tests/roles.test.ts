import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { availableRoles, effectiveRole, otherRole, registrationMode } from "../src/lib/viewer.ts";

describe("a second role on one account (owner, 2026-11-15)", () => {
  test("registering again: same type completes, the other type adds a role, no account is new", () => {
    assert.equal(registrationMode(null, "creator"), "new");
    assert.equal(registrationMode(undefined, "brand"), "new");
    assert.equal(registrationMode("creator", "creator"), "complete");
    assert.equal(registrationMode("brand", "brand"), "complete");
    assert.equal(registrationMode("brand", "creator"), "add_role");
    assert.equal(registrationMode("creator", "brand"), "add_role");
    assert.equal(registrationMode("admin", "creator"), "add_role");
  });

  test("the other role", () => {
    assert.equal(otherRole("creator"), "brand");
    assert.equal(otherRole("brand"), "creator");
  });

  test("a brand account that added a creator profile holds both roles and the session may act as either", () => {
    assert.deepEqual(availableRoles("brand", "cp-1", "bp-1"), ["creator", "brand"]);
    assert.equal(effectiveRole("brand", "cp-1", "bp-1", "creator"), "creator");
    assert.equal(effectiveRole("brand", "cp-1", "bp-1", null), "brand", "without a chosen role the account's own type wins");
    assert.deepEqual(availableRoles("creator", "cp-1", "bp-2"), ["creator", "brand"]);
  });
});
