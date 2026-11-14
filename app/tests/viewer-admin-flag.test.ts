import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { availableRoles, effectiveRole } from "../src/lib/viewer.ts";

describe("users.is_admin grants the admin interface without changing the account type (migration 019)", () => {
  test("a creator with the flag holds creator + admin and still acts as a creator by default", () => {
    assert.deepEqual(availableRoles("creator", "cp1", null, true), ["creator", "admin"]);
    assert.deepEqual(availableRoles("creator", "cp1", null, false), ["creator"]);
    assert.deepEqual(availableRoles("creator", "cp1", null), ["creator"], "the flag is optional");
    assert.equal(effectiveRole("creator", "cp1", null, null, true), "creator", "no cookie → the account's own type");
    assert.equal(effectiveRole("creator", "cp1", null, "admin", true), "admin", "the session may choose admin");
    assert.equal(effectiveRole("creator", "cp1", null, "admin", false), "creator", "without the flag 'admin' is not a valid choice");
  });

  test("the admin type keeps working as before", () => {
    assert.deepEqual(availableRoles("admin", null, "bp1"), ["brand", "admin"]);
    assert.equal(effectiveRole("admin", null, null), "admin");
  });
});
