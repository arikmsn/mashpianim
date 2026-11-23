import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  CONTENT_VARIABLES,
  SECTIONS,
  SITE_CONTENT_DEFAULTS,
  SITE_CONTENT_SCHEMA,
  contentVars,
  defaultsFromSchema,
  getSection,
  hasHebrew,
  mergeSiteContent,
  resolveSiteContent,
  resolveVariables,
  sanitizeSectionInput,
  sectionViewHref,
  sectionsForPage,
  splitMarker,
  stripMarker,
  unknownVariables,
  validateFieldValue,
  validateSchema,
} from "../src/lib/site-content.ts";
import { markdownToText } from "../src/lib/markdown.ts";
import { TERMS_VERSION } from "../src/lib/legal.ts";

describe("site content registry (design package v3, ניהול תוכן מהאדמין)", () => {
  test("the schema is sound: unique ids and keys, defaults within limits, only known variables", () => {
    assert.deepEqual(validateSchema(), []);
    assert.ok(SITE_CONTENT_SCHEMA.length >= 18);
    // The home page sections are namespaced so the old landing rows (hero, stats…) never leak into the new design
    for (const s of sectionsForPage("home")) assert.match(s.id, /^home_/);
    for (const id of ["hero", "stats", "brands", "creators", "cta_final", "footer", "how_it_works"]) assert.equal(getSection(id), undefined, `old section ${id} is not in the schema`);
    // Every page tab has at least one section
    for (const page of ["home", "quiz", "legal", "seo", "system"] as const) assert.ok(sectionsForPage(page).length > 0, page);
  });

  test("defaults, merge and coercion", () => {
    const d = defaultsFromSchema();
    assert.equal(d.home_hero.title, "התוכן הנכון. *האנשים הנכונים.*");
    const merged = mergeSiteContent({
      home_hero: { title: "כותרת חדשה", sticker1: "", unknown_key: "x", subtitle: 42 },
      home_stats: { stat1_value: "200", stat3_dark: "false" },
      home_how: { steps: [{ tag: "01", title: "א", desc: "ב", junk: 1 }, { tag: "02", title: "ג" }, { tag: "03", title: "ד" }] },
      home_footer: { links: [{ label: "x", href: "/x" }] },
      quiz: { q1_options: "not a list" },
      nope: { a: 1 },
      hero: { title_line1: "old landing text" },
    });
    assert.equal(merged.home_hero.title, "כותרת חדשה");
    assert.equal(merged.home_hero.sticker1, "", "allowEmpty keeps the empty override (hides the sticker)");
    assert.equal(merged.home_hero.subtitle, SITE_CONTENT_DEFAULTS.home_hero.subtitle, "a non-string falls back");
    assert.equal((merged.home_hero as Record<string, unknown>).unknown_key, undefined, "unknown keys are dropped");
    assert.equal(merged.home_stats.stat1_value, "200");
    assert.equal(merged.home_stats.stat3_dark, false, "toggle accepts 'false'");
    assert.equal(merged.home_how.steps.length, 3);
    assert.equal(merged.home_how.steps[1].desc, "", "missing item keys become empty strings");
    assert.equal((merged.home_how.steps[0] as Record<string, unknown>).junk, undefined);
    assert.equal(merged.home_footer.links.length, 1);
    assert.deepEqual(merged.quiz.q1_options, SITE_CONTENT_DEFAULTS.quiz.q1_options, "a broken list falls back to the default");
    assert.equal(merged.home_creators.title, SITE_CONTENT_DEFAULTS.home_creators.title, "untouched sections are defaults");
    assert.equal((merged as unknown as Record<string, unknown>).nope, undefined);
    // An empty string on a required text falls back to the default
    assert.equal(mergeSiteContent({ home_hero: { title: "   " } }).home_hero.title, SITE_CONTENT_DEFAULTS.home_hero.title);
  });

  test("sanitizeSectionInput keeps only schema keys and never the readonly version", () => {
    const section = getSection("legal_terms")!;
    const out = sanitizeSectionInput(section, { title: "x", version: "2099-01-01", body: "# a", junk: true });
    assert.deepEqual(Object.keys(out).sort(), ["body", "title"]);
    const how = sanitizeSectionInput(getSection("home_how")!, { steps: [{ tag: "1", title: "t", desc: "d" }, { tag: "2", title: "t2", desc: "" }, { tag: "3", title: "t3", desc: "" }], eyebrow: "" });
    assert.equal((how.steps as unknown[]).length, 3);
    assert.equal(how.eyebrow, "", "an empty string is stored as is (the merge falls back later)");
  });

  test("variables and the *marker*", () => {
    assert.deepEqual([...CONTENT_VARIABLES], ["creators", "videos", "price_min", "discount", "days"]);
    assert.equal(resolveVariables("{creators} יוצרים, {nope}", { creators: 137 }), "137 יוצרים, {nope}");
    assert.deepEqual(unknownVariables("{creators} {foo} {bar}"), ["foo", "bar"]);
    assert.deepEqual(splitMarker("התוכן הנכון. *האנשים הנכונים.*"), { before: "התוכן הנכון. ", marked: "האנשים הנכונים.", after: "" });
    assert.deepEqual(splitMarker("בלי כוכביות"), { before: "בלי כוכביות", marked: "", after: "" });
    assert.equal(stripMarker("א *ב* ג"), "א ב ג");
    const vars = contentVars(SITE_CONTENT_DEFAULTS, { priceMin: 99, discount: 15, days: 10 });
    assert.equal(vars.creators, SITE_CONTENT_DEFAULTS.home_stats.stat1_value);
    const resolved = resolveSiteContent(SITE_CONTENT_DEFAULTS, vars);
    assert.equal(resolved.home_brands.price_note, "חבילות מ-99 ₪ לסרטון. 15% הנחה ברכישה הראשונה.");
    assert.equal(resolved.home_hero.counter_line, `${vars.videos} סרטונים · ${vars.creators} יוצרים`);
    assert.equal(resolved.home_how.steps[2].desc.includes("{days}"), false, "variables inside list items are resolved too");
    assert.equal(resolved.home_stats.stat3_value, "10");
  });

  test("field validation warns, never blocks", () => {
    const hero = getSection("home_hero")!;
    const title = hero.fields.find((f) => f.key === "title")!;
    assert.deepEqual(validateFieldValue(title, "קצר"), []);
    assert.equal(validateFieldValue(title, "x".repeat(61)).length, 1);
    assert.match(validateFieldValue(title, "{what}")[0], /משתנה לא מוכר/);
    const nav = getSection("home_nav")!;
    const href = nav.fields.find((f) => f.key === "link1_href")!;
    assert.deepEqual(validateFieldValue(href, "#biz"), []);
    assert.deepEqual(validateFieldValue(href, "https://example.com/x"), []);
    assert.equal(validateFieldValue(href, "http://insecure").length, 1);
    assert.equal(validateFieldValue(href, "javascript:alert(1)").length, 1);
    const body = getSection("legal_terms")!.fields.find((f) => f.key === "body")!;
    assert.match(validateFieldValue(body, "<script>x</script>")[0], /HTML/);
    const steps = getSection("home_how")!.fields.find((f) => f.key === "steps")!;
    assert.match(validateFieldValue(steps, [{ tag: "1", title: "t", desc: "d" }])[0], /לפחות 3/);
  });

  test("legal documents moved into the registry keep the owner's clauses, and the terms version", () => {
    const terms = markdownToText(SITE_CONTENT_DEFAULTS.legal_terms.body);
    for (const phrase of ["גוף מקשר", "אינה אחראית", "הדין הישראלי", "תל אביב", "5568"]) assert.ok(terms.includes(phrase), `terms mention: ${phrase}`);
    assert.ok(SITE_CONTENT_DEFAULTS.legal_terms.body.includes("[להצהרת הנגישות](/accessibility)"), "links survive as markdown");
    assert.equal(SITE_CONTENT_DEFAULTS.legal_terms.version, TERMS_VERSION);
    const refunds = markdownToText(SITE_CONTENT_DEFAULTS.legal_refunds.body);
    for (const phrase of ["14 ימים", "12 חודשים"]) assert.ok(refunds.includes(phrase));
    assert.equal(sectionViewHref(getSection("legal_privacy")!), "/privacy");
    assert.equal(sectionViewHref(getSection("home_brands")!), "/#biz");
    assert.equal(sectionViewHref(getSection("quiz")!), "/#inf");
  });

  test("the hero fan and the bento posters are real system media, and tags stay out of the mono font when Hebrew", async () => {
    const fan = SITE_CONTENT_DEFAULTS.home_fan;
    assert.ok(fan.tiles.length >= 4 && fan.tiles.length <= 8);
    for (const t of fan.tiles) {
      assert.match(t.video_url, /^https:\/\/.*\/storage\/v1\/object\/public\/videos\/portfolio\//);
      assert.match(t.poster_url, /^https:\/\/.*\/storage\/v1\/object\/public\/thumbnails\/portfolio\//);
      assert.ok(t.caption.length > 0);
    }
    assert.ok(SITE_CONTENT_DEFAULTS.home_brands.gallery_posters.length >= 3);
    assert.ok(SITE_CONTENT_DEFAULTS.home_brands.approved_posters.length >= 1);
    // The gallery deck, the match avatars and the approved videos show other creators than the hero fan, and
    // never the same creator twice (owner's review round 2)
    const creatorOf = (url: string) => url.match(/\/portfolio\/([0-9a-f-]+)\//)?.[1] ?? url;
    const fanCreators = new Set(fan.tiles.map((t) => creatorOf(t.poster_url)));
    const bento = [...SITE_CONTENT_DEFAULTS.home_brands.gallery_posters, ...SITE_CONTENT_DEFAULTS.home_brands.approved_posters];
    const bentoCreators = bento.map((p) => creatorOf(p.image_url));
    for (const c of bentoCreators) assert.ok(!fanCreators.has(c), `bento poster of a fan creator: ${c}`);
    assert.equal(new Set(bentoCreators).size, bentoCreators.length, "a creator repeats in the bento posters");
    for (const p of bento) assert.match(p.caption, /^[^,]+, [^,]+$/, `caption "name, field": ${p.caption}`);
    // No Latin decoration left in the defaults of the public home page and the quiz
    const latin = /[A-Za-z]{3,}/;
    const noVars = (s: string) => s.replace(/\{[a-z_]+\}/g, "");
    for (const [k, v] of Object.entries(SITE_CONTENT_DEFAULTS.home_hero)) if (typeof v === "string") assert.ok(!latin.test(noVars(v)), `home_hero.${k}: ${v}`);
    for (const [k, v] of Object.entries(SITE_CONTENT_DEFAULTS.home_tracks)) if (typeof v === "string" && k !== "brand_title") assert.ok(!latin.test(noVars(v)), `home_tracks.${k}: ${v}`);
    for (const opts of [SITE_CONTENT_DEFAULTS.quiz.q2_options, SITE_CONTENT_DEFAULTS.quiz.q4_options, SITE_CONTENT_DEFAULTS.quiz.q5_options]) for (const o of opts) assert.equal(o.tag, "");
    const { isMonoText, tagClass } = await import("../src/components/home/styles.ts");
    assert.ok(isMonoText("01") && isMonoText("10K-100K") && isMonoText("0 ₪") && isMonoText("") && !isMonoText("עד 10K") && !isMonoText("מהמערכת"));
    assert.match(tagClass("02"), /font-mono/);
    assert.doesNotMatch(tagClass("מדיניות"), /font-mono/);
  });

  test("quiz option keys match the lead schema of migration 026", () => {
    const q = SITE_CONTENT_DEFAULTS.quiz;
    const keys = (opts: Record<string, string>[]) => opts.map((o) => o.key);
    assert.deepEqual(keys(q.q1_options), ["nano", "micro", "macro", "unsure"]);
    assert.deepEqual(keys(q.q2_options), ["instagram", "tiktok", "youtube", "undecided"]);
    assert.deepEqual(keys(q.q3_options), ["beauty", "fashion", "food", "home", "tech", "other"]);
    assert.deepEqual(keys(q.q4_options), ["all", "center", "north", "south_jerusalem"]);
    assert.deepEqual(keys(q.q5_options), ["content", "post", "both", "unsure"]);
    assert.equal(q.q2_multi, true);
    assert.equal(q.q1_multi, false);
  });

  test("acceptance: no Hebrew in the public page components (everything comes from the registry)", () => {
    const root = join(process.cwd(), "src");
    const files = [
      "app/page.tsx",
      "app/not-found.tsx",
      "app/opengraph-image.tsx",
      "app/login/page.tsx",
      "app/login/login-client.tsx",
      "app/register/page.tsx",
      "app/register/register-client.tsx",
      "components/features/influencer-quiz.tsx",
      "components/features/legal-document.tsx",
      ...readdirSync(join(root, "components/home")).map((f) => `components/home/${f}`),
      ...readdirSync(join(root, "components/auth")).map((f) => `components/auth/${f}`),
    ];
    for (const f of files) {
      const source = readFileSync(join(root, f), "utf8");
      assert.ok(!hasHebrew(source), `${f} must not contain hardcoded Hebrew`);
    }
    assert.ok(hasHebrew("שלום"));
    assert.ok(!hasHebrew("hello"));
  });

  test("no em dashes in the new Hebrew copy of the home page, the quiz and the auth screens", () => {
    const check = (sectionId: string) => {
      const rec = (SITE_CONTENT_DEFAULTS as unknown as Record<string, Record<string, unknown>>)[sectionId];
      for (const [k, v] of Object.entries(rec)) {
        const text = typeof v === "string" ? v : Array.isArray(v) ? JSON.stringify(v) : "";
        assert.ok(!text.includes("—"), `${sectionId}.${k} has an em dash`);
      }
    };
    for (const s of SECTIONS) if (s.id.startsWith("home_") || s.id === "quiz" || s.id === "auth" || s.id === "seo" || s.id === "errors") check(s.id);
  });
});
