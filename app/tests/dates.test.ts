import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { formatDateHe } from "../src/lib/dates.ts";

describe("Hebrew date echo for native date inputs", () => {
  test("yyyy-mm-dd reads as day, month name, year", () => {
    assert.equal(formatDateHe("2026-12-03"), "3 בדצמבר 2026");
    assert.equal(formatDateHe("1999-01-31"), "31 בינואר 1999");
  });

  test("empty and broken values never throw", () => {
    assert.equal(formatDateHe(""), "");
    assert.equal(formatDateHe(null), "");
    assert.equal(formatDateHe(undefined), "");
    assert.equal(formatDateHe("not-a-date"), "not-a-date");
  });
});
