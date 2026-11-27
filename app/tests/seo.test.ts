import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  ORGANIZATION_ID,
  PUBLIC_PAGES,
  ROBOTS_DISALLOW,
  SITE_URL,
  absoluteUrl,
  faqJsonLd,
  homeJsonLd,
  isDisallowed,
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

  test("sitemap: home + the four legal pages, absolute https urls, dated by the admin's last save", () => {
    const entries = sitemapEntries({});
    assert.deepEqual(
      entries.map((e) => e.url),
      ["/", "/terms", "/privacy", "/refunds", "/accessibility"].map((p) => `${SITE_URL}${p}`)
    );
    for (const e of entries) {
      assert.match(e.url, /^https:\/\/www\.mashpian\.online\//);
      assert.equal(e.lastModified, undefined, "no save yet = no made-up date");
      assert.ok(e.priority > 0 && e.priority <= 1);
    }
    assert.equal(entries[0].priority, 1, "the home page comes first with the top priority");
    const dated = sitemapEntries({ home_hero: "2026-11-24T00:13:00Z", home_cta: "2026-11-23T20:00:00Z", legal_terms: "not a date", legal_privacy: null });
    assert.equal(dated[0].lastModified?.toISOString(), "2026-11-24T00:13:00.000Z", "the latest save among the home sections");
    assert.equal(dated[1].lastModified, undefined, "an unparsable date is ignored");
    assert.equal(dated[2].lastModified, undefined);
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

    const graph = homeJsonLd(content, { price_min: 99 });
    assert.equal(graph["@context"], "https://schema.org");
    const nodes = graph["@graph"] as Record<string, unknown>[];
    assert.deepEqual(nodes.map((n) => n["@type"]), ["Organization", "WebSite", "Service"]);
    const withFaq = homeJsonLd(content, {}, [{ question: "מה זה UGC?", answer: "תוכן שמצלמים אנשים אמיתיים." }, { question: "", answer: "x" }]);
    const faq = (withFaq["@graph"] as Record<string, unknown>[])[3];
    assert.equal(faq["@type"], "FAQPage");
    assert.equal((faq.mainEntity as unknown[]).length, 1, "empty pairs are skipped");
    assert.equal(faqJsonLd([]), null);
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
