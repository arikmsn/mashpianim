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
      // Try API first (reads from Supabase when configured)
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
      // Fallback to localStorage
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
          <div className="flex items-center justify-between bg-white/90 backdrop-blur-lg rounded-2xl px-6 py-3 shadow-sm border border-neutral-100">
            <Link href="/" className="text-lg font-bold tracking-tight text-neutral-900">
              <span className="text-pink-500">M</span>ashpianim
            </Link>
            <div className="flex items-center gap-2">
              <Link href="/login" className="text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors px-4 py-2">
                התחברות
              </Link>
              <Link href="/register?type=creator" className="text-sm font-medium bg-neutral-900 text-white px-5 py-2 rounded-full hover:bg-neutral-800 transition-colors">
                הצטרפו
              </Link>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Hero */}
      <motion.section ref={heroRef} style={{ opacity: heroOpacity }} className="relative pt-32 pb-24 px-6">
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-pink-50 blur-[120px] opacity-60 pointer-events-none" />

        <div className="relative max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-pink-50 text-pink-600 text-xs font-semibold tracking-wide border border-pink-100">
              <span className="w-1.5 h-1.5 rounded-full bg-pink-500" />
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
            <span className="text-pink-500">{c.hero.title_line2}</span>
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
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-pink-500 text-white font-semibold hover:bg-pink-600 transition-all shadow-lg shadow-pink-500/20"
            >
              {c.hero.cta_creator}
              <Icon d={arrowIcon} className="w-4 h-4" />
            </Link>
            <Link
              href="/register?type=brand"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full border border-neutral-200 text-neutral-700 font-semibold hover:bg-neutral-50 transition-all"
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
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-xl shadow-neutral-200/50 p-5">
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-neutral-100">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-pink-600" />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-neutral-900">הפרופיל שלך</div>
                  <div className="text-xs text-neutral-400">רמה · סרטונים · דירוג</div>
                </div>
                <span className="text-xs font-medium bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-full border border-emerald-100">פעילה</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {heroVideos.map((video) => (
                  <div key={video.label} className="relative aspect-[9/16] rounded-xl overflow-hidden group cursor-pointer bg-neutral-100">
                    <img src={video.img} alt={video.label} className="absolute inset-0 w-full h-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center group-hover:bg-black/40 transition-colors">
                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d={playIcon} />
                        </svg>
                      </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 pt-6">
                      <p className="text-white text-[10px] font-medium text-center leading-tight">{video.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* How it works */}
      <section className="px-6 py-28 bg-neutral-50">
        <div className="max-w-5xl mx-auto">
          <FadeIn>
            <p className="text-sm font-semibold text-pink-500 text-center tracking-wide">איך זה עובד</p>
            <h2 className="text-3xl md:text-4xl font-bold text-center mt-3 text-neutral-900">{c.how_it_works.section_title}</h2>
          </FadeIn>

          <div className="mt-16 grid md:grid-cols-3 gap-8">
            {[
              { step: "01", title: c.how_it_works.step1_title, desc: c.how_it_works.step1_desc, icon: stepIcon1 },
              { step: "02", title: c.how_it_works.step2_title, desc: c.how_it_works.step2_desc, icon: stepIcon2 },
              { step: "03", title: c.how_it_works.step3_title, desc: c.how_it_works.step3_desc, icon: stepIcon3 },
            ].map((item, i) => (
              <FadeIn key={item.step} delay={i * 0.12}>
                <div className="relative bg-white rounded-2xl p-8 border border-neutral-100 hover:border-pink-100 hover:shadow-lg hover:shadow-pink-500/5 transition-all duration-300">
                  <div className="w-12 h-12 rounded-xl bg-pink-50 flex items-center justify-center mb-5">
                    <Icon d={item.icon} className="w-6 h-6 text-pink-500" />
                  </div>
                  <span className="text-[11px] font-bold text-pink-400 tracking-widest">{item.step}</span>
                  <h3 className="text-xl font-bold mt-2 text-neutral-900">{item.title}</h3>
                  <p className="mt-3 text-neutral-500 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* For Creators */}
      <section className="px-6 py-28">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-20 items-center">
          <FadeIn>
            <p className="text-sm font-semibold text-pink-500 tracking-wide">ליוצרי תוכן</p>
            <h2 className="text-3xl md:text-4xl font-bold mt-3 leading-tight text-neutral-900">
              {c.creators.title_line1} <span className="text-pink-500">{c.creators.title_line2}</span>
            </h2>
            <div className="mt-8 space-y-4">
              {[c.creators.benefit1, c.creators.benefit2, c.creators.benefit3, c.creators.benefit4].map((text) => (
                <div key={text} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-pink-50 flex items-center justify-center mt-0.5 shrink-0">
                    <Icon d={checkIcon} className="w-3 h-3 text-pink-500" />
                  </div>
                  <p className="text-neutral-600">{text}</p>
                </div>
              ))}
            </div>
            <Link
              href="/register?type=creator"
              className="inline-flex items-center gap-2 mt-8 px-7 py-3 rounded-full bg-pink-500 text-white font-semibold hover:bg-pink-600 transition-all shadow-lg shadow-pink-500/15"
            >
              {c.creators.cta}
              <Icon d={arrowIcon} className="w-4 h-4" />
            </Link>
          </FadeIn>

          <FadeIn delay={0.15}>
            <div className="bg-neutral-50 rounded-2xl p-8 border border-neutral-100">
              <div className="space-y-3">
                {[
                  { name: "מוצר לדוגמה", brand: "מותג א׳", status: "ממתין לאישור" },
                  { name: "מוצר שני", brand: "מותג ב׳", status: "אושר — צלמו" },
                  { name: "מוצר שלישי", brand: "מותג ג׳", status: "סרטון הועלה" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-neutral-100">
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">{item.name}</p>
                      <p className="text-xs text-neutral-400">{item.brand}</p>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      i === 0 ? "bg-amber-50 text-amber-600 border border-amber-100" :
                      i === 1 ? "bg-pink-50 text-pink-600 border border-pink-100" :
                      "bg-emerald-50 text-emerald-600 border border-emerald-100"
                    }`}>
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Stats */}
      <section className="px-6 py-20 bg-neutral-900 text-white">
        <div className="max-w-5xl mx-auto grid grid-cols-3 gap-8 text-center">
          {[
            { value: c.stats.stat1_value, label: c.stats.stat1_label },
            { value: c.stats.stat2_value, label: c.stats.stat2_label },
            { value: c.stats.stat3_value, label: c.stats.stat3_label },
          ].map((stat, i) => (
            <FadeIn key={i} delay={i * 0.1}>
              <div className="text-4xl md:text-5xl font-extrabold tracking-tight">{stat.value}</div>
              <div className="text-neutral-400 text-sm mt-2 font-medium">{stat.label}</div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* For Brands */}
      <section className="px-6 py-28">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-20 items-center">
          <FadeIn delay={0.15} className="order-2 md:order-1">
            <div className="bg-neutral-50 rounded-2xl p-8 border border-neutral-100">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold text-neutral-900">לוח בקרה חכם</p>
              </div>
              <div className="space-y-3">
                {[
                  { label: "סרטונים שהתקבלו", val: "—" },
                  { label: "צפיות כוללות", val: "—" },
                  { label: "עלות לסרטון", val: "—" },
                  { label: "ROI", val: "—" },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-neutral-100">
                    <span className="text-sm text-neutral-500">{row.label}</span>
                    <span className="text-sm font-bold text-neutral-900">{row.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>

          <FadeIn className="order-1 md:order-2">
            <p className="text-sm font-semibold text-pink-500 tracking-wide">למותגים ועסקים</p>
            <h2 className="text-3xl md:text-4xl font-bold mt-3 leading-tight text-neutral-900">
              {c.brands.title_line1} <span className="text-pink-500">{c.brands.title_line2}</span>
            </h2>
            <div className="mt-8 space-y-4">
              {[c.brands.benefit1, c.brands.benefit2, c.brands.benefit3, c.brands.benefit4].map((text) => (
                <div key={text} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-pink-50 flex items-center justify-center mt-0.5 shrink-0">
                    <Icon d={checkIcon} className="w-3 h-3 text-pink-500" />
                  </div>
                  <p className="text-neutral-600">{text}</p>
                </div>
              ))}
            </div>
            <Link
              href="/register?type=brand"
              className="inline-flex items-center gap-2 mt-8 px-7 py-3 rounded-full bg-neutral-900 text-white font-semibold hover:bg-neutral-800 transition-all"
            >
              {c.brands.cta}
              <Icon d={arrowIcon} className="w-4 h-4" />
            </Link>
          </FadeIn>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-28 bg-neutral-50">
        <FadeIn>
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-neutral-900">
              {c.cta_final.title_line1} <span className="text-pink-500">{c.cta_final.title_line2}</span>
            </h2>
            <p className="mt-4 text-neutral-500 max-w-sm mx-auto">
              {c.cta_final.subtitle}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/register?type=creator"
                className="inline-flex items-center justify-center px-8 py-3.5 rounded-full bg-pink-500 text-white font-semibold hover:bg-pink-600 transition-all shadow-lg shadow-pink-500/20"
              >
                {c.cta_final.cta_primary}
              </Link>
              <Link
                href="/register?type=brand"
                className="inline-flex items-center justify-center px-8 py-3.5 rounded-full border border-neutral-200 text-neutral-700 font-semibold hover:bg-white transition-all"
              >
                {c.cta_final.cta_secondary}
              </Link>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* Footer */}
      <footer className="px-6 py-12 bg-neutral-900 text-white">
        <div className="max-w-5xl mx-auto">
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
