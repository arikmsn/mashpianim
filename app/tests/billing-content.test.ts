import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { BILLING_CONTENT_DEFAULTS, BILLING_CONTENT_FIELDS, BILLING_CONTENT_SECTION, fillTemplate, mergeBillingContent, parseBullets, parseFaq } from "../src/lib/billing-content.ts";
import { applyFirstPurchaseDiscount, packageItemName, packageOffers, parseCreditPrices, parseFirstPurchaseDiscount, savingsVsSingle } from "../src/lib/payments.ts";

describe("the business billing page copy (owner, 2026-11-16)", () => {
  test("every editable field has a default, and the defaults parse", () => {
    for (const f of BILLING_CONTENT_FIELDS) assert.ok(typeof BILLING_CONTENT_DEFAULTS[f.key] === "string", f.key);
    assert.ok(parseFaq(BILLING_CONTENT_DEFAULTS.faq).length >= 8);
    assert.ok(parseBullets(BILLING_CONTENT_DEFAULTS.includes_body).length >= 3);
  });

  test("saved overrides win, blanks fall back — except the referral block, which a blank hides", () => {
    const merged = mergeBillingContent({ [BILLING_CONTENT_SECTION]: { title: "קרדיטים", balance_note: "   ", referral_title: "", referral_body: "" } });
    assert.equal(merged.title, "קרדיטים");
    assert.equal(merged.balance_note, BILLING_CONTENT_DEFAULTS.balance_note);
    assert.equal(merged.referral_title, "");
    assert.equal(mergeBillingContent(null).faq, BILLING_CONTENT_DEFAULTS.faq);
    assert.equal(mergeBillingContent({ other: { title: "x" } }).title, BILLING_CONTENT_DEFAULTS.title);
  });

  test("templates and parsing", () => {
    assert.equal(fillTemplate("הנחה של {pct}% על {what}", { pct: 15, what: "החבילה" }), "הנחה של 15% על החבילה");
    assert.equal(fillTemplate("{missing} stays", {}), "{missing} stays");
    assert.deepEqual(parseFaq("ש: למה?\nת: ככה.\nועוד שורה\n\nש: בלי תשובה\n\nQ: english\nA: works"), [
      { q: "למה?", a: "ככה.\nועוד שורה" },
      { q: "english", a: "works" },
    ]);
    assert.deepEqual(parseBullets("• אחד\n- שניים\nשלוש\n\n"), ["אחד", "שניים", "שלוש"]);
  });
});

describe("first-purchase discount", () => {
  test("the percentage comes from the settings, 15 by default, bounded", () => {
    assert.equal(parseFirstPurchaseDiscount({}), 15);
    assert.equal(parseFirstPurchaseDiscount({ first_purchase_discount_pct: "0" }), 0);
    assert.equal(parseFirstPurchaseDiscount({ first_purchase_discount_pct: "20" }), 20);
    assert.equal(parseFirstPurchaseDiscount({ first_purchase_discount_pct: 150 }), 90);
    assert.equal(parseFirstPurchaseDiscount({ first_purchase_discount_pct: "abc" }), 0);
  });

  test("applied to every package: original price kept, per-video recomputed; 0 leaves prices alone", () => {
    const offers = packageOffers(parseCreditPrices({}));
    const discounted = applyFirstPurchaseDiscount(offers, 15);
    const five = discounted.find((o) => o.id === "pack5")!;
    assert.equal(five.originalPrice, 450);
    assert.equal(five.price, 382.5);
    assert.equal(five.perVideo, 76.5);
    assert.equal(five.discountPct, 15);
    const plain = applyFirstPurchaseDiscount(offers, 0).find((o) => o.id === "pack5")!;
    assert.equal(plain.price, 450);
    assert.equal(plain.originalPrice, undefined);
    assert.equal(packageItemName(five), "חבילת 5 סרטונים — משפיען אונליין (15% הנחת רכישה ראשונה)");
    assert.equal(packageItemName(plain), "חבילת 5 סרטונים — משפיען אונליין");
  });

  test("savings against single videos", () => {
    const offers = packageOffers(parseCreditPrices({}));
    assert.equal(savingsVsSingle(offers.find((o) => o.id === "pack20")!, 100), 600);
    assert.equal(savingsVsSingle(offers.find((o) => o.id === "single")!, 100), 0);
  });
});
