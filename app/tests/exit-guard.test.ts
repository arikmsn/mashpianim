import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isExitGuardScreen } from "../src/lib/exit-guard.ts";

describe("exit guard scope (owner, 2026-11-18: Back from home must not drop the user on the verification screen)", () => {
  test("guards only the two home screens — where Back would leave the app", () => {
    assert.equal(isExitGuardScreen("/feed"), true);
    assert.equal(isExitGuardScreen("/brand"), true);
  });
  test("every inner screen keeps normal Back navigation", () => {
    for (const p of ["/connections", "/messages", "/profile", "/notifications", "/brand/products", "/brand/connections", "/brand/billing", "/products/abc", "/feed/x", "/"]) {
      assert.equal(isExitGuardScreen(p), false, p);
    }
    assert.equal(isExitGuardScreen(null), false);
    assert.equal(isExitGuardScreen(undefined), false);
  });
});
