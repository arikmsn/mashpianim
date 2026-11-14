import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  CREDIT_PACKAGES,
  buildBeginRedirectBody,
  formatILS,
  isPackageId,
  packageOffers,
  parseCreditPrices,
  paymentsMode,
  purchaseOutcomeText,
  purchasesOpenFor,
  returnParams,
  sumitErrorMessage,
  sumitOk,
  validateBilling,
  verifySumitPayment,
} from "../src/lib/payments.ts";

describe("credit packages and prices", () => {
  test("prices come from the admin settings, with defaults for junk", () => {
    const p = parseCreditPrices({ single_price: "120", pack_5_price: 0, pack_10_price: "abc", pack_20_price: 1399.999 });
    assert.deepEqual(p, { single: 120, pack5: 450, pack10: 800, pack20: 1400 });
    assert.deepEqual(parseCreditPrices(null), { single: 100, pack5: 450, pack10: 800, pack20: 1400 });
  });

  test("offers carry the per-video price and mark the best multi-video package", () => {
    const offers = packageOffers(parseCreditPrices({}));
    assert.deepEqual(offers.map((o) => [o.id, o.credits, o.price, o.perVideo, o.best]), [
      ["single", 1, 100, 100, false],
      ["pack5", 5, 450, 90, false],
      ["pack10", 10, 800, 80, false],
      ["pack20", 20, 1400, 70, true],
    ]);
    assert.equal(offers[0].label, "סרטון אחד");
    assert.equal(offers[3].label, "20 סרטונים");
    assert.equal(isPackageId("pack5"), true);
    assert.equal(isPackageId("pack50"), false);
    assert.equal(CREDIT_PACKAGES.length, 4);
  });

  test("ILS formatting", () => {
    assert.equal(formatILS(1400), "₪1,400");
    assert.equal(formatILS(99.9), "₪99.90");
  });
});

describe("the payments switch", () => {
  test("off without credentials, whatever the flag says", () => {
    assert.equal(paymentsMode({ SUMIT_PAYMENTS: "on" }), "off");
    assert.equal(paymentsMode({ SUMIT_PAYMENTS: "on", SUMIT_COMPANY_ID: "abc", SUMIT_API_KEY: "k" }), "off");
  });
  test("admins / on with credentials; anything else is off", () => {
    const env = { SUMIT_COMPANY_ID: "12345", SUMIT_API_KEY: "secret" };
    assert.equal(paymentsMode({ ...env, SUMIT_PAYMENTS: "admins" }), "admins");
    assert.equal(paymentsMode({ ...env, SUMIT_PAYMENTS: " ON " }), "on");
    assert.equal(paymentsMode({ ...env, SUMIT_PAYMENTS: "yes" }), "off");
    assert.equal(paymentsMode(env), "off");
    assert.equal(purchasesOpenFor("admins", true), true);
    assert.equal(purchasesOpenFor("admins", false), false);
    assert.equal(purchasesOpenFor("on", false), true);
    assert.equal(purchasesOpenFor("off", true), false);
  });
});

describe("invoice details", () => {
  test("name and a real e-mail are required; the company number is optional digits", () => {
    const ok = validateBilling({ name: "  חנות הדגמה  ", companyNumber: "51-234567-8", email: "Owner@Shop.co.il " });
    assert.deepEqual(ok, { ok: true, value: { name: "חנות הדגמה", companyNumber: "512345678", email: "owner@shop.co.il" } });
    assert.equal(validateBilling({ name: "x", email: "a@b.co" }).ok, false);
    assert.equal(validateBilling({ name: "חנות", email: "not-an-email" }).ok, false);
    assert.equal(validateBilling({ name: "חנות", email: "a@b.co", companyNumber: "12" }).ok, false);
    const noCompany = validateBilling({ name: "חנות", email: "a@b.co", companyNumber: "" });
    assert.equal(noCompany.ok && noCompany.value.companyNumber, null);
  });
});

describe("SUMIT request and response", () => {
  const offer = packageOffers(parseCreditPrices({})).find((o) => o.id === "pack5")!;
  const body = buildBeginRedirectBody({
    companyId: 12345,
    apiKey: "secret",
    transactionId: "11111111-2222-4333-8444-555555555555",
    brandProfileId: "bp-1",
    billing: { name: "חנות הדגמה", companyNumber: "512345678", email: "owner@shop.co.il" },
    phone: "+972501234567",
    offer,
    returnUrl: "https://www.mashpian.online/api/payments/sumit/return",
    cancelUrl: "https://www.mashpian.online/api/payments/sumit/cancel",
  }) as Record<string, any>;

  test("beginredirect body: credentials, the business as a customer keyed by our id, one gross line, invoice-receipt", () => {
    assert.deepEqual(body.Credentials, { CompanyID: 12345, APIKey: "secret" });
    assert.equal(body.Customer.Name, "חנות הדגמה");
    assert.equal(body.Customer.ExternalIdentifier, "bp-1");
    assert.equal(body.Customer.SearchMode, 2);
    assert.equal(body.Customer.CompanyNumber, "512345678");
    assert.equal(body.Items.length, 1);
    assert.equal(body.Items[0].UnitPrice, 450);
    assert.equal(body.Items[0].Total, 450);
    assert.equal(body.Items[0].Quantity, 1);
    assert.equal(body.Items[0].Item.Name, "חבילת 5 סרטונים — משפיען אונליין");
    assert.equal(body.VATIncluded, true);
    assert.equal(body.DocumentType, 1);
    assert.equal(body.Language, 0);
    assert.equal(body.MaximumPayments, 1);
    assert.equal(body.ExternalIdentifier, "11111111-2222-4333-8444-555555555555");
    assert.equal(body.RedirectURL, "https://www.mashpian.online/api/payments/sumit/return");
    assert.equal(body.SendUpdateByEmailAddress, "owner@shop.co.il");
  });

  test("the envelope: Status 0 / Success is ok, errors read UserErrorMessage first", () => {
    assert.equal(sumitOk({ Status: 0 }), true);
    assert.equal(sumitOk({ Status: "Success" }), true);
    assert.equal(sumitOk({ Status: "Success (0)" }), true);
    assert.equal(sumitOk({ Status: 1 }), false);
    assert.equal(sumitOk(null), false);
    assert.equal(sumitErrorMessage({ Status: 1, UserErrorMessage: "פרטי זיהוי שגויים", TechnicalErrorDetails: "x" }), "פרטי זיהוי שגויים");
    assert.equal(sumitErrorMessage({ Status: 2, TechnicalErrorDetails: "boom" }), "boom");
    assert.equal(sumitErrorMessage({ Status: 1 }), "SUMIT status 1");
  });

  test("a payment credits the order only when valid, in ILS, for the exact amount and this order", () => {
    const expected = { transactionId: "tx-1", amount: 450 };
    assert.deepEqual(verifySumitPayment({ ID: 9, ValidPayment: true, Amount: 450, Currency: "ILS", ExternalIdentifier: "tx-1" }, expected), { ok: true });
    assert.deepEqual(verifySumitPayment({ ID: 9, ValidPayment: true, Amount: 450.004, Currency: 0, ExternalIdentifier: null }, expected), { ok: true });
    assert.equal(verifySumitPayment({ ID: 9, ValidPayment: false, Amount: 450, StatusDescription: "declined" }, expected).ok, false);
    assert.equal(verifySumitPayment({ ID: 9, ValidPayment: true, Amount: 449, Currency: "ILS" }, expected).ok, false);
    assert.equal(verifySumitPayment({ ID: 9, ValidPayment: true, Amount: 450, Currency: "USD" }, expected).ok, false);
    assert.equal(verifySumitPayment({ ID: 9, ValidPayment: true, Amount: 450, ExternalIdentifier: "tx-2" }, expected).ok, false);
    assert.equal(verifySumitPayment(null, expected).ok, false);
  });

  test("return URL parameters are read case-insensitively and validated", () => {
    const p = returnParams(new URLSearchParams("OG-PaymentID=4521&OG-CustomerID=77&OG-ExternalIdentifier=11111111-2222-4333-8444-555555555555"));
    assert.deepEqual(p, { paymentId: 4521, customerId: "77", transactionId: "11111111-2222-4333-8444-555555555555" });
    const lower = returnParams(new URLSearchParams("og-paymentid=12&og-externalidentifier=not-a-uuid"));
    assert.deepEqual(lower, { paymentId: 12, customerId: null, transactionId: null });
    assert.equal(returnParams(new URLSearchParams("OG-PaymentID=abc")).paymentId, null);
  });

  test("landing texts", () => {
    assert.equal(purchaseOutcomeText("success", 5)?.text.includes("5 סרטונים"), true);
    assert.equal(purchaseOutcomeText("cancelled")?.tone, "info");
    assert.equal(purchaseOutcomeText("failed")?.tone, "error");
    assert.equal(purchaseOutcomeText(null), null);
  });
});
