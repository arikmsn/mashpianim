import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  creditsRemaining,
  creditsState,
  creditsSummary,
  creditsCardHint,
  CREDITS_CONTACT_NOTICE,
  CREDITS_HOW_TO,
} from "../src/lib/credits.ts";

describe("credits until online payment exists", () => {
  test("remaining never goes negative and ignores junk", () => {
    assert.equal(creditsRemaining(10, 3), 7);
    assert.equal(creditsRemaining(2, 5), 0);
    assert.equal(creditsRemaining(undefined, undefined), 0);
    assert.equal(creditsRemaining("4", "1"), 3);
    assert.equal(creditsRemaining(NaN, -2), 0);
    assert.equal(creditsRemaining(3.9, 1.2), 2);
  });

  test("a new business (never loaded) is 'fresh', a used-up package is 'empty'", () => {
    assert.equal(creditsState(0, 0), "fresh");
    assert.equal(creditsState(10, 10), "empty");
    assert.equal(creditsState(10, 12), "empty");
    assert.equal(creditsState(10, 9), "last");
    assert.equal(creditsState(10, 3), "ok");
  });

  test("summary wording per state", () => {
    assert.match(creditsSummary(0, 0), /עדיין אין סרטונים/);
    assert.match(creditsSummary(10, 10), /נגמרו/);
    assert.equal(creditsSummary(10, 9), "נותר סרטון אחד בחבילה.");
    assert.equal(creditsSummary(10, 3), "נותרו 7 סרטונים בחבילה.");
  });

  test("the card hint carries the contact notice only when the business cannot approve", () => {
    const fresh = creditsCardHint(0, 0);
    assert.ok(fresh && fresh.endsWith(CREDITS_CONTACT_NOTICE));
    const empty = creditsCardHint(5, 5);
    assert.ok(empty && empty.includes("נגמרו") && empty.includes(CREDITS_CONTACT_NOTICE));
    assert.equal(creditsCardHint(5, 4), null);
    assert.equal(creditsCardHint(5, 0), null);
  });

  test("the notice is the owner's wording and the how-to does not promise an online purchase", () => {
    assert.match(CREDITS_CONTACT_NOTICE, /צור קשר/);
    assert.match(CREDITS_CONTACT_NOTICE, /לקבלת גישה/);
    assert.ok(CREDITS_HOW_TO.includes(CREDITS_CONTACT_NOTICE));
    assert.doesNotMatch(CREDITS_HOW_TO, /בקרוב/);
  });
});
