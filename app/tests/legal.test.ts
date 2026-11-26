import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { needsTermsAcceptance, needsVideoPromoConsent, LEGAL_CONSENT_TEXT, TERMS, PRIVACY, REFUNDS, ACCESSIBILITY, ACCESSIBILITY_CONTACT, LEGAL_DOCUMENTS, LEGAL_ORDER, TERMS_VERSION } from "../src/lib/legal.ts";

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
    assert.deepEqual(LEGAL_ORDER, ["terms", "privacy", "refunds", "accessibility"]);
    for (const slug of LEGAL_ORDER) assert.equal(LEGAL_DOCUMENTS[slug].slug, slug);
  });

  test("accessibility statement (owner, 2026-11-11): the standard, an honest status, a reachable coordinator, a date; the terms point to it", () => {
    const text = (doc: typeof TERMS) =>
      [doc.intro, ...doc.sections.flatMap((s) => [s.title, ...(s.paragraphs || []), ...(s.bullets || []), ...(s.links || []).map((l) => l.label), ...(s.after || [])])].join("\n");
    const a = text(ACCESSIBILITY);
    for (const phrase of ["5568", "WCAG 2.0", "AA", 'התשע"ג-2013', "בתהליך הנגשה", "רכז/ת הנגישות", "בעבודה", "נציבות שוויון זכויות", ACCESSIBILITY_CONTACT.phoneDisplay, ACCESSIBILITY_CONTACT.email, ACCESSIBILITY_CONTACT.statementDate]) {
      assert.ok(a.includes(phrase), `accessibility statement mentions: ${phrase}`);
    }
    // The contacts are clickable (tel / mailto) and carry no personal name — requests go to the coordinator
    const links = ACCESSIBILITY.sections.flatMap((s) => s.links || []);
    assert.ok(links.some((l) => l.href === ACCESSIBILITY_CONTACT.phoneHref), "tel link");
    assert.ok(links.some((l) => l.href === `mailto:${ACCESSIBILITY_CONTACT.email}`), "mailto link");
    assert.match(ACCESSIBILITY_CONTACT.phoneHref, /^tel:\+972\d{9}$/);
    assert.equal(LEGAL_DOCUMENTS.accessibility.slug, "accessibility");
    // The terms gained an informational clause that links to the statement — without re-gating every user
    const terms = text(TERMS);
    assert.ok(terms.includes("נגישות") && terms.includes("5568"), "terms mention accessibility and the standard");
    assert.ok(TERMS.sections.some((s) => (s.links || []).some((l) => l.href === "/accessibility")), "terms link to /accessibility");
    assert.equal(TERMS_VERSION, "2026-11-26", "bumped deliberately on 2026-11-26 for the video rights in section 8; an informational clause must not bump it");
  });
});

describe("video rights and promotion consent (owner, 2026-11-26)", () => {
  const accepted = { terms_accepted_at: "2026-11-26T10:00:00Z", terms_version: TERMS_VERSION };

  test("the separate consent is asked for only once its column exists (migration 028)", () => {
    assert.equal(needsTermsAcceptance(accepted), false, "column missing (undefined) → only the terms count");
    assert.equal(needsVideoPromoConsent(accepted), false);
    assert.equal(needsTermsAcceptance({ ...accepted, video_promo_consent_at: null }), true, "column present, never consented → gate");
    assert.equal(needsVideoPromoConsent({ ...accepted, video_promo_consent_at: null }), true);
    assert.equal(needsTermsAcceptance({ ...accepted, video_promo_consent_at: "2026-11-26T10:00:00Z", video_promo_consent_version: TERMS_VERSION }), false);
    assert.equal(needsTermsAcceptance({ ...accepted, video_promo_consent_at: "2026-11-10T10:00:00Z", video_promo_consent_version: "2026-11-10" }), true, "older version → ask again");
  });

  test("an account that accepted the previous version is asked again", () => {
    assert.equal(needsTermsAcceptance({ terms_accepted_at: "2026-11-10T10:00:00Z", terms_version: "2026-11-10" }), true);
  });

  test("section 8 states both licences plainly: business on delivered videos, platform promotion with opt-out", () => {
    const s8 = (TERMS.sections.find((s) => s.title.startsWith("8.")) as { paragraphs: string[] }).paragraphs.join("\n");
    for (const phrase of ["8.2", "רישיון מלא", "שיווק ופרסום של העסק", "8.3", "קידום הפלטפורמה", "דף הבית", "ברשתות החברתיות", "הסכמה נפרדת", "8.4", "לא ישמש עוד"]) {
      assert.ok(s8.includes(phrase), `section 8 mentions: ${phrase}`);
    }
    const privacy = PRIVACY.sections.flatMap((s) => s.bullets || []).join("\n");
    assert.ok(privacy.includes("לקדם את הפלטפורמה באמצעות סרטונים"), "privacy policy lists the promotional use");
    assert.ok(LEGAL_CONSENT_TEXT.videoPromoCreator.includes("8.3") && LEGAL_CONSENT_TEXT.videoPromoBrand.includes("8.3"));
    assert.ok(LEGAL_CONSENT_TEXT.brandLicense.includes("רישיון"));
  });
});
