import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mapMatchError, isUniqueViolation } from "../src/lib/match-errors.ts";

describe("match_connection() error mapping", () => {
  test("no credits is a 400 with the credits message", () => {
    const r = mapMatchError("P0001: NO_CREDITS");
    assert.equal(r.status, 400);
    assert.match(r.error, /סרטונים זמינים/);
  });

  test("not pending is a 400", () => {
    assert.equal(mapMatchError("CONNECTION_NOT_PENDING").status, 400);
  });

  test("missing rows are 404", () => {
    assert.equal(mapMatchError("CONNECTION_NOT_FOUND").status, 404);
    assert.equal(mapMatchError("BRAND_NOT_FOUND").status, 404);
  });

  test("anything else is a 500 without leaking the raw message", () => {
    const r = mapMatchError("deadlock detected");
    assert.equal(r.status, 500);
    assert.equal(r.error.includes("deadlock"), false);
    assert.equal(mapMatchError(null).status, 500);
  });
});

describe("unique violation detection", () => {
  test("only Postgres 23505 counts", () => {
    assert.equal(isUniqueViolation({ code: "23505" }), true);
    assert.equal(isUniqueViolation({ code: "23503" }), false);
    assert.equal(isUniqueViolation(null), false);
    assert.equal(isUniqueViolation({}), false);
  });
});
