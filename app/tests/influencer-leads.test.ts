import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { answersSummary, isLeadStatus, LEAD_STATUSES, normalizeAnswers, normalizeIsraeliPhone, quizQuestions, utmFromSearch, validateLeadInput } from "../src/lib/influencer-leads.ts";
import { SITE_CONTENT_DEFAULTS } from "../src/lib/site-content.ts";

const questions = quizQuestions(SITE_CONTENT_DEFAULTS.quiz);

describe("influencer quiz leads (design package v3, Phase C)", () => {
  test("the five questions come from the content with their stable keys", () => {
    assert.deepEqual(questions.map((q) => q.key), ["tier", "platforms", "regions", "videos", "product"]);
    assert.equal(questions[0].multi, false);
    assert.equal(questions[1].multi, true);
    assert.equal(questions[2].options.length, 11, "the regions of the system plus all of Israel");
    assert.ok(questions.every((q) => q.question && q.options.every((o) => o.key && o.title)));
  });

  test("answers keep only known keys; single choice keeps one", () => {
    const a = normalizeAnswers({ tier: "micro", platforms: ["tiktok", "nope", "instagram", "tiktok"], regions: "center", videos: ["few", "many"], product: 7, extra: "x" }, questions);
    assert.deepEqual(a, { tier: "micro", platforms: ["tiktok", "instagram"], regions: ["center"], videos: "few" });
  });

  test("phone normalisation accepts Israeli numbers in every common form", () => {
    assert.equal(normalizeIsraeliPhone("050-123-4567"), "+972501234567");
    assert.equal(normalizeIsraeliPhone("+972 50 123 4567"), "+972501234567");
    assert.equal(normalizeIsraeliPhone("972501234567"), "+972501234567");
    assert.equal(normalizeIsraeliPhone("03-6000000"), "+97236000000", "a landline is fine for a lead");
    assert.equal(normalizeIsraeliPhone("12345"), null);
    assert.equal(normalizeIsraeliPhone("+1 212 555 0100"), null);
    assert.equal(normalizeIsraeliPhone(42), null);
  });

  test("validation: required name and phone, optional valid email, trimmed and bounded fields", () => {
    assert.deepEqual(validateLeadInput(null, questions), { ok: false, error: "invalid" });
    assert.deepEqual(validateLeadInput({ phone: "0501234567" }, questions), { ok: false, error: "required_name" });
    assert.deepEqual(validateLeadInput({ full_name: "דנה", phone: " " }, questions), { ok: false, error: "required_phone" });
    assert.deepEqual(validateLeadInput({ full_name: "דנה", phone: "123" }, questions), { ok: false, error: "bad_phone" });
    assert.deepEqual(validateLeadInput({ full_name: "דנה", phone: "0501234567", email: "nope" }, questions), { ok: false, error: "bad_email" });
    const ok = validateLeadInput(
      { full_name: "  דנה כהן ", phone: "050-1234567", email: "Dana@Brand.co.il", business_name: "המותג", note: "x".repeat(600), answers: { tier: "nano" }, utm: { source: "ig", medium: "", campaign: "nov", junk: "y" } },
      questions
    );
    assert.ok(ok.ok);
    if (ok.ok) {
      assert.equal(ok.value.full_name, "דנה כהן");
      assert.equal(ok.value.phone, "+972501234567");
      assert.equal(ok.value.email, "dana@brand.co.il");
      assert.equal(ok.value.note?.length, 500);
      assert.deepEqual(ok.value.answers, { tier: "nano" });
      assert.deepEqual(ok.value.utm, { source: "ig", campaign: "nov" });
    }
    const bare = validateLeadInput({ full_name: "דנה", phone: "0501234567" }, questions);
    assert.ok(bare.ok && bare.value.email === null && bare.value.utm === null && bare.value.business_name === null);
  });

  test("summary uses the titles of the content, statuses are closed", () => {
    assert.equal(answersSummary({ tier: "micro", platforms: ["instagram", "tiktok"], product: "physical" }, questions), "מיקרו · אינסטגרם, טיקטוק · מוצר פיזי");
    assert.equal(answersSummary({ tier: "ghost" }, questions), "ghost", "an unknown key shows as is");
    assert.equal(answersSummary(null, questions), "");
    assert.deepEqual([...LEAD_STATUSES], ["new", "contacted", "qualified", "closed"]);
    assert.ok(isLeadStatus("new") && !isLeadStatus("spam"));
  });

  test("utm from the query string", () => {
    assert.deepEqual(utmFromSearch("?utm_source=ig&utm_campaign=nov&x=1"), { source: "ig", campaign: "nov" });
    assert.equal(utmFromSearch(""), null);
  });
});
