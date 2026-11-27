// Technical SEO helpers of the public site (2026-11-27): the canonical origin, what robots may crawl, the sitemap
// entries, the JSON-LD graph of the home page and the alt text of the creator posters. Pure (no framework
// imports, unit-tested with node:test); every visible word comes from the content registry (lib/site-content.ts),
// so the admin edits names, descriptions and social profiles in /admin/content → SEO.

import type { ContentVars, SiteContent } from "./site-content.ts";

export const SITE_URL = "https://www.mashpian.online";

// The signed-in area, the auth screens and the API never belong in a search index
export const ROBOTS_DISALLOW: readonly string[] = [
  "/admin",
  "/api",
  "/feed",
  "/brand",
  "/messages",
  "/profile",
  "/connections",
  "/notifications",
  "/products",
  "/login",
  "/register",
  "/auth",
];

export type ChangeFrequency = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";

export interface PublicPage {
  path: string;
  // The registry sections whose last save dates the page (the sitemap's lastModified)
  sections: readonly string[];
  priority: number;
  changeFrequency: ChangeFrequency;
}

// The pages a search engine may index. /about and /blog join the list when they exist (GEO and content hub steps).
export const PUBLIC_PAGES: readonly PublicPage[] = [
  { path: "/", sections: ["home_hero", "home_brands", "home_how", "home_creators", "home_influencers", "home_faq", "home_cta", "seo"], priority: 1, changeFrequency: "weekly" },
  { path: "/about", sections: ["about", "seo"], priority: 0.6, changeFrequency: "monthly" },
  { path: "/blog", sections: ["blog"], priority: 0.7, changeFrequency: "weekly" },
  { path: "/terms", sections: ["legal_terms"], priority: 0.3, changeFrequency: "yearly" },
  { path: "/privacy", sections: ["legal_privacy"], priority: 0.3, changeFrequency: "yearly" },
  { path: "/refunds", sections: ["legal_refunds"], priority: 0.3, changeFrequency: "yearly" },
  { path: "/accessibility", sections: ["legal_accessibility"], priority: 0.3, changeFrequency: "yearly" },
];

export interface SitemapEntry {
  url: string;
  lastModified?: Date;
  changeFrequency: ChangeFrequency;
  priority: number;
}

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

// lastModified = the latest save among the page's sections; a page nobody saved yet carries no date (search
// engines ignore made-up dates anyway)
export function sitemapEntries(updatedAt: Record<string, string | null | undefined>, pages: readonly PublicPage[] = PUBLIC_PAGES): SitemapEntry[] {
  return pages.map((page) => {
    let latest: Date | undefined;
    for (const section of page.sections) {
      const raw = updatedAt[section];
      if (!raw) continue;
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) continue;
      if (!latest || d > latest) latest = d;
    }
    return { url: absoluteUrl(page.path), ...(latest ? { lastModified: latest } : {}), changeFrequency: page.changeFrequency, priority: page.priority };
  });
}

// Is a path hidden from crawlers by the robots rules (used by the tests so the sitemap never lists one)
export function isDisallowed(path: string, disallow: readonly string[] = ROBOTS_DISALLOW): boolean {
  return disallow.some((d) => path === d || path.startsWith(`${d}/`));
}

// ---------------------------------------------------------------------------------------------------------------
// JSON-LD
// ---------------------------------------------------------------------------------------------------------------
export type JsonLd = Record<string, unknown>;

export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
export const SERVICE_ID = `${SITE_URL}/#service`;

const clean = (s: unknown): string => (typeof s === "string" ? s.trim() : "");

function httpsUrls(items: readonly Record<string, string>[] | undefined): string[] {
  return (items || []).map((i) => clean(i.url)).filter((u) => /^https:\/\/[^\s]+$/.test(u));
}

export function organizationJsonLd(content: SiteContent): JsonLd {
  const seo = content.seo;
  const sameAs = httpsUrls(seo.org_same_as);
  const email = clean(seo.org_email);
  return {
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: clean(seo.org_name),
    alternateName: clean(seo.org_alt_name),
    url: SITE_URL,
    logo: { "@type": "ImageObject", url: `${SITE_URL}/icon-512.png`, width: 512, height: 512 },
    description: clean(seo.org_description),
    areaServed: { "@type": "Country", name: clean(seo.service_area) },
    ...(sameAs.length ? { sameAs } : {}),
    ...(email ? { email, contactPoint: { "@type": "ContactPoint", contactType: "customer support", email, availableLanguage: ["he"] } } : {}),
  };
}

export function webSiteJsonLd(content: SiteContent): JsonLd {
  const seo = content.seo;
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: clean(seo.org_name),
    alternateName: clean(seo.org_alt_name),
    url: SITE_URL,
    inLanguage: "he-IL",
    description: clean(seo.description),
    publisher: { "@id": ORGANIZATION_ID },
  };
}

// The offer carries the admin's single-video price when the settings know it
export function serviceJsonLd(content: SiteContent, vars?: Partial<ContentVars>): JsonLd {
  const seo = content.seo;
  const price = Number(vars?.price_min);
  const offers = Number.isFinite(price) && price > 0 ? { offers: { "@type": "Offer", priceCurrency: "ILS", price, url: `${SITE_URL}/register?type=brand` } } : {};
  return {
    "@type": "Service",
    "@id": SERVICE_ID,
    name: clean(seo.service_name),
    description: clean(seo.service_description),
    serviceType: clean(seo.service_name),
    provider: { "@id": ORGANIZATION_ID },
    areaServed: { "@type": "Country", name: clean(seo.service_area) },
    url: `${SITE_URL}/#biz`,
    inLanguage: "he-IL",
    ...offers,
  };
}

export interface FaqItem {
  question: string;
  answer: string;
}

// FAQPage from the registry's question / answer pairs (empty pairs are skipped)
export function faqJsonLd(items: readonly FaqItem[]): JsonLd | null {
  const main = items
    .map((i) => ({ q: clean(i.question), a: clean(i.answer) }))
    .filter((i) => i.q && i.a)
    .map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } }));
  if (!main.length) return null;
  return { "@type": "FAQPage", "@id": `${SITE_URL}/#faq`, mainEntity: main };
}

// The registry's FAQ pairs (home_faq.items) in the shape the JSON-LD and llms.txt builders take
export function faqItemsOf(content: SiteContent): FaqItem[] {
  return (content.home_faq?.items || []).map((i) => ({ question: i.question, answer: i.answer }));
}

// The whole graph of the home page
export function homeJsonLd(content: SiteContent, vars?: Partial<ContentVars>, faq: readonly FaqItem[] = faqItemsOf(content)): JsonLd {
  const graph: JsonLd[] = [organizationJsonLd(content), webSiteJsonLd(content), serviceJsonLd(content, vars)];
  const faqNode = faqJsonLd(faq);
  if (faqNode) graph.push(faqNode);
  return { "@context": "https://schema.org", "@graph": graph };
}

// The graph of /about: the page itself, about the one organization
export function aboutJsonLd(content: SiteContent): JsonLd {
  const about = content.about;
  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationJsonLd(content),
      {
        "@type": "AboutPage",
        "@id": `${SITE_URL}/about#page`,
        url: `${SITE_URL}/about`,
        name: clean(about.title),
        description: clean(about.meta_description),
        inLanguage: "he-IL",
        isPartOf: { "@id": WEBSITE_ID },
        about: { "@id": ORGANIZATION_ID },
      },
    ],
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Blog (the content hub): the registry's `blog.posts` list, published ones only, newest first
// ---------------------------------------------------------------------------------------------------------------
export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  // YYYY-MM-DD as the admin typed it ("" when missing or malformed)
  date: string;
  published: boolean;
  body: string;
}

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UNPUBLISHED = new Set(["", "לא", "0", "no", "false", "off"]);

// "כן" (or anything but an explicit no) publishes; an empty flag keeps a draft out of the site
export function isPublishedFlag(value: string): boolean {
  return !UNPUBLISHED.has(clean(value).toLowerCase());
}

export function blogPosts(content: SiteContent, options: { includeUnpublished?: boolean } = {}): BlogPost[] {
  const raw = content.blog?.posts || [];
  const posts: BlogPost[] = [];
  for (const p of raw) {
    const slug = clean(p.slug).toLowerCase();
    const title = clean(p.title);
    const body = clean(p.body);
    const published = isPublishedFlag(p.published);
    if (!SLUG_RE.test(slug) || !title || !body) continue;
    if (!published && !options.includeUnpublished) continue;
    if (posts.some((x) => x.slug === slug)) continue;
    const date = clean(p.date);
    posts.push({ slug, title, excerpt: clean(p.excerpt), date: DATE_RE.test(date) && !Number.isNaN(new Date(date).getTime()) ? date : "", published, body });
  }
  // Newest first; undated posts keep their list order after the dated ones
  return posts
    .map((p, i) => ({ p, i }))
    .sort((a, b) => {
      if (a.p.date && b.p.date && a.p.date !== b.p.date) return a.p.date < b.p.date ? 1 : -1;
      if (a.p.date && !b.p.date) return -1;
      if (!a.p.date && b.p.date) return 1;
      return a.i - b.i;
    })
    .map((x) => x.p);
}

export function blogPost(content: SiteContent, slug: string): BlogPost | null {
  const s = clean(slug).toLowerCase();
  return blogPosts(content).find((p) => p.slug === s) || null;
}

export const blogUrl = (slug: string) => `${SITE_URL}/blog/${slug}`;

// "27 בנובמבר 2026" from the admin's YYYY-MM-DD (UTC, so the day never shifts)
export function formatPostDate(date: string): string {
  if (!date) return "";
  try {
    return new Date(date).toLocaleDateString("he-IL", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
  } catch {
    return date;
  }
}
export const BLOG_ID = `${SITE_URL}/blog#blog`;

export function blogSitemapEntries(content: SiteContent): SitemapEntry[] {
  return blogPosts(content).map((p) => ({ url: blogUrl(p.slug), ...(p.date ? { lastModified: new Date(p.date) } : {}), changeFrequency: "monthly" as const, priority: 0.6 }));
}

// Words of a Markdown body (headings and link labels count, syntax does not)
export function wordCount(markdown: string): number {
  const text = markdown
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#*>\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.split(" ").length : 0;
}

// The graph of /blog: the one organization and the Blog node listing its posts
export function blogJsonLd(content: SiteContent): JsonLd {
  const blog = content.blog;
  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationJsonLd(content),
      {
        "@type": "Blog",
        "@id": BLOG_ID,
        url: `${SITE_URL}/blog`,
        name: clean(blog.meta_title) || clean(blog.title),
        description: clean(blog.meta_description),
        inLanguage: "he-IL",
        isPartOf: { "@id": WEBSITE_ID },
        publisher: { "@id": ORGANIZATION_ID },
        blogPost: blogPosts(content).map((p) => ({ "@type": "BlogPosting", "@id": `${blogUrl(p.slug)}#article`, headline: p.title, url: blogUrl(p.slug), ...(p.date ? { datePublished: p.date } : {}) })),
      },
    ],
  };
}

// The graph of one article
export function articleJsonLd(content: SiteContent, post: BlogPost): JsonLd {
  const url = blogUrl(post.slug);
  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationJsonLd(content),
      {
        "@type": "BlogPosting",
        "@id": `${url}#article`,
        headline: post.title,
        description: post.excerpt,
        url,
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        ...(post.date ? { datePublished: post.date, dateModified: post.date } : {}),
        inLanguage: "he-IL",
        wordCount: wordCount(post.body),
        author: { "@id": ORGANIZATION_ID },
        publisher: { "@id": ORGANIZATION_ID },
        isPartOf: { "@id": BLOG_ID },
        image: `${SITE_URL}/opengraph-image`,
      },
    ],
  };
}

// ---------------------------------------------------------------------------------------------------------------
// llms.txt (https://llmstxt.org): a Markdown summary for AI crawlers, built from the registry so the admin's
// edits reach it within the hour. Shape: H1 title, blockquote summary, a few paragraphs of facts, H2 link lists.
// ---------------------------------------------------------------------------------------------------------------
const oneLine = (s: string) => clean(s).replace(/\s+/g, " ");

export function llmsTxt(content: SiteContent): string {
  const seo = content.seo;
  const about = content.about;
  const name = clean(seo.org_name);
  const alt = clean(seo.org_alt_name);
  const lines: string[] = [];
  lines.push(`# ${name}${alt ? ` (${alt})` : ""}`);
  lines.push("");
  lines.push(`> ${oneLine(seo.org_description)}`);
  lines.push("");
  if (clean(about.subtitle)) {
    lines.push(oneLine(about.subtitle));
    lines.push("");
  }
  const facts = (about.facts || []).map((f) => ({ label: oneLine(f.label), value: oneLine(f.value) })).filter((f) => f.label && f.value);
  if (facts.length) {
    lines.push(facts.map((f) => `${f.label}: ${f.value}`).join(". ") + ".");
    lines.push("");
  }
  lines.push(`## ${clean(content.home_nav.brand_name) || name}`);
  lines.push("");
  const pages: { path: string; title: string; note: string }[] = [
    { path: "/", title: clean(seo.title), note: oneLine(seo.description) },
    { path: "/about", title: clean(about.eyebrow) || "About", note: oneLine(about.meta_description) },
    { path: "/#faq", title: clean(content.home_faq.eyebrow), note: oneLine(content.home_faq.subtitle) },
    { path: "/register?type=brand", title: clean(about.cta_brand), note: oneLine(content.home_tracks.brand_desc) },
    { path: "/register?type=creator", title: clean(about.cta_creator), note: oneLine(content.home_tracks.creator_desc) },
  ];
  for (const p of pages) if (p.title) lines.push(`- [${p.title}](${absoluteUrl(p.path)})${p.note ? `: ${p.note}` : ""}`);
  lines.push("");
  const faq = faqItemsOf(content).filter((i) => clean(i.question) && clean(i.answer));
  if (faq.length) {
    lines.push(`## ${clean(content.home_faq.eyebrow)}`);
    lines.push("");
    for (const i of faq) lines.push(`- **${oneLine(i.question)}** ${oneLine(i.answer)}`);
    lines.push("");
  }
  const posts = blogPosts(content);
  if (posts.length) {
    lines.push(`## ${clean(content.blog.eyebrow) || "Blog"}`);
    lines.push("");
    lines.push(`- [${clean(content.blog.title)}](${absoluteUrl("/blog")})${clean(content.blog.meta_description) ? `: ${oneLine(content.blog.meta_description)}` : ""}`);
    for (const p of posts) lines.push(`- [${oneLine(p.title)}](${blogUrl(p.slug)})${p.excerpt ? `: ${oneLine(p.excerpt)}` : ""}`);
    lines.push("");
  }
  lines.push(`## ${clean(content.legal_common.more_docs).replace(/:$/, "") || "Legal"}`);
  lines.push("");
  for (const slug of ["terms", "privacy", "refunds", "accessibility"] as const) {
    const doc = content[`legal_${slug}`];
    lines.push(`- [${clean(doc.title)}](${absoluteUrl(`/${slug}`)})`);
  }
  lines.push("");
  return lines.join("\n");
}

// Safe to drop into <script type="application/ld+json">: "<" can never close the tag, and the two Unicode line
// terminators (U+2028, U+2029) are escaped so the inline script stays valid JavaScript
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);
export function serializeJsonLd(data: JsonLd): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").split(LINE_SEPARATOR).join("\\u2028").split(PARAGRAPH_SEPARATOR).join("\\u2029");
}

// ---------------------------------------------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------------------------------------------
// The alt text of a creator poster from the registry template ("סרטון UGC של {caption}") and the poster's caption
// ("עדן, בית"). No caption = a decorative image (empty alt), no template = the caption itself.
export function posterAlt(template: string, caption: string): string {
  const c = clean(caption);
  if (!c) return "";
  const t = clean(template);
  if (!t) return c;
  return t.includes("{caption}") ? t.replace(/\{caption\}/g, c) : `${t} ${c}`;
}
