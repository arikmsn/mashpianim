import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { QA_PHONES, isQaPhone } from "../src/lib/qa-accounts.ts";

describe("internal QA accounts stay out of the business gallery (owner, 2026-11-28)", () => {
  test("QA phones match in every stored format", () => {
    for (const p of ["972500000001", "+972500000001", "+972 50-000-0001", "0500000001", "972500000002", "+972500009999"]) assert.ok(isQaPhone(p), p);
  });
  test("real phones and junk do not match", () => {
    for (const p of ["972502463555", "+972549412979", "0501234567", "", null, undefined, 972500000001]) assert.equal(isQaPhone(p), false, String(p));
    assert.equal(QA_PHONES.length, 3);
  });
});
