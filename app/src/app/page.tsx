import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowLeft, Briefcase, Check, Heart, Sparkles, UserRound, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { splitMarker } from "@/lib/site-content";
import { getSiteContent } from "@/lib/site-content-server";
import { SiteNav } from "@/components/home/site-nav";
import { CreatorFan } from "@/components/home/creator-fan";
import { Reveal } from "@/components/home/reveal";
import { StickyCta } from "@/components/home/sticky-cta";
import { InfluencerQuiz } from "@/components/features/influencer-quiz";
import { bento, container, display, eyebrow, eyebrowLight, isMonoText, pillCreator, pillDark, pillInkLemon, pillOutline, pillPrimary, stepNumber, tagClass } from "@/components/home/styles";

// The home page (design package v3 "Pop warm"): a server component that reads the content registry and renders
// the sections in the package's order. Every visible string comes from lib/site-content.ts through
// getSiteContent(); the interactive parts are small client components that receive their texts as props.
export const revalidate = 60;

const REGISTER_BRAND = "/register?type=brand";
const REGISTER_BRAND_BUY = "/register?type=brand&next=billing";
const REGISTER_CREATOR = "/register?type=creator";
const LOGIN = "/login";

const pad2 = (n: number) => String(n).padStart(2, "0");

export async function generateMetadata(): Promise<Metadata> {
  const { content } = await getSiteContent();
  const seo = content.seo;
  return {
    title: seo.title,
    description: seo.description,
    keywords: seo.keywords.map((k) => k.value).filter(Boolean),
    openGraph: { title: seo.og_title, description: seo.og_description, type: "website", locale: "he_IL", url: "https://www.mashpian.online" },
    twitter: { card: "summary_large_image", title: seo.og_title, description: seo.og_description },
  };
}

// "before *marked* after" → the marked part in its own span
function TwoTone({ text, markedClassName }: { text: string; markedClassName: string }) {
  const { before, marked, after } = splitMarker(text);
  if (!marked) return <>{text}</>;
  return (
    <>
      {before}
      <span className={markedClassName}>{marked}</span>
      {after}
    </>
  );
}

type Poster = { image_url: string; caption: string };

// Step 1 of the business process: the creator gallery as the business sees it, a deck of real portfolio
// posters with the creator's name and category and the two decisions under it
function GalleryPreview({ posters, heartLabel, passLabel }: { posters: Poster[]; heartLabel: string; passLabel: string }) {
  const [front, ...behind] = posters;
  if (!front) return null;
  const [name, category] = front.caption.split(/,\s*/);
  return (
    <div className="relative mx-auto w-[150px] pt-3">
      {behind.slice(0, 2).map((p, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${p.image_url}-${i}`}
          src={p.image_url}
          alt=""
          loading="lazy"
          decoding="async"
          className={cn("absolute top-0 aspect-[9/16] w-[150px] rounded-2xl object-cover opacity-70 shadow-md", i === 0 ? "left-4 rotate-[5deg]" : "right-4 -rotate-[5deg]")}
        />
      ))}
      <div className="relative aspect-[9/16] w-[150px] overflow-hidden rounded-2xl shadow-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={front.image_url} alt={front.caption} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-3 pt-10 text-on-ink">
          <div className="text-sm font-bold">{name}</div>
          {category && <span className="mt-1 inline-block rounded-full bg-white/20 px-2 py-0.5 text-[11px]">{category}</span>}
        </div>
      </div>
      <div className="relative -mt-5 flex items-center justify-center gap-4">
        <span className="grid h-11 w-11 place-items-center rounded-full border border-border bg-surface text-neutral-500 shadow-md" aria-label={passLabel} title={passLabel}>
          <X className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="grid h-14 w-14 place-items-center rounded-full bg-primary text-white shadow-lg" aria-label={heartLabel} title={heartLabel}>
          <Heart className="h-7 w-7" aria-hidden="true" fill="currentColor" />
        </span>
      </div>
    </div>
  );
}

// Step 2: two hearts met
function MatchPreview({ posters, line, tag }: { posters: Poster[]; line: string; tag: string }) {
  const [a, b] = posters;
  return (
    <div className="rounded-2xl border border-border bg-canvas p-4">
      <div className="flex items-center justify-center gap-3">
        <span className="relative h-14 w-14 overflow-hidden rounded-full border-2 border-white shadow-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {a && <img src={a.image_url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />}
        </span>
        <span className="grid h-9 w-9 place-items-center rounded-full bg-pink-100 text-pink-600">
          <Heart className="h-4 w-4" aria-hidden="true" fill="currentColor" />
        </span>
        <span className="grid h-14 w-14 place-items-center rounded-full bg-surface-ink text-on-ink shadow-md">
          <Briefcase className="h-6 w-6" aria-hidden="true" />
        </span>
        {b && (
          <span className="sr-only">{b.caption}</span>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2 text-[13px]">
        <span>{line}</span>
        <span className="rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success">{tag}</span>
      </div>
    </div>
  );
}

// Step 3: the managed chat
function ChatPreview({ bubbles }: { bubbles: string[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      {bubbles.filter(Boolean).map((b, i) => (
        <span
          key={i}
          className={cn(
            "max-w-[88%] px-3 py-2 text-[13px]",
            i % 2 === 0 ? "self-start rounded-[12px_12px_12px_4px] border border-border bg-canvas" : "self-end rounded-[12px_12px_4px_12px] bg-surface-ink text-on-ink"
          )}
        >
          {b}
        </span>
      ))}
    </div>
  );
}

// Step 4: approved videos, each with the "done" mark
function ApprovedPreview({ posters, badge }: { posters: Poster[]; badge: string }) {
  return (
    <div className="flex justify-center gap-2.5">
      {posters.slice(0, 3).map((p, i) => (
        <div key={`${p.image_url}-${i}`} className="relative aspect-[9/16] w-[72px] overflow-hidden rounded-xl shadow-md md:w-[76px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.image_url} alt={p.caption} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
          <span className="absolute left-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-success text-white shadow">
            <Check className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={3} />
          </span>
          <span className="absolute inset-x-1.5 bottom-1.5 rounded-full bg-success-soft px-1.5 py-0.5 text-center text-[10px] font-semibold text-success">{badge}</span>
        </div>
      ))}
    </div>
  );
}

export default async function HomePage() {
  const { content } = await getSiteContent();
  const nav = content.home_nav;
  const hero = content.home_hero;
  const tracks = content.home_tracks;
  const brands = content.home_brands;
  const stats = content.home_stats;
  const how = content.home_how;
  const creators = content.home_creators;
  const inf = content.home_influencers;
  const closing = content.home_cta;
  const footer = content.home_footer;
  const mobile = content.home_mobile;

  const navLinks = [
    { label: nav.link1_label, href: nav.link1_href },
    { label: nav.link2_label, href: nav.link2_href },
    { label: nav.link3_label, href: nav.link3_href },
    { label: nav.link4_label, href: nav.link4_href },
  ].filter((l) => l.label && l.href);

  const statTiles = [
    { value: stats.stat1_value, suffix: stats.stat1_suffix, label: stats.stat1_label, source: stats.stat1_source, dark: stats.stat1_dark },
    { value: stats.stat2_value, suffix: stats.stat2_suffix, label: stats.stat2_label, source: stats.stat2_source, dark: stats.stat2_dark },
    { value: stats.stat3_value, suffix: stats.stat3_suffix, label: stats.stat3_label, source: stats.stat3_source, dark: stats.stat3_dark },
  ];

  const galleryPosters = brands.gallery_posters as Poster[];
  const approvedPosters = brands.approved_posters as Poster[];
  const processSteps = [
    { title: brands.bento1_title, desc: brands.bento1_desc, visual: <GalleryPreview posters={galleryPosters} heartLabel={brands.gallery_heart} passLabel={brands.gallery_pass} /> },
    { title: brands.bento2_title, desc: brands.bento2_desc, visual: <MatchPreview posters={galleryPosters.slice(3)} line={brands.bento2_sample} tag={brands.bento2_sample_tag} /> },
    { title: brands.bento3_title, desc: brands.bento3_desc, visual: <ChatPreview bubbles={[brands.bento3_bubble1, brands.bento3_bubble2, brands.bento3_bubble3]} /> },
    { title: brands.bento4_title, desc: brands.bento4_desc, visual: <ApprovedPreview posters={approvedPosters} badge={brands.approved_badge} /> },
  ];

  return (
    <div className="bg-canvas text-ink-900 pb-[80px] md:pb-0" id="top">
      <SiteNav
        brandName={nav.brand_name}
        links={navLinks}
        loginLabel={nav.login}
        loginHref={LOGIN}
        ctaCreator={nav.cta_creator}
        ctaCreatorHref={REGISTER_CREATOR}
        ctaBrand={nav.cta_brand}
        ctaBrandHref={REGISTER_BRAND}
        menuLabel={nav.menu_label}
        menuClose={mobile.menu_close}
        menuLogin={mobile.menu_login}
      />

      <main>
        {/* HERO */}
        <section className="relative overflow-hidden bg-surface-ink pb-28 pt-24 text-on-ink md:pb-52 md:pt-36">
          <div className="absolute inset-0" style={{ background: "radial-gradient(60% 50% at 50% 0%, #2e2745 0%, #0b051d 70%)" }} aria-hidden="true" />
          <div className={cn(container, "relative z-[2] text-center")}>
            <span className={eyebrowLight}>{hero.eyebrow}</span>
            <h1 className="mx-auto mt-4 max-w-[980px] font-display text-[34px] leading-[1.06] tracking-[-1px] text-on-ink md:mt-6 md:text-[56px] md:tracking-[-1.5px] lg:text-[72px] lg:leading-[1.02]">
              <TwoTone text={hero.title} markedClassName="signature-text" />
            </h1>
            <p className="mx-auto mt-4 max-w-[640px] text-base leading-relaxed text-on-ink/70 md:mt-6 md:text-[19px]">{hero.subtitle}</p>
            <div className="mt-6 flex flex-col justify-center gap-2.5 sm:flex-row sm:gap-3 md:mt-8">
              <Link href={REGISTER_BRAND} className={cn(pillPrimary, "h-[52px] px-7 text-base")}>
                <Briefcase className="h-[18px] w-[18px]" aria-hidden="true" />
                {hero.cta_primary}
              </Link>
              <Link href={REGISTER_CREATOR} className={cn(pillCreator, "h-[52px] px-7 text-base")}>
                <UserRound className="h-[18px] w-[18px]" aria-hidden="true" />
                {hero.cta_secondary}
              </Link>
            </div>
            <a href="#how" className="mt-4 inline-flex items-center gap-1.5 border-b border-on-ink/30 pb-0.5 text-sm text-on-ink/70 hover:text-on-ink md:mt-5">
              {hero.how_link}
              <ArrowDown className="h-4 w-4" aria-hidden="true" />
            </a>
            {hero.sticker1 && (
              <span className={cn(tagClass(hero.sticker1), "absolute right-[calc(50%-560px)] top-10 hidden rotate-[-6deg] rounded-full bg-lemon-400 px-3.5 py-2.5 text-xs font-medium text-ink-900 shadow-[0_8px_24px_#00000055] xl:inline-block")}>
                {hero.sticker1}
              </span>
            )}
            {hero.sticker2 && (
              <span className={cn(tagClass(hero.sticker2), "absolute left-[calc(50%-560px)] top-44 hidden rotate-[5deg] rounded-full bg-pink-500 px-3.5 py-2.5 text-xs font-medium text-white shadow-[0_8px_24px_#00000055] xl:inline-block")}>
                {hero.sticker2}
              </span>
            )}
          </div>
          <div className="relative z-[1] mt-7 md:mt-14">
            <CreatorFan tiles={content.home_fan.tiles} autoplay={content.home_fan.autoplay} label={hero.fan_label} counterLine={hero.counter_line} demoNote={hero.demo_note} />
          </div>
        </section>

        {/* TRACK CARDS on the seam */}
        <section aria-label={tracks.aria_label} className={cn(container, "relative z-[4] -mt-20 md:-mt-36")} id="tracks">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
            <Reveal delay={0}>
              <Link href={REGISTER_BRAND} className="group relative flex h-full flex-col gap-3 rounded-3xl border border-pink-200 bg-pink-100 p-6 text-pink-900 shadow-lg transition-transform duration-200 hover:-translate-y-1 md:min-h-[280px] md:p-8">
                {tracks.brand_tag && <span className={cn(tagClass(tracks.brand_tag), "absolute left-4 top-4 rounded-full bg-primary px-2.5 py-1.5 text-[11px] font-medium text-white")}>{tracks.brand_tag}</span>}
                <span className="grid h-12 w-12 place-items-center rounded-full bg-primary text-white md:h-[52px] md:w-[52px]">
                  <Briefcase className="h-6 w-6" aria-hidden="true" />
                </span>
                <span className="font-display text-[22px] leading-tight md:text-[25px]">{tracks.brand_title}</span>
                <span className="flex-1 text-sm leading-relaxed md:text-[15px]">{tracks.brand_desc}</span>
                <span className={cn(pillPrimary, "self-start")}>
                  {tracks.brand_cta}
                  <ArrowLeft className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
              </Link>
            </Reveal>
            <Reveal delay={0.08}>
              <Link href={REGISTER_CREATOR} className="group relative flex h-full flex-col gap-3 rounded-3xl border border-lemon-300 bg-lemon-100 p-6 text-lemon-900 shadow-lg transition-transform duration-200 hover:-translate-y-1 md:min-h-[280px] md:p-8">
                {tracks.creator_tag && <span className={cn(tagClass(tracks.creator_tag), "absolute left-4 top-4 rounded-full bg-lemon-400 px-2.5 py-1.5 text-[11px] font-medium text-ink-900")}>{tracks.creator_tag}</span>}
                <span className="grid h-12 w-12 place-items-center rounded-full bg-lemon-400 text-ink-900 md:h-[52px] md:w-[52px]">
                  <UserRound className="h-6 w-6" aria-hidden="true" />
                </span>
                <span className="font-display text-[22px] leading-tight md:text-[25px]">{tracks.creator_title}</span>
                <span className="flex-1 text-sm leading-relaxed md:text-[15px]">{tracks.creator_desc}</span>
                <span className={cn(pillInkLemon, "self-start")}>
                  {tracks.creator_cta}
                  <ArrowLeft className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
              </Link>
            </Reveal>
            <Reveal delay={0.16}>
              <a href="#inf" className="group relative flex h-full flex-col gap-3 rounded-3xl border border-border bg-surface p-6 text-ink-900 shadow-lg transition-transform duration-200 hover:-translate-y-1 md:min-h-[280px] md:p-8">
                {tracks.influencer_badge && <span className={cn(tagClass(tracks.influencer_badge), "absolute left-4 top-4 rotate-[-4deg] rounded-full bg-tangerine-500 px-2.5 py-1.5 text-[11px] font-semibold text-white")}>{tracks.influencer_badge}</span>}
                <span className="grid h-12 w-12 place-items-center rounded-full bg-tangerine-100 text-tangerine-700 md:h-[52px] md:w-[52px]">
                  <Sparkles className="h-6 w-6" aria-hidden="true" />
                </span>
                <span className="font-display text-[22px] leading-tight md:text-[25px]">{tracks.influencer_title}</span>
                <span className="flex-1 text-sm leading-relaxed text-ink-700 md:text-[15px]">{tracks.influencer_desc}</span>
                <span className={cn(pillDark, "self-start")}>{tracks.influencer_cta}</span>
              </a>
            </Reveal>
          </div>
        </section>

        {/* BUSINESSES: why, then the four steps */}
        <section id="biz" className={cn(container, "pb-16 pt-16 md:pb-24 md:pt-28")}>
          <Reveal>
            <span className={eyebrow}>{brands.eyebrow}</span>
            <h2 className={cn(display, "mt-3 max-w-[880px] text-[32px] leading-[1.1] md:text-[48px] md:leading-[1.08]")}>
              <TwoTone text={brands.title} markedClassName="text-neutral-500" />
            </h2>
            <p className="mt-3 max-w-[620px] text-base leading-relaxed text-ink-700 md:mt-4 md:text-lg">{brands.subtitle}</p>
          </Reveal>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 md:mt-10 md:grid-cols-4 md:gap-4">
            {brands.benefits.map((b, i) => (
              <Reveal key={i} delay={0.06 * i}>
                <div className="h-full rounded-2xl border border-pink-200 bg-pink-50 p-4 md:p-5">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-white">
                    <Check className="h-4 w-4" aria-hidden="true" strokeWidth={3} />
                  </span>
                  <div className="mt-3 font-display text-[20px] leading-tight text-pink-900 md:text-[22px]">{b.title}</div>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-700">{b.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <h3 className={cn(display, "mt-10 text-[24px] leading-tight md:mt-16 md:text-[30px]")}>{brands.process_title}</h3>
          </Reveal>
          <ol className="relative mt-5 grid grid-cols-1 gap-5 md:mt-8 md:grid-cols-4 md:gap-4">
            <div aria-hidden="true" className="absolute bottom-6 right-5 top-6 w-0.5 bg-pink-200 md:bottom-auto md:left-[12.5%] md:right-[12.5%] md:top-[22px] md:h-0.5 md:w-auto" />
            {processSteps.map((s, i) => (
              <li key={i} className="relative ps-14 md:ps-0 md:pt-16">
                <span className={cn(stepNumber, "absolute right-0 top-0 md:left-1/2 md:right-auto md:-translate-x-1/2")}>{pad2(i + 1)}</span>
                <Reveal delay={0.06 * i} className="h-full">
                  <div className={cn(bento, "flex h-full flex-col p-5 md:p-5")}>
                    <div className="font-display text-[20px] leading-tight md:text-[22px]">{s.title}</div>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-700">{s.desc}</p>
                    <div className="mt-4 flex flex-1 flex-col justify-center md:mt-5">{s.visual}</div>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>

          <div className="mt-6 grid grid-cols-2 gap-3 md:mt-10 md:grid-cols-3 md:gap-4">
            {statTiles.map((s, i) => (
              <Reveal key={i} delay={0.06 * i} className={cn(i === 2 && "col-span-2 md:col-span-1")}>
                <div className={cn("h-full rounded-2xl border p-5 md:px-6 md:pb-6 md:pt-7", s.dark ? "border-white/10 bg-surface-ink" : "border-border bg-surface")}>
                  <div className={cn("font-display text-[40px] leading-none tracking-[-1px] tabular-nums md:text-[60px] md:tracking-[-1.5px]", s.dark ? "text-lemon-400" : "text-ink-900")} dir="ltr" style={{ textAlign: "right" }}>
                    {s.value}
                    {s.suffix && <span className={cn(s.suffix === "+" ? "text-pink-500" : "font-sans text-[22px] font-normal md:text-[28px]", "ms-1")}>{s.suffix}</span>}
                  </div>
                  <div className={cn("mt-2 text-[13px] md:text-sm", s.dark ? "text-on-ink/80" : "text-ink-700")}>{s.label}</div>
                  {s.source && (
                    <div className={cn(tagClass(s.source), "mt-2.5 text-[10px] md:text-[11px]", s.dark ? "text-on-ink/60" : "text-neutral-500")} style={{ textAlign: "right" }} dir={isMonoText(s.source) ? "ltr" : undefined}>
                      {s.source}
                    </div>
                  )}
                </div>
              </Reveal>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-3 md:mt-10 md:flex-row md:items-center">
            <Link href={REGISTER_BRAND_BUY} className={cn(pillPrimary, "w-full md:w-auto")}>
              {brands.cta_primary}
              <ArrowLeft className="h-[18px] w-[18px]" aria-hidden="true" />
            </Link>
            <a href="#how" className={cn(pillOutline, "hidden md:inline-flex")}>
              {brands.cta_secondary}
            </a>
            <span className="text-center text-[13px] text-neutral-500 md:ms-2 md:text-start md:text-sm">{brands.price_note}</span>
          </div>
        </section>

        {/* HOW */}
        <section id="how" className="border-y border-border bg-surface">
          <div className={cn(container, "py-16 md:py-24")}>
            <Reveal>
              <span className={eyebrow}>{how.eyebrow}</span>
              <h2 className={cn(display, "mt-3 text-[32px] leading-[1.1] md:text-[48px] md:leading-[1.08]")}>
                <TwoTone text={how.title} markedClassName="text-neutral-500" />
              </h2>
            </Reveal>
            <div className="mt-7 grid grid-cols-1 gap-5 md:mt-12 md:grid-cols-4 md:gap-6">
              {how.steps.map((s, i) => (
                <Reveal key={i} delay={0.06 * i}>
                  <div className="flex gap-4 md:flex-col md:gap-4 md:border-t md:border-border md:pt-6">
                    <span className={cn(stepNumber, tagClass(s.tag), "self-start")}>{s.tag || pad2(i + 1)}</span>
                    <div>
                      <b className="text-base font-semibold md:text-xl">{s.title}</b>
                      <div className="mt-0.5 text-sm leading-relaxed text-ink-700 md:mt-1 md:text-base">{s.desc}</div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* UGC CREATORS */}
        <section id="ugc" className={cn(container, "py-16 md:py-24")}>
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-5 md:rounded-[32px] md:p-16">
              <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(70% 90% at 100% 50%, #fff1bf 0%, #fff1bf00 70%)" }} aria-hidden="true" />
              <div className="relative grid grid-cols-1 items-center gap-6 md:grid-cols-2 md:gap-12">
                <div>
                  <span className={eyebrow}>{creators.eyebrow}</span>
                  <h2 className={cn(display, "mt-3 text-[30px] leading-[1.1] md:text-[46px] md:leading-[1.08]")}>
                    <TwoTone text={creators.title} markedClassName="text-neutral-500" />
                  </h2>
                  <p className="mt-3 max-w-[480px] text-[15px] leading-relaxed text-ink-700 md:mt-4 md:text-lg">{creators.subtitle}</p>
                  <div className="mt-6 hidden gap-3 md:flex">
                    <Link href={REGISTER_CREATOR} className={pillCreator}>
                      {creators.cta_primary}
                    </Link>
                    <a href="#how" className={pillOutline}>
                      {creators.cta_secondary}
                    </a>
                  </div>
                </div>
                <div className="flex flex-col gap-2 md:gap-3">
                  {creators.steps.map((s, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3.5 md:gap-4 md:px-6 md:py-5">
                      <span className={cn(stepNumber, tagClass(s.tag), "bg-lemon-400 text-ink-900 shadow-none")}>{s.tag || pad2(i + 1)}</span>
                      <div>
                        <b className="text-sm font-semibold md:text-base">{s.title}</b>
                        <div className="hidden text-sm text-ink-700 md:block">{s.desc}</div>
                      </div>
                    </div>
                  ))}
                  <Link href={REGISTER_CREATOR} className={cn(pillCreator, "mt-2 w-full md:hidden")}>
                    {creators.cta_primary}
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        {/* INFLUENCERS: the quiz */}
        <section id="inf" className={cn(container, "pb-16 md:pb-24")}>
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-5 md:rounded-[32px] md:p-16">
              <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(70% 90% at 0% 50%, #ffd6e4 0%, #ffd6e400 70%)" }} aria-hidden="true" />
              <div className="relative grid grid-cols-1 items-center gap-6 md:grid-cols-2 md:gap-14">
                <div>
                  <span className={eyebrow}>{inf.eyebrow}</span>
                  <h2 className={cn(display, "mt-3 text-[30px] leading-[1.1] md:text-[46px] md:leading-[1.08]")}>
                    <TwoTone text={inf.title} markedClassName="text-neutral-500" />
                  </h2>
                  <p className="mt-3 max-w-[460px] text-[15px] leading-relaxed text-ink-700 md:mt-4 md:text-lg">{inf.subtitle}</p>
                  <div className="mt-5 flex flex-col gap-2.5 text-[14px] text-ink-700 md:mt-8 md:max-w-[420px] md:gap-3">
                    {inf.bullets.map((b, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className={cn(stepNumber, tagClass(b.tag), "h-8 w-8 text-[13px] md:h-9 md:w-9 md:text-sm")}>{b.tag || pad2(i + 1)}</span>
                        <span className="md:text-[15px]">{b.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <InfluencerQuiz quiz={content.quiz} texts={{ card_eyebrow: inf.card_eyebrow, privacy_note: inf.privacy_note, cta_next: inf.cta_next, cta_back: inf.cta_back }} homeHref="#top" />
              </div>
            </div>
          </Reveal>
        </section>

        {/* CLOSING + FOOTER */}
        <section id="closing" className="bg-surface-ink text-on-ink">
          <div className={cn(container, "py-16 text-center md:py-32")}>
            <Reveal>
              <span className={eyebrowLight}>{closing.eyebrow}</span>
              <h2 className="mx-auto mt-4 max-w-[860px] font-display text-[30px] leading-[1.06] text-on-ink md:text-[60px] md:leading-[1.04] md:tracking-[-1.2px]">
                <TwoTone text={closing.title} markedClassName="text-lemon-400" />
              </h2>
              <p className="mx-auto mt-4 max-w-[520px] text-[15px] leading-relaxed text-on-ink/70 md:mt-6 md:text-lg">{closing.subtitle}</p>
              <div className="mt-7 flex flex-col justify-center gap-2.5 sm:flex-row sm:gap-3 md:mt-10">
                <Link href={REGISTER_BRAND} className={pillPrimary}>
                  {closing.cta_primary}
                </Link>
                <Link href={REGISTER_CREATOR} className={pillCreator}>
                  {closing.cta_secondary}
                </Link>
              </div>
            </Reveal>
          </div>
          <footer className="border-t border-white/10">
            <div className={cn(container, "flex flex-col items-center gap-4 py-7 text-sm text-on-ink/70 md:flex-row md:justify-between")}>
              <div className="flex items-center gap-2.5 font-display text-[17px] text-on-ink">
                <Image src="/icon-192.png" alt="" width={28} height={28} unoptimized className="h-7 w-7 rounded-[7px]" />
                {footer.logo_tagline}
              </div>
              <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
                {footer.links.map((l, i) => (
                  <Link key={`${l.href}-${i}`} href={l.href} className="hover:text-on-ink">
                    {l.label}
                  </Link>
                ))}
                <Link href={LOGIN} className="hover:text-on-ink">
                  {footer.login}
                </Link>
              </nav>
              <div className={cn(tagClass(footer.copyright), "text-xs")}>{footer.copyright}</div>
            </div>
          </footer>
        </section>
      </main>

      <StickyCta brandLabel={mobile.sticky_primary} brandHref={REGISTER_BRAND} creatorLabel={mobile.sticky_secondary} creatorHref={REGISTER_CREATOR} />
    </div>
  );
}
