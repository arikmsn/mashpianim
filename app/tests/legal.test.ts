import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { needsTermsAcceptance, TERMS, PRIVACY, REFUNDS, LEGAL_DOCUMENTS, LEGAL_ORDER, TERMS_VERSION } from "../src/lib/legal.ts";

describe("terms acceptance (owner, 2026-11-09)", () => {
  test("who still has to accept", () => {
    assert.equal(needsTermsAcceptance(null), false, "profile not loaded yet → do not block");
    assert.equal(needsTermsAcceptance(undefined), false);
    assert.equal(needsTermsAcceptance({}), true, "never accepted");
    assert.equal(needsTermsAcceptance({ terms_accepted_at: null, terms_version: TERMS_VERSION }), true);
    assert.equal(needsTermsAcceptance({ terms_accepted_at: "2026-11-10T10:00:00Z", terms_version: TERMS_VERSION }), false);
    assert.equal(needsTermsAcceptance({ terms_accepted_at: "2026-11-10T10:00:00Z", terms_version: "2026-01-01" }), true, "older version → ask again");
    assert.equal(needsTermsAcceptance({ terms_accepted_at: "2026-11-10T10:00:00Z", terms_version: null }), true);
    assert.match(TERMS_VERSION, /^\d{4}-\d{2}-\d{2}$/);
  });

  test("the documents carry the owner's key clause and the basics", () => {
    const text = (doc: typeof TERMS) => [doc.intro, ...doc.sections.flatMap((s) => [s.title, ...(s.paragraphs || []), ...(s.bullets || []), ...(s.after || [])])].join("\n");
    const terms = text(TERMS);
    // The platform is a connecting venue only: not liable for the product, the shipping, the video or the consideration
    for (const phrase of ["גוף מקשר", "אינה אחראית", "משלוח", "לאיכות הסרטון", "התמורה", "לא צד להסכם"]) assert.ok(terms.includes(phrase), `terms mention: ${phrase}`);
    // Age, law and venue, contact
    assert.ok(terms.includes("18"));
    assert.ok(terms.includes("הדין הישראלי") && terms.includes("תל אביב"));
    assert.ok(/צור קשר/.test(terms));
    // No company number yet, no copied brand names
    assert.ok(!/ח\.פ|ח״פ|חברה מס/.test(terms));
    for (const doc of [TERMS, PRIVACY, REFUNDS]) assert.ok(!/dipy/i.test(text(doc)), `${doc.slug} must not mention the reference site`);
    // Privacy covers data, sharing, retention, rights, cookies, minors
    const privacy = text(PRIVACY);
    for (const phrase of ["הגנת הפרטיות", "וואטסאפ", "Supabase", "מחיק", "עוגיות", "18"]) assert.ok(privacy.includes(phrase), `privacy mention: ${phrase}`);
    // Refunds: the 14-day window, the 12-month validity, no refunds for products/videos
    const refunds = text(REFUNDS);
    for (const phrase of ["14 ימים", "12 חודשים", "אינו מוחזר", "סבב תיקונים אחד"]) assert.ok(refunds.includes(phrase), `refunds mention: ${phrase}`);
    assert.deepEqual(LEGAL_ORDER, ["terms", "privacy", "refunds"]);
    for (const slug of LEGAL_ORDER) assert.equal(LEGAL_DOCUMENTS[slug].slug, slug);
  });
});
