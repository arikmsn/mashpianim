import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  hasSeen,
  markSeen,
  normalizeOnboarding,
  isOnboardingStep,
  isClientOnboardingHow,
  shouldShowWelcome,
  isMatchedStatus,
  welcomeCards,
  firstHeartMoment,
  firstMatchMoment,
  mergeOnboardingContent,
  ONBOARDING_WELCOME_SECTION,
  ONBOARDING_MOMENTS_SECTION,
  MIN_PORTFOLIO_FOR_HEARTS,
} from "../src/lib/onboarding.ts";
import { TERMS_VERSION } from "../src/lib/legal.ts";

const accepted = { type: "creator", terms_accepted_at: "2026-11-10T00:00:00Z", terms_version: TERMS_VERSION };

describe("first-time walkthrough flags", () => {
  test("marks are additive, timestamped, and the first ending wins", () => {
    const t0 = new Date("2026-11-11T10:00:00Z");
    const a = markSeen({}, "welcome", "skipped", t0);
    assert.deepEqual(a, { welcome: { at: t0.toISOString(), how: "skipped" } });
    assert.equal(hasSeen(a, "welcome"), true);
    assert.equal(hasSeen(a, "first_heart"), false);
    const b = markSeen(a, "welcome", "done", new Date("2026-11-12T10:00:00Z"));
    assert.equal(b.welcome?.how, "skipped", "a later ending never overwrites the first one");
    const c = markSeen(b, "first_match", "done", t0);
    assert.equal(Object.keys(c).length, 2);
    assert.equal(Object.keys(a).length, 1, "inputs are not mutated");
  });

  test("normalisation drops junk and unknown steps, keeps backfill marks", () => {
    assert.deepEqual(normalizeOnboarding(null), {});
    assert.deepEqual(normalizeOnboarding("x"), {});
    assert.deepEqual(normalizeOnboarding([1]), {});
    const n = normalizeOnboarding({ welcome: { at: "2026-11-11T00:00:00Z", how: "weird" }, first_heart: { at: "2026-11-11T00:00:00Z", how: "backfill" }, other: { at: "x" }, first_match: "nope" });
    assert.deepEqual(n, { welcome: { at: "2026-11-11T00:00:00Z", how: "done" }, first_heart: { at: "2026-11-11T00:00:00Z", how: "backfill" } });
  });

  test("validation of what a client may send", () => {
    assert.equal(isOnboardingStep("welcome"), true);
    assert.equal(isOnboardingStep("first_match"), true);
    assert.equal(isOnboardingStep("terms"), false);
    assert.equal(isClientOnboardingHow("done"), true);
    assert.equal(isClientOnboardingHow("skipped"), true);
    assert.equal(isClientOnboardingHow("backfill"), false, "backfill is a migration-only ending");
  });

  test("the welcome shows to creators once, after the terms gate, never to admins or businesses", () => {
    assert.equal(shouldShowWelcome({ role: "creator", user: accepted, state: {} }), true);
    assert.equal(shouldShowWelcome({ role: "creator", user: accepted, state: markSeen({}, "welcome", "skipped") }), false, "skip counts as seen");
    assert.equal(shouldShowWelcome({ role: "creator", user: { ...accepted, terms_accepted_at: null }, state: {} }), false, "terms gate first");
    assert.equal(shouldShowWelcome({ role: "creator", user: { ...accepted, terms_version: "2020-01-01" }, state: {} }), false);
    assert.equal(shouldShowWelcome({ role: "brand", user: accepted, state: {} }), false);
    assert.equal(shouldShowWelcome({ role: "creator", user: { ...accepted, type: "admin" }, state: {} }), false);
    assert.equal(shouldShowWelcome({ role: "creator", user: null, state: {} }), false);
  });

  test("a match is any status after the brand confirmed", () => {
    assert.equal(isMatchedStatus("pending"), false);
    assert.equal(isMatchedStatus("rejected"), false);
    assert.equal(isMatchedStatus("cancelled"), false);
    assert.equal(isMatchedStatus("approved"), true);
    assert.equal(isMatchedStatus("delivered"), true);
    assert.equal(isMatchedStatus("completed"), true);
    assert.equal(isMatchedStatus(null), false);
  });

  test("welcome cards: three, plus the portfolio card first while the gate is closed", () => {
    const full = welcomeCards(5);
    assert.equal(full.length, 3);
    assert.match(full[0].title, /לב/);
    assert.match(full[1].title, /מאטץ/);
    assert.match(full[2].body, /בריף/);
    const short = welcomeCards(2);
    assert.equal(short.length, 4);
    assert.ok(short[0].title.includes(String(MIN_PORTFOLIO_FOR_HEARTS)));
    assert.equal(welcomeCards(null).length, 3, "unknown count: don't nag about the portfolio");
    for (const c of [...full, ...short]) assert.ok(c.body.length <= 160, `card body stays short: ${c.body.length}`);
  });

  test("moment copy mentions the next screen", () => {
    assert.match(firstHeartMoment(false).lines.join(" "), /חיבורים/);
    assert.match(firstHeartMoment(true).title, /מאטץ/);
    assert.match(firstMatchMoment().lines.join(" "), /בריף/);
    assert.equal(firstMatchMoment().primary, "לצ'אט עם העסק");
  });

  test("admin overrides replace the copy, blanks and unknown keys fall back to defaults", () => {
    const merged = mergeOnboardingContent({
      [ONBOARDING_WELCOME_SECTION]: { card_heart_title: "לב מותאם", card_heart_body: "   ", bogus: "x" },
      [ONBOARDING_MOMENTS_SECTION]: { match_title: "מאטץ' מותאם" },
    });
    // overridden
    assert.equal(welcomeCards(5, merged.welcome)[0].title, "לב מותאם");
    assert.equal(firstMatchMoment(merged.moments).title, "מאטץ' מותאם");
    // blank override is ignored (keeps the default), unknown key is dropped
    assert.match(welcomeCards(5, merged.welcome)[0].body, /גללו/);
    assert.equal((merged.welcome as Record<string, string>).bogus, undefined);
    // the portfolio card's default still appears when under the threshold
    assert.equal(welcomeCards(2, merged.welcome).length, 4);
  });

  test("mergeOnboardingContent(null) yields the built-in defaults", () => {
    const d = mergeOnboardingContent(null);
    assert.equal(welcomeCards(5, d.welcome)[0].title, welcomeCards(5)[0].title);
    assert.equal(firstMatchMoment(d.moments).primary, firstMatchMoment().primary);
  });
});
