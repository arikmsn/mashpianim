"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useEffect, useState } from "react";

type SiteContent = Record<string, Record<string, string>>;

const defaults: SiteContent = {
  hero: {
    badge: "הפלטפורמה ליוצרי תוכן ומותגים בישראל",
    title_line1: "יוצרים תוכן.",
    title_line2: "מחברים מותגים.",
    subtitle: "קבלו מוצרים חינם, צלמו סרטונים אותנטיים, וצמחו כיוצרי תוכן. עסקים — קבלו תוכן UGC איכותי במחיר שפוי.",
    cta_creator: "אני יוצר/ת תוכן",
    cta_brand: "אני בעל/ת עסק",
  },
  how_it_works: {
    section_title: "שלושה צעדים פשוטים",
    step1_title: "בחרו מוצר",
    step1_desc: "גלו מוצרים מעניינים מעסקים מובילים ושלחו בקשת חיבור",
    step2_title: "צלמו סרטון",
    step2_desc: "קבלו את המוצר חינם וצלמו סרטון UGC אותנטי תוך 10 ימים",
    step3_title: "צמחו",
    step3_desc: "צברו ניסיון, עלו ברמות, והפכו ליוצרי תוכן מבוקשים",
  },
  creators: {
    title_line1: "הפכו את",
    title_line2: "התשוקה למקצוע",
    benefit1: "קבלו מוצרים חינם מהמותגים המובילים",
    benefit2: "צלמו תוכן בסגנון שלכם, בקצב שלכם",
    benefit3: "צמחו עם מערכת דירוגים ייחודית",
    benefit4: "בנו פורטפוליו מקצועי מרשים",
    cta: "הצטרפו כיוצרי תוכן",
  },
  stats: {
    stat1_value: "100%",
    stat1_label: "חינם ליוצרים",
    stat2_value: "10",
    stat2_label: "ימים ליצירת סרטון",
    stat3_value: "3",
    stat3_label: "צעדים פשוטים",
  },
  brands: {
    title_line1: "תוכן שעובד",
    title_line2: "בלי הפקות יקרות",
    benefit1: "תוכן UGC אותנטי שמביא תוצאות",
    benefit2: "מחירים שפויים — קרדיט אחד = סרטון אחד",
    benefit3: "יוצרים מאומתים ומדורגים",
    benefit4: "ניהול קל דרך לוח בקרה חכם",
    cta: "הצטרפו כמפרסמים",
  },
  cta_final: {
    title_line1: "מוכנים",
    title_line2: "להתחיל?",
    subtitle: "הצטרפו לקהילת היוצרים והמותגים הגדלה. חינם לגמרי ליוצרי תוכן.",
    cta_primary: "הרשמה חינם",
    cta_secondary: "אני מפרסם",
  },
  footer: {
    tagline: "הפלטפורמה ליוצרי תוכן ומותגים",
    copyright: "Mashpianim. כל הזכויות שמורות.",
  },
};

function useSiteContent(): SiteContent {
  const [content, setContent] = useState<SiteContent>(defaults);

  useEffect(() => {
    async function loadContent() {
      try {
        const res = await fetch("/api/admin/content");
        if (res.ok) {
          const data = await res.json();
          if (data.content) {
            const merged: SiteContent = {};
            for (const section of Object.keys(defaults)) {
              merged[section] = { ...defaults[section], ...data.content[section] };
            }
            setContent(merged);
            return;
          }
        }
      } catch {
        // Fall through to localStorage
      }
      try {
        const stored = localStorage.getItem("mashpianim_site_content");
        if (stored) {
          const parsed = JSON.parse(stored) as SiteContent;
          const merged: SiteContent = {};
          for (const section of Object.keys(defaults)) {
            merged[section] = { ...defaults[section], ...parsed[section] };
          }
          setContent(merged);
        }
      } catch {
        // use defaults
      }
    }
    loadContent();
  }, []);

  return content;
}

function FadeIn({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function Icon({ d, className = "" }: { d: string; className?: string }) {
  return (
    <svg className={`w-6 h-6 ${className}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

const stepIcon1 = "M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.25-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z";
const stepIcon2 = "M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z";
const stepIcon3 = "M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.281m5.94 2.28l-2.28 5.941";

const checkIcon = "M4.5 12.75l6 6 9-13.5";
const arrowIcon = "M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18";
const playIcon = "M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z";

const heroVideos = [
  { label: "ביוטי", img: "/demo/v1.jpg" },
  { label: "אופנה", img: "/demo/v2.jpg" },
  { label: "אוכל", img: "/demo/v3.jpg" },
];

export default function HomePage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.7], [1, 0.96]);
  const c = useSiteContent();

  return (
    <main className="min-h-screen bg-white overflow-x-hidden">
      {/* Nav */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="fixed top-0 left-0 right-0 z-50"
      >
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between bg-white/80 backdrop-blur-xl rounded-2xl px-6 py-3 shadow-sm shadow-neutral-900/5 border border-neutral-100/80">
            <Link href="/" className="text-lg font-bold tracking-tight text-neutral-900">
              <span className="text-pink-500">M</span>ashpianim
            </Link>
            <div className="flex items-center gap-2">
              <Link href="/login" className="text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors px-4 py-2">
                התחברות
              </Link>
              <Link href="/register?type=creator" className="text-sm font-medium bg-neutral-900 text-white px-5 py-2.5 rounded-full hover:bg-neutral-800 transition-all hover:shadow-lg hover:shadow-neutral-900/20">
                הצטרפו
              </Link>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Hero */}
      <motion.section ref={heroRef} style={{ opacity: heroOpacity, scale: heroScale }} className="relative pt-32 pb-24 px-6">
        {/* Decorative blobs */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-pink-100/80 to-rose-50/60 blur-[120px] pointer-events-none" />
        <div className="absolute top-60 right-0 w-[300px] h-[300px] rounded-full bg-purple-100/40 blur-[100px] pointer-events-none" />
        <div className="absolute top-40 left-0 w-[200px] h-[200px] rounded-full bg-amber-100/30 blur-[80px] pointer-events-none" />

        <div className="relative max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/80 backdrop-blur-sm text-pink-600 text-xs font-semibold tracking-wide border border-pink-100 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-500" />
              </span>
              {c.hero.badge}
            </span>
          </motion.div>

          <motion.h1
            className="mt-8 text-5xl md:text-7xl font-extrabold leading-[1.08] tracking-tight text-neutral-900"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            {c.hero.title_line1}
            <br />
            <span className="bg-gradient-to-l from-pink-500 to-rose-500 bg-clip-text text-transparent">{c.hero.title_line2}</span>
          </motion.h1>

          <motion.p
            className="mt-6 text-lg text-neutral-500 max-w-md mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.45 }}
          >
            {c.hero.subtitle}
          </motion.p>

          <motion.div
            className="mt-10 flex flex-col sm:flex-row gap-3 justify-center"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.55 }}
          >
            <Link
              href="/register?type=creator"
              className="group inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-gradient-to-l from-pink-500 to-rose-500 text-white font-semibold hover:from-pink-600 hover:to-rose-600 transition-all shadow-lg shadow-pink-500/25 hover:shadow-xl hover:shadow-pink-500/30"
            >
              {c.hero.cta_creator}
              <Icon d={arrowIcon} className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/register?type=brand"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-white border border-neutral-200 text-neutral-700 font-semibold hover:border-neutral-300 hover:shadow-md transition-all"
            >
              {c.hero.cta_brand}
            </Link>
          </motion.div>

          {/* Hero illustration card */}
          <motion.div
            className="mt-16 mx-auto max-w-lg"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.7 }}
          >
            <div className="bg-white/90 backdrop-blur-sm rounded-3xl border border-neutral-200/80 shadow-2xl shadow-neutral-300/30 p-5">
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-neutral-100">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 shadow-md shadow-pink-300/30" />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-neutral-900">הפרופיל שלך</div>
                  <div className="text-xs text-neutral-400">רמה · סרטונים · דירוג</div>
                </div>
                <span className="text-xs font-medium bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-full border border-emerald-100">פעילה</span>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {heroVideos.map((video) => (
                  <div key={video.label} className="relative aspect-[9/16] rounded-2xl overflow-hidden group cursor-pointer bg-neutral-100 shadow-sm">
                    <img src={video.img} alt={video.label} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="w-10 h-10 rounded-full bg-white/90 shadow-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-pink-500 mr-[-2px]" fill="currentColor" viewBox="0 0 24 24">
                          <path d={playIcon} />
                        </svg>
                      </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent p-2.5 pt-8">
                      <p className="text-white text-[11px] font-semibold text-center">{video.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* How it works */}
      <section className="px-6 py-28 bg-gradient-to-b from-neutral-50 to-white relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-l from-transparent via-pink-200 to-transparent" />
        <div className="max-w-5xl mx-auto">
          <FadeIn>
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="h-px w-8 bg-pink-300" />
              <p className="text-sm font-semibold text-pink-500 tracking-wide">איך זה עובד</p>
              <div className="h-px w-8 bg-pink-300" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-center text-neutral-900">{c.how_it_works.section_title}</h2>
          </FadeIn>

          <div className="mt-16 grid md:grid-cols-3 gap-6">
            {[
              { step: "01", title: c.how_it_works.step1_title, desc: c.how_it_works.step1_desc, icon: stepIcon1 },
              { step: "02", title: c.how_it_works.step2_title, desc: c.how_it_works.step2_desc, icon: stepIcon2 },
              { step: "03", title: c.how_it_works.step3_title, desc: c.how_it_works.step3_desc, icon: stepIcon3 },
            ].map((item, i) => (
              <FadeIn key={item.step} delay={i * 0.12}>
                <div className="relative bg-white rounded-2xl p-8 pt-10 border border-neutral-100 hover:border-pink-200 hover:shadow-xl hover:shadow-pink-500/[0.06] transition-all duration-500 group">
                  {/* Step number badge — top-left corner */}
                  <div className="absolute top-4 left-4 w-9 h-9 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shadow-md shadow-pink-500/20">
                    <span className="text-white text-xs font-bold">{item.step}</span>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-pink-50 group-hover:bg-pink-100 flex items-center justify-center mb-5 transition-colors duration-300">
                    <Icon d={item.icon} className="w-7 h-7 text-pink-500" />
                  </div>
                  <h3 className="text-xl font-bold text-neutral-900">{item.title}</h3>
                  <p className="mt-3 text-neutral-500 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* For Creators */}
      <section className="px-6 py-28 relative">
        <div className="absolute top-1/2 left-0 w-[300px] h-[300px] rounded-full bg-pink-50/50 blur-[100px] pointer-events-none -translate-y-1/2" />
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-20 items-center relative">
          <FadeIn>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px w-8 bg-pink-300" />
              <p className="text-sm font-semibold text-pink-500 tracking-wide">ליוצרי תוכן</p>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold leading-tight text-neutral-900">
              {c.creators.title_line1} <span className="bg-gradient-to-l from-pink-500 to-rose-500 bg-clip-text text-transparent">{c.creators.title_line2}</span>
            </h2>
            <div className="mt-8 space-y-4">
              {[c.creators.benefit1, c.creators.benefit2, c.creators.benefit3, c.creators.benefit4].map((text, i) => (
                <motion.div
                  key={text}
                  className="flex items-start gap-3"
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.4 }}
                >
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center mt-0.5 shrink-0 shadow-sm shadow-pink-500/20">
                    <Icon d={checkIcon} className="w-3.5 h-3.5 text-white" />
                  </div>
                  <p className="text-neutral-600 leading-relaxed">{text}</p>
                </motion.div>
              ))}
            </div>
            <Link
              href="/register?type=creator"
              className="group inline-flex items-center gap-2 mt-8 px-7 py-3.5 rounded-full bg-gradient-to-l from-pink-500 to-rose-500 text-white font-semibold hover:from-pink-600 hover:to-rose-600 transition-all shadow-lg shadow-pink-500/20 hover:shadow-xl hover:shadow-pink-500/30"
            >
              {c.creators.cta}
              <Icon d={arrowIcon} className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            </Link>
          </FadeIn>

          <FadeIn delay={0.15}>
            <div className="bg-gradient-to-br from-neutral-50 to-pink-50/30 rounded-3xl p-6 border border-neutral-100 shadow-lg shadow-neutral-200/20">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <p className="text-xs font-semibold text-neutral-500">החיבורים שלך</p>
              </div>
              <div className="space-y-2.5">
                {[
                  { name: "סרום פנים פרימיום", brand: "Beauty Lab", status: "ממתין לאישור", statusColor: "amber" },
                  { name: "חולצת כותנה אורגנית", brand: "GreenWear", status: "אושר — צלמו", statusColor: "pink" },
                  { name: "שייקר חלבון", brand: "FitMix", status: "סרטון הועלה", statusColor: "emerald" },
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    className="flex items-center justify-between bg-white rounded-xl px-4 py-3.5 border border-neutral-100 hover:border-pink-100 transition-colors"
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + i * 0.1, duration: 0.4 }}
                  >
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">{item.name}</p>
                      <p className="text-xs text-neutral-400 mt-0.5">{item.brand}</p>
                    </div>
                    <span className={`text-[11px] font-semibold px-3 py-1.5 rounded-full ${
                      item.statusColor === "amber" ? "bg-amber-50 text-amber-600 border border-amber-100" :
                      item.statusColor === "pink" ? "bg-pink-50 text-pink-600 border border-pink-100" :
                      "bg-emerald-50 text-emerald-600 border border-emerald-100"
                    }`}>
                      {item.status}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Stats */}
      <section className="px-6 py-24 bg-neutral-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(236,72,153,0.08),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(168,85,247,0.06),transparent_50%)]" />
        <div className="max-w-5xl mx-auto grid grid-cols-3 gap-8 text-center relative">
          {[
            { value: c.stats.stat1_value, label: c.stats.stat1_label },
            { value: c.stats.stat2_value, label: c.stats.stat2_label },
            { value: c.stats.stat3_value, label: c.stats.stat3_label },
          ].map((stat, i) => (
            <FadeIn key={i} delay={i * 0.1}>
              <div className="py-4">
                <div className="text-4xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-b from-white to-neutral-400 bg-clip-text text-transparent">{stat.value}</div>
                <div className="text-neutral-400 text-sm mt-3 font-medium">{stat.label}</div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* For Brands */}
      <section className="px-6 py-28 relative">
        <div className="absolute top-1/2 right-0 w-[300px] h-[300px] rounded-full bg-purple-50/50 blur-[100px] pointer-events-none -translate-y-1/2" />
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-20 items-center relative">
          <FadeIn delay={0.15} className="order-2 md:order-1">
            <div className="bg-gradient-to-br from-neutral-50 to-purple-50/20 rounded-3xl p-6 border border-neutral-100 shadow-lg shadow-neutral-200/20">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-400" />
                  <p className="text-xs font-semibold text-neutral-500">לוח בקרה</p>
                </div>
                <span className="text-[10px] font-medium text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full">עדכון אחרון: היום</span>
              </div>
              <div className="space-y-2.5">
                {[
                  { label: "סרטונים שהתקבלו", val: "—", icon: "M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-2.625 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0118 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0118 7.125v-1.5m1.125 2.625c-.621 0-1.125.504-1.125 1.125v1.5m2.625-2.625c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M18 5.625v5.25M7.125 12h9.75m-9.75 0A1.125 1.125 0 016 10.875M7.125 12C6.504 12 6 12.504 6 13.125m0-2.25C6 11.496 5.496 12 4.875 12M18 10.875c0 .621-.504 1.125-1.125 1.125M18 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m-12 5.25v-5.25m0 5.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125m-12 0v-1.5c0-.621-.504-1.125-1.125-1.125M18 18.375v-5.25m0 5.25v-1.5c0-.621.504-1.125 1.125-1.125M18 13.125v1.5c0 .621.504 1.125 1.125 1.125M18 13.125c0-.621.504-1.125 1.125-1.125M6 13.125v1.5c0 .621-.504 1.125-1.125 1.125M6 13.125C6 12.504 5.496 12 4.875 12m-1.5 0h1.5m-1.5 0c-.621 0-1.125-.504-1.125-1.125v-1.5c0-.621.504-1.125 1.125-1.125m1.5 3.75c-.621 0-1.125-.504-1.125-1.125M19.125 12h1.5m0 0c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75c-.621 0-1.125-.504-1.125-1.125" },
                  { label: "צפיות כוללות", val: "—", icon: "M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
                  { label: "עלות לסרטון", val: "—", icon: "M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
                  { label: "ROI", val: "—", icon: "M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.281m5.94 2.28l-2.28 5.941" },
                ].map((row, i) => (
                  <motion.div
                    key={row.label}
                    className="flex items-center justify-between bg-white rounded-xl px-4 py-3.5 border border-neutral-100"
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + i * 0.08, duration: 0.4 }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-neutral-50 flex items-center justify-center">
                        <Icon d={row.icon} className="w-4 h-4 text-neutral-400" />
                      </div>
                      <span className="text-sm text-neutral-600">{row.label}</span>
                    </div>
                    <span className="text-sm font-bold text-neutral-900">{row.val}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </FadeIn>

          <FadeIn className="order-1 md:order-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px w-8 bg-pink-300" />
              <p className="text-sm font-semibold text-pink-500 tracking-wide">למותגים ועסקים</p>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold leading-tight text-neutral-900">
              {c.brands.title_line1} <span className="bg-gradient-to-l from-pink-500 to-rose-500 bg-clip-text text-transparent">{c.brands.title_line2}</span>
            </h2>
            <div className="mt-8 space-y-4">
              {[c.brands.benefit1, c.brands.benefit2, c.brands.benefit3, c.brands.benefit4].map((text, i) => (
                <motion.div
                  key={text}
                  className="flex items-start gap-3"
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.4 }}
                >
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center mt-0.5 shrink-0 shadow-sm shadow-pink-500/20">
                    <Icon d={checkIcon} className="w-3.5 h-3.5 text-white" />
                  </div>
                  <p className="text-neutral-600 leading-relaxed">{text}</p>
                </motion.div>
              ))}
            </div>
            <Link
              href="/register?type=brand"
              className="group inline-flex items-center gap-2 mt-8 px-7 py-3.5 rounded-full bg-neutral-900 text-white font-semibold hover:bg-neutral-800 transition-all shadow-lg shadow-neutral-900/20 hover:shadow-xl"
            >
              {c.brands.cta}
              <Icon d={arrowIcon} className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            </Link>
          </FadeIn>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-pink-50/80 via-white to-rose-50/60" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-pink-100/40 blur-[120px] pointer-events-none" />
        <FadeIn>
          <div className="max-w-2xl mx-auto text-center relative">
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-neutral-900">
              {c.cta_final.title_line1} <span className="bg-gradient-to-l from-pink-500 to-rose-500 bg-clip-text text-transparent">{c.cta_final.title_line2}</span>
            </h2>
            <p className="mt-4 text-neutral-500 max-w-sm mx-auto leading-relaxed">
              {c.cta_final.subtitle}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/register?type=creator"
                className="group inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full bg-gradient-to-l from-pink-500 to-rose-500 text-white font-semibold hover:from-pink-600 hover:to-rose-600 transition-all shadow-lg shadow-pink-500/25 hover:shadow-xl hover:shadow-pink-500/30"
              >
                {c.cta_final.cta_primary}
                <Icon d={arrowIcon} className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/register?type=brand"
                className="inline-flex items-center justify-center px-8 py-3.5 rounded-full bg-white border border-neutral-200 text-neutral-700 font-semibold hover:border-neutral-300 hover:shadow-md transition-all"
              >
                {c.cta_final.cta_secondary}
              </Link>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* Footer */}
      <footer className="px-6 py-12 bg-neutral-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(236,72,153,0.05),transparent_50%)]" />
        <div className="max-w-5xl mx-auto relative">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <p className="text-lg font-bold">
                <span className="text-pink-400">M</span>ashpianim
              </p>
              <p className="text-neutral-500 text-sm mt-1">{c.footer.tagline}</p>
            </div>
            <div className="flex gap-6 text-sm text-neutral-500">
              <Link href="/terms" className="hover:text-white transition-colors">תנאי שימוש</Link>
              <Link href="/about" className="hover:text-white transition-colors">אודות</Link>
              <Link href="/login" className="hover:text-white transition-colors">התחברות</Link>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-neutral-800 text-center text-neutral-600 text-xs">
            &copy; {new Date().getFullYear()} {c.footer.copyright}
          </div>
        </div>
      </footer>
    </main>
  );
}
