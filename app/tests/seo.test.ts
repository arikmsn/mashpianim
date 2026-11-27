import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  ORGANIZATION_ID,
  PUBLIC_PAGES,
  ROBOTS_DISALLOW,
  SITE_URL,
  WEBSITE_ID,
  aboutJsonLd,
  absoluteUrl,
  faqItemsOf,
  faqJsonLd,
  homeJsonLd,
  isDisallowed,
  llmsTxt,
  organizationJsonLd,
  posterAlt,
  serializeJsonLd,
  serviceJsonLd,
  sitemapEntries,
  webSiteJsonLd,
} from "../src/lib/seo.ts";
import { SITE_CONTENT_DEFAULTS, getSection, mergeSiteContent, resolveSiteContent, type SiteContent } from "../src/lib/site-content.ts";

describe("technical SEO of the public site (robots, sitemap, JSON-LD, alt texts)", () => {
  test("robots: the public pages are crawlable, the signed-in area, the auth screens and the API are not", () => {
    for (const path of ["/admin", "/api", "/feed", "/brand", "/messages", "/profile", "/connections", "/notifications", "/login", "/register"]) {
      assert.ok(ROBOTS_DISALLOW.includes(path), `${path} is disallowed`);
    }
    assert.ok(isDisallowed("/admin/content"));
    assert.ok(isDisallowed("/api/profile"));
    assert.ok(isDisallowed("/brand/connections"));
    assert.ok(!isDisallowed("/"));
    assert.ok(!isDisallowed("/terms"));
    assert.ok(!isDisallowed("/brandless"), "a prefix match needs the slash");
    // Nothing the sitemap lists is hidden from crawlers
    for (const page of PUBLIC_PAGES) assert.ok(!isDisallowed(page.path), `${page.path} is in the sitemap and allowed`);
    assert.ok(!SITE_URL.endsWith("/"));
    assert.equal(absoluteUrl("/terms"), `${SITE_URL}/terms`);
    assert.equal(absoluteUrl("terms"), `${SITE_URL}/terms`);
    assert.equal(absoluteUrl("https://example.com/x"), "https://example.com/x");
  });

  test("sitemap: home, about and the four legal pages, absolute https urls, dated by the admin's last save", () => {
    const entries = sitemapEntries({});
    assert.deepEqual(
      entries.map((e) => e.url),
      ["/", "/about", "/terms", "/privacy", "/refunds", "/accessibility"].map((p) => `${SITE_URL}${p}`)
    );
    for (const e of entries) {
      assert.match(e.url, /^https:\/\/www\.mashpian\.online\//);
      assert.equal(e.lastModified, undefined, "no save yet = no made-up date");
      assert.ok(e.priority > 0 && e.priority <= 1);
    }
    assert.equal(entries[0].priority, 1, "the home page comes first with the top priority");
    const dated = sitemapEntries({ home_hero: "2026-11-24T00:13:00Z", home_cta: "2026-11-23T20:00:00Z", legal_terms: "not a date", legal_privacy: null });
    assert.equal(dated[0].lastModified?.toISOString(), "2026-11-24T00:13:00.000Z", "the latest save among the home sections");
    assert.equal(dated[1].lastModified, undefined, "/about: nothing saved yet");
    assert.equal(dated[2].lastModified, undefined, "an unparsable date is ignored");
    assert.equal(dated[3].lastModified, undefined);
    // Every section a page is dated by exists in the registry
    for (const page of PUBLIC_PAGES) for (const s of page.sections) assert.ok(getSection(s), `${page.path}: section ${s}`);
  });

  test("JSON-LD: Organization, WebSite and Service from the registry, one entity under one name", () => {
    const content = SITE_CONTENT_DEFAULTS;
    const org = organizationJsonLd(content);
    assert.equal(org["@type"], "Organization");
    assert.equal(org["@id"], ORGANIZATION_ID);
    assert.equal(org.name, "משפיען אונליין");
    assert.equal(org.alternateName, "Mashpian");
    assert.equal(org.url, SITE_URL);
    assert.deepEqual(org.logo, { "@type": "ImageObject", url: `${SITE_URL}/icon-512.png`, width: 512, height: 512 });
    assert.ok(String(org.description).includes("Mashpian") && String(org.description).includes("UGC"));
    assert.equal(org.sameAs, undefined, "no social profiles yet = no sameAs (the admin adds them in /admin/content)");
    assert.equal(org.email, "info@mashpian.online");

    const site = webSiteJsonLd(content);
    assert.equal(site["@type"], "WebSite");
    assert.equal(site.inLanguage, "he-IL");
    assert.deepEqual(site.publisher, { "@id": ORGANIZATION_ID });
    assert.equal(site.name, org.name, "the same name on every node");

    const service = serviceJsonLd(content, { price_min: 99 });
    assert.equal(service["@type"], "Service");
    assert.deepEqual(service.provider, { "@id": ORGANIZATION_ID });
    assert.deepEqual(service.areaServed, { "@type": "Country", name: "ישראל" });
    assert.deepEqual(service.offers, { "@type": "Offer", priceCurrency: "ILS", price: 99, url: `${SITE_URL}/register?type=brand` });
    assert.equal(serviceJsonLd(content, {}).offers, undefined, "no price known = no offer");
    assert.equal(serviceJsonLd(content, { price_min: "" }).offers, undefined);

    // The admin's overrides flow in: social profiles (https only), a cleared email
    const edited = resolveSiteContent(
      mergeSiteContent({
        seo: { org_same_as: [{ url: "https://www.instagram.com/mashpian" }, { url: "http://insecure.example" }, { url: "" }], org_email: "" },
      }),
      {}
    );
    const org2 = organizationJsonLd(edited);
    assert.deepEqual(org2.sameAs, ["https://www.instagram.com/mashpian"]);
    assert.equal(org2.email, undefined);
    assert.equal(org2.contactPoint, undefined);

    const graph = homeJsonLd(content, { price_min: 99 }, []);
    assert.equal(graph["@context"], "https://schema.org");
    const nodes = graph["@graph"] as Record<string, unknown>[];
    assert.deepEqual(nodes.map((n) => n["@type"]), ["Organization", "WebSite", "Service"]);
    const withFaq = homeJsonLd(content, {}, [{ question: "מה זה UGC?", answer: "תוכן שמצלמים אנשים אמיתיים." }, { question: "", answer: "x" }]);
    const faq = (withFaq["@graph"] as Record<string, unknown>[])[3];
    assert.equal(faq["@type"], "FAQPage");
    assert.equal((faq.mainEntity as unknown[]).length, 1, "empty pairs are skipped");
    assert.equal(faqJsonLd([]), null);
  });

  test("the FAQ section (GEO): 6 to 10 quotable Hebrew pairs that become the FAQPage node by default", () => {
    const items = faqItemsOf(SITE_CONTENT_DEFAULTS);
    assert.ok(items.length >= 6 && items.length <= 10, String(items.length));
    const questions = items.map((i) => i.question);
    for (const must of ["מה זה UGC?", "כמה עולה סרטון UGC בישראל?", "האם צריך עוקבים כדי להיות יוצר/ת תוכן UGC?", "מי מחזיק בזכויות על הסרטון?", "מה ההבדל בין UGC למשפיענים?"]) {
      assert.ok(questions.includes(must), `FAQ asks: ${must}`);
    }
    for (const i of items) {
      assert.ok(i.answer.length >= 80 && i.answer.length <= 420, `answer length of "${i.question}": ${i.answer.length}`);
      assert.ok(!i.answer.includes("—") && !i.question.includes("—"), "no em dashes");
      assert.ok(!/\[[^\]]+\]\(/.test(i.answer), "answers are plain text (they are quoted verbatim in the schema)");
    }
    // The price answer carries the live price and discount through the registry variables
    const priced = items.find((i) => i.question.startsWith("כמה עולה"))!;
    assert.ok(priced.answer.includes("{price_min}") && priced.answer.includes("{discount}"));
    const resolved = resolveSiteContent(SITE_CONTENT_DEFAULTS, { creators: 500, videos: 353, price_min: 99, discount: 15, days: 7 });
    const resolvedPrice = faqItemsOf(resolved).find((i) => i.question.startsWith("כמה עולה"))!;
    assert.ok(resolvedPrice.answer.includes("מ-99 ₪") && resolvedPrice.answer.includes("15%"));
    // The default home graph ends with the FAQPage built from the same pairs
    const graph = homeJsonLd(resolved, { price_min: 99 });
    const nodes = graph["@graph"] as Record<string, unknown>[];
    assert.deepEqual(nodes.map((n) => n["@type"]), ["Organization", "WebSite", "Service", "FAQPage"]);
    const faqNode = nodes[3] as { mainEntity: { name: string; acceptedAnswer: { text: string } }[] };
    assert.equal(faqNode.mainEntity.length, items.length);
    assert.equal(faqNode.mainEntity[1].acceptedAnswer.text, resolvedPrice.answer);
    // The rights answer agrees with the terms: the business gets a licence, the platform may promote with the videos
    const rights = items.find((i) => i.question.startsWith("מי מחזיק"))!;
    assert.ok(rights.answer.includes("רישיון") && rights.answer.includes("סעיף 8"));
  });

  test("/about: one entity under the same names, an AboutPage node, quotable facts", () => {
    const about = SITE_CONTENT_DEFAULTS.about;
    for (const text of [about.title, about.subtitle, about.meta_description]) assert.ok(text.includes("משפיען אונליין"), "the Hebrew name everywhere");
    assert.ok(about.subtitle.includes("Mashpian") && about.subtitle.includes("mashpian.online"), "the Latin name and the domain in the quotable paragraph");
    assert.ok(about.facts.length >= 6);
    assert.ok(about.facts.some((f) => f.value.includes("{creators}")) && about.facts.some((f) => f.value.includes("{price_min}")), "live numbers through variables");
    assert.ok(about.body.includes("[הרשמה כעסק](/register?type=brand)") && about.body.includes("[הרשמה כיוצר/ת](/register?type=creator)"), "internal links to both registrations");
    assert.ok(!about.body.includes("—"));
    const graph = aboutJsonLd(SITE_CONTENT_DEFAULTS);
    const nodes = graph["@graph"] as Record<string, unknown>[];
    assert.deepEqual(nodes.map((n) => n["@type"]), ["Organization", "AboutPage"]);
    const page = nodes[1];
    assert.equal(page.url, `${SITE_URL}/about`);
    assert.deepEqual(page.about, { "@id": ORGANIZATION_ID });
    assert.deepEqual(page.isPartOf, { "@id": WEBSITE_ID });
    assert.equal(page.name, about.title);
    assert.ok(PUBLIC_PAGES.some((p) => p.path === "/about"), "/about is in the sitemap");
  });

  test("llms.txt follows llmstxt.org: H1, blockquote summary, facts, H2 link lists, the FAQ pairs, no placeholders left", () => {
    const resolved = resolveSiteContent(SITE_CONTENT_DEFAULTS, { creators: 500, videos: 353, price_min: 99, discount: 15, days: 7 });
    const txt = llmsTxt(resolved);
    const lines = txt.split("\n");
    assert.equal(lines[0], "# משפיען אונליין (Mashpian)");
    assert.equal(lines[1], "");
    assert.match(lines[2], /^> .+Mashpian.+UGC/);
    assert.ok(txt.includes("mashpian.online"), "the domain is named");
    assert.ok(txt.includes("יוצרי תוכן רשומים: 500+"), "the facts carry the live numbers");
    const h2 = lines.filter((l) => l.startsWith("## "));
    assert.ok(h2.length >= 3, `H2 sections: ${h2.length}`);
    assert.ok(h2.some((h) => h.includes("שאלות ותשובות")), "the FAQ section");
    assert.ok(h2.some((h) => h.includes("מסמכים נוספים")) && !h2.some((h) => h.endsWith(":")), "the legal section, without the label's colon");
    const links = [...txt.matchAll(/\]\((https:\/\/[^)]+)\)/g)].map((m) => m[1]);
    assert.ok(links.length >= 8, `absolute links: ${links.length}`);
    for (const l of links) assert.ok(l.startsWith(`${SITE_URL}/`), l);
    assert.ok(links.includes(`${SITE_URL}/about`) && links.includes(`${SITE_URL}/terms`) && links.includes(`${SITE_URL}/register?type=brand`));
    assert.ok(txt.includes("- **מה זה UGC?** UGC (User Generated Content)"), "each FAQ pair on one line, question in bold");
    assert.ok(!/\{[a-z_]+\}/.test(txt), "no unresolved {placeholders}");
    assert.ok(!txt.includes("—"));
    assert.ok(!txt.includes("\r"));
  });

  test("the JSON-LD script can never close its own tag", () => {
    const out = serializeJsonLd({ "@type": "Thing", name: "</script><script>alert(1)</script>" });
    assert.ok(!out.includes("</script>"));
    assert.ok(out.includes("\\u003c/script>"));
    assert.deepEqual(JSON.parse(out), { "@type": "Thing", name: "</script><script>alert(1)</script>" }, "still valid JSON");
  });

  test("poster alt texts come from the registry template and the caption", () => {
    const template = SITE_CONTENT_DEFAULTS.seo.poster_alt;
    assert.equal(template, "סרטון UGC של {caption}");
    assert.equal(posterAlt(template, "עדן, בית"), "סרטון UGC של עדן, בית");
    assert.equal(posterAlt("", "עדן, בית"), "עדן, בית", "no template = the caption");
    assert.equal(posterAlt("סרטון", "עדן"), "סרטון עדן", "a template without the placeholder gets the caption after it");
    assert.equal(posterAlt(template, "  "), "", "no caption = a decorative image");
    // The {caption} placeholder is the renderer's own variable, so the registry does not flag it, and it survives
    // the {creators}/{videos} substitution untouched
    const resolved = resolveSiteContent(SITE_CONTENT_DEFAULTS, { creators: 500, videos: 353, price_min: 99, discount: 15, days: 7 });
    assert.equal(resolved.seo.poster_alt, template);
    const seoSection = getSection("seo")!;
    const field = seoSection.fields.find((f) => f.key === "poster_alt")!;
    assert.deepEqual([...(field.variables || [])], ["caption"]);
  });

  test("the SEO section stays Hebrew, within limits and free of em dashes; every public page has the one entity name", () => {
    const seo = SITE_CONTENT_DEFAULTS.seo;
    for (const key of ["org_name", "org_description", "service_name", "service_description", "service_area", "poster_alt"] as const) {
      assert.match(seo[key], /[\u0590-\u05FF]/, `${key} is Hebrew`);
      assert.ok(!seo[key].includes("—"), `${key} has no em dash`);
    }
    assert.equal(seo.org_name, SITE_CONTENT_DEFAULTS.home_nav.brand_name, "the organization name is the brand name on the home page");
    assert.equal(seo.org_name, SITE_CONTENT_DEFAULTS.home_footer.logo_tagline);
    const c: SiteContent = SITE_CONTENT_DEFAULTS;
    assert.ok(c.home_influencers.progress_label.length > 0, "the quiz progress bar has an accessible name");
  });
});
