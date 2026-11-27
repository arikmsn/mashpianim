import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SITE_URL, aboutJsonLd } from "@/lib/seo";
import { getSiteContent } from "@/lib/site-content-server";
import { JsonLd } from "@/components/home/json-ld";
import { Markdown } from "@/components/features/markdown";
import { container, display, eyebrow, pillCreator, pillPrimary, tagClass } from "@/components/home/styles";

// /about (GEO, 2026-11-27): who the platform is, in the words search engines and AI assistants can quote. Every
// text comes from the `about` section of the content registry (/admin/content, the about tab); the facts are shown
// as cards and reused by /llms.txt. Public (middleware publicRoutes) and in the sitemap.
export const revalidate = 60;

const REGISTER_BRAND = "/register?type=brand";
const REGISTER_CREATOR = "/register?type=creator";

export async function generateMetadata(): Promise<Metadata> {
  const { content } = await getSiteContent();
  const about = content.about;
  return {
    title: about.meta_title,
    description: about.meta_description,
    alternates: { canonical: "/about", languages: { "he-IL": "/about" } },
    openGraph: { title: about.meta_title, description: about.meta_description, type: "website", locale: "he_IL", url: `${SITE_URL}/about` },
  };
}

export default async function AboutPage() {
  const { content } = await getSiteContent();
  const about = content.about;
  const facts = about.facts.filter((f) => f.label && f.value);
  return (
    <main className="min-h-screen bg-canvas text-ink-900">
      <JsonLd data={aboutJsonLd(content)} />
      <div className={cn(container, "py-10 md:py-16")}>
        <Link href="/" className="inline-flex items-center gap-1 text-sm font-medium text-pink-700 hover:underline">
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
          {about.back_home}
        </Link>

        <header className="mt-8 max-w-[820px]">
          <span className={eyebrow}>{about.eyebrow}</span>
          <h1 className={cn(display, "mt-3 text-[32px] leading-[1.1] md:text-[48px] md:leading-[1.08]")}>{about.title}</h1>
          <p className="mt-4 text-base leading-relaxed text-ink-700 md:mt-5 md:text-lg">{about.subtitle}</p>
        </header>

        {facts.length > 0 && (
          <dl className="mt-8 grid grid-cols-2 gap-3 md:mt-12 md:grid-cols-4 md:gap-4">
            {facts.map((f, i) => (
              <div key={i} className="rounded-2xl border border-border bg-surface p-4 md:p-5">
                <dt className="text-[13px] text-neutral-600 md:text-sm">{f.label}</dt>
                <dd className={cn("mt-1.5 font-display text-[20px] leading-tight text-ink-900 md:text-[24px]", tagClass(f.value))}>{f.value}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="mt-10 max-w-[760px] md:mt-14">
          <Markdown source={about.body} className="[&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-[24px] [&_h2]:text-ink-900 [&_h2]:md:text-[28px] [&_p]:text-ink-700 [&_li]:text-ink-700" />
        </div>

        <div className="mt-10 flex flex-col gap-2.5 sm:flex-row sm:gap-3 md:mt-14">
          <Link href={REGISTER_BRAND} className={pillPrimary}>
            {about.cta_brand}
          </Link>
          <Link href={REGISTER_CREATOR} className={pillCreator}>
            {about.cta_creator}
          </Link>
        </div>
      </div>
    </main>
  );
}
