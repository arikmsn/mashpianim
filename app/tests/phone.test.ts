import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { normalizeIsraeliMobile } from "../src/lib/phone.ts";

describe("israeli mobile numbers", () => {
  test("accepts the usual ways people type their number", () => {
    assert.equal(normalizeIsraeliMobile("0501234567"), "+972501234567");
    assert.equal(normalizeIsraeliMobile("050-123-4567"), "+972501234567");
    assert.equal(normalizeIsraeliMobile("050 123 4567"), "+972501234567");
    assert.equal(normalizeIsraeliMobile("+972501234567"), "+972501234567");
    assert.equal(normalizeIsraeliMobile("972501234567"), "+972501234567");
    assert.equal(normalizeIsraeliMobile("(050) 1234567"), "+972501234567");
    assert.equal(normalizeIsraeliMobile("0591234567"), "+972591234567");
  });

  test("rejects anything that is not an Israeli mobile", () => {
    for (const bad of ["123", "abc", "", "05012345", "050123456789", "031234567", "+1 555 123 4567", "0401234567", "97250123456", null, 42]) {
      assert.equal(normalizeIsraeliMobile(bad as unknown), null, String(bad));
    }
  });
});
