"use client";

import Link from "next/link";
import Image from "next/image";
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
    benefit2: "מחירים שפויים — פנייה אחת = סרטון אחד",
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
    copyright: "Mashpian. כל הזכויות שמורות.",
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
        const stored = localStorage.getItem("mashpian_site_content");
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
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
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

function FloatingOrb({ className, delay = 0 }: { className: string; delay?: number }) {
  return (
    <motion.div
      className={`absolute rounded-full pointer-events-none ${className}`}
      animate={{ y: [-20, 20, -20], x: [-10, 10, -10], scale: [1, 1.1, 1] }}
      transition={{ duration: 8, delay, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between glass rounded-2xl px-5 py-3 shadow-lg shadow-black/[0.04] border border-white/60">
            <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight text-neutral-900">
              <Image src="/icon-192.png" alt="משפיען אונליין" width={36} height={36} unoptimized className="rounded-lg" />
              <span><span className="ig-gradient-text">M</span>ashpian</span>
            </Link>
            <div className="flex items-center gap-2">
              <Link href="/login" className="text-sm font-medium ig-gradient-bg text-white px-5 py-2.5 rounded-full hover:opacity-90 transition-all shadow-lg shadow-ig-pink/25">
                התחברות
              </Link>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Hero */}
      <motion.section ref={heroRef} style={{ opacity: heroOpacity, scale: heroScale }} className="relative pt-28 sm:pt-32 pb-20 sm:pb-28 px-4 sm:px-6">
        {/* Animated gradient orbs */}
        <FloatingOrb className="top-16 left-[10%] w-[350px] h-[350px] bg-ig-purple/20 blur-[120px]" delay={0} />
        <FloatingOrb className="top-48 right-[5%] w-[300px] h-[300px] bg-ig-pink/25 blur-[100px]" delay={2} />
        <FloatingOrb className="top-32 left-[50%] w-[400px] h-[400px] bg-ig-orange/15 blur-[140px]" delay={4} />
        <FloatingOrb className="bottom-20 left-[20%] w-[250px] h-[250px] bg-ig-yellow/20 blur-[100px]" delay={1} />

        <div className="relative max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-ig-pink text-xs font-semibold tracking-wide border border-ig-pink/20 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ig-orange opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 ig-gradient-bg" />
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
            <span className="ig-gradient-text">{c.hero.title_line2}</span>
          </motion.h1>

          <motion.p
            className="mt-6 text-lg text-neutral-600 max-w-md mx-auto leading-relaxed"
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
              className="group inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full ig-gradient-bg-animated text-white font-semibold transition-all shadow-lg shadow-ig-pink/30 hover:shadow-xl hover:shadow-ig-pink/40 hover:scale-[1.02]"
            >
              {c.hero.cta_creator}
              <Icon d={arrowIcon} className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/register?type=brand"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full glass border border-neutral-200/80 text-neutral-700 font-semibold hover:border-ig-pink/30 hover:shadow-lg transition-all"
            >
              {c.hero.cta_brand}
            </Link>
          </motion.div>

          {/* Hero illustration card */}
          <motion.div
            className="mt-14 sm:mt-16 mx-auto max-w-lg"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.7 }}
          >
            <div className="relative rounded-3xl p-[2px] bg-gradient-to-br from-ig-purple via-ig-pink to-ig-orange shadow-2xl shadow-ig-pink/20">
              <div className="bg-white rounded-[22px] p-5">
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-neutral-100">
                  <Image src="/icon-192.png" alt="משפיען" width={40} height={40} unoptimized className="rounded-lg shadow-md shadow-ig-pink/30" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-neutral-900">הפרופיל שלך</div>
                    <div className="text-xs text-neutral-500">רמה &middot; סרטונים &middot; דירוג</div>
                  </div>
                  <span className="text-xs font-medium bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-full border border-emerald-100">פעילה</span>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {heroVideos.map((video) => (
                    <div key={video.label} className="relative aspect-[9/16] rounded-2xl overflow-hidden group cursor-pointer bg-neutral-100 shadow-sm">
                      <img src={video.img} alt={video.label} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="w-10 h-10 rounded-full glass shadow-lg flex items-center justify-center">
                          <svg className="w-5 h-5 text-ig-pink mr-[-2px]" fill="currentColor" viewBox="0 0 24 24">
                            <path d={playIcon} />
                          </svg>
                        </div>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent p-2.5 pt-8">
                        <p className="text-white text-[11px] font-semibold text-center">{video.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* Scrolling social proof ticker */}
      <div className="relative py-6 overflow-hidden bg-neutral-50/80">
        <div className="absolute inset-0 bg-gradient-to-l from-neutral-50 via-transparent to-neutral-50 z-10 pointer-events-none" />
        <motion.div
          className="flex gap-8 items-center whitespace-nowrap"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        >
          {[...Array(2)].map((_, j) => (
            <div key={j} className="flex gap-8 items-center">
              {["ביוטי", "אופנה", "אוכל", "טכנולוגיה", "כושר", "בית", "ספורט", "משחקים", "מוזיקה", "טיולים"].map((cat) => (
                <span key={`${j}-${cat}`} className="text-sm font-medium text-neutral-500 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full ig-gradient-bg" />
                  {cat}
                </span>
              ))}
            </div>
          ))}
        </motion.div>
      </div>

      {/* How it works */}
      <section className="px-4 sm:px-6 py-24 sm:py-28 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-l from-transparent via-ig-pink/30 to-transparent" />
        <div className="max-w-5xl mx-auto">
          <FadeIn>
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="h-px w-8 bg-gradient-to-l from-ig-purple to-ig-pink" />
              <p className="text-sm font-semibold ig-gradient-text tracking-wide">איך זה עובד</p>
              <div className="h-px w-8 bg-gradient-to-l from-ig-pink to-ig-orange" />
            </div>
            <h2 className="text-3xl md:text-5xl font-bold text-center text-neutral-900">{c.how_it_works.section_title}</h2>
          </FadeIn>

          <div className="mt-14 sm:mt-16 grid md:grid-cols-3 gap-5 sm:gap-6">
            {[
              { step: "01", title: c.how_it_works.step1_title, desc: c.how_it_works.step1_desc, icon: stepIcon1, color: "from-ig-purple to-ig-magenta" },
              { step: "02", title: c.how_it_works.step2_title, desc: c.how_it_works.step2_desc, icon: stepIcon2, color: "from-ig-pink to-ig-orange" },
              { step: "03", title: c.how_it_works.step3_title, desc: c.how_it_works.step3_desc, icon: stepIcon3, color: "from-ig-orange to-ig-yellow" },
            ].map((item, i) => (
              <FadeIn key={item.step} delay={i * 0.12}>
                <div className="relative bg-white rounded-2xl p-7 sm:p-8 pt-10 border border-neutral-100 hover:border-transparent hover:shadow-2xl hover:shadow-ig-pink/[0.08] transition-all duration-500 group">
                  <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ background: "linear-gradient(135deg, rgba(131,58,180,0.03), rgba(225,48,108,0.03), rgba(247,119,55,0.03))" }} />
                  <div className={`absolute top-4 left-4 w-9 h-9 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center shadow-md shadow-ig-pink/20`}>
                    <span className="text-white text-xs font-bold">{item.step}</span>
                  </div>
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${item.color} bg-opacity-10 flex items-center justify-center mb-5 transition-all duration-300`} style={{ background: `linear-gradient(135deg, ${i === 0 ? "rgba(131,58,180,0.08)" : i === 1 ? "rgba(225,48,108,0.08)" : "rgba(247,119,55,0.08)"}, ${i === 0 ? "rgba(193,53,132,0.08)" : i === 1 ? "rgba(247,119,55,0.08)" : "rgba(252,175,69,0.08)"})` }}>
                    <Icon d={item.icon} className={`w-7 h-7 ${i === 0 ? "text-ig-purple" : i === 1 ? "text-ig-pink" : "text-ig-orange"}`} />
                  </div>
                  <h3 className="text-xl font-bold text-neutral-900">{item.title}</h3>
                  <p className="mt-3 text-neutral-600 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* For Creators */}
      <section className="px-4 sm:px-6 py-24 sm:py-28 relative bg-gradient-to-b from-white to-neutral-50/50">
        <FloatingOrb className="top-1/2 left-0 w-[300px] h-[300px] bg-ig-purple/10 blur-[100px] -translate-y-1/2" delay={1} />
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 md:gap-20 items-center relative">
          <FadeIn>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px w-8 bg-gradient-to-l from-ig-purple to-ig-pink" />
              <p className="text-sm font-semibold ig-gradient-text tracking-wide">ליוצרי תוכן</p>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold leading-tight text-neutral-900">
              {c.creators.title_line1} <span className="ig-gradient-text">{c.creators.title_line2}</span>
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
                  <div className="w-6 h-6 rounded-lg ig-gradient-bg flex items-center justify-center mt-0.5 shrink-0 shadow-sm shadow-ig-pink/20">
                    <Icon d={checkIcon} className="w-3.5 h-3.5 text-white" />
                  </div>
                  <p className="text-neutral-600 leading-relaxed">{text}</p>
                </motion.div>
              ))}
            </div>
            <Link
              href="/register?type=creator"
              className="group inline-flex items-center gap-2 mt-8 px-7 py-3.5 rounded-full ig-gradient-bg-animated text-white font-semibold transition-all shadow-lg shadow-ig-pink/25 hover:shadow-xl hover:shadow-ig-pink/35 hover:scale-[1.02]"
            >
              {c.creators.cta}
              <Icon d={arrowIcon} className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            </Link>
          </FadeIn>

          <FadeIn delay={0.15}>
            <div className="relative rounded-3xl p-[1.5px] bg-gradient-to-br from-ig-purple/40 via-ig-pink/40 to-ig-orange/40">
              <div className="bg-white rounded-[22px] p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 rounded-full ig-gradient-bg" />
                  <p className="text-xs font-semibold text-neutral-600">החיבורים שלך</p>
                </div>
                <div className="space-y-2.5">
                  {[
                    { name: "סרום פנים פרימיום", brand: "Beauty Lab", status: "ממתין לאישור", statusColor: "amber" },
                    { name: "חולצת כותנה אורגנית", brand: "GreenWear", status: "אושר — צלמו", statusColor: "ig" },
                    { name: "שייקר חלבון", brand: "FitMix", status: "סרטון הועלה", statusColor: "emerald" },
                  ].map((item, i) => (
                    <motion.div
                      key={i}
                      className="flex items-center justify-between bg-neutral-50/80 rounded-xl px-4 py-3.5 border border-neutral-100 hover:border-ig-pink/20 hover:bg-white transition-all"
                      initial={{ opacity: 0, y: 12 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.2 + i * 0.1, duration: 0.4 }}
                    >
                      <div>
                        <p className="text-sm font-semibold text-neutral-900">{item.name}</p>
                        <p className="text-xs text-neutral-500 mt-0.5">{item.brand}</p>
                      </div>
                      <span className={`text-[11px] font-semibold px-3 py-1.5 rounded-full ${
                        item.statusColor === "amber" ? "bg-amber-50 text-amber-600 border border-amber-100" :
                        item.statusColor === "ig" ? "bg-gradient-to-l from-ig-purple/10 to-ig-pink/10 text-ig-pink border border-ig-pink/20" :
                        "bg-emerald-50 text-emerald-600 border border-emerald-100"
                      }`}>
                        {item.status}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Stats */}
      <section className="px-4 sm:px-6 py-20 sm:py-24 relative overflow-hidden">
        <div className="absolute inset-0 ig-gradient-bg-animated opacity-95" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(255,255,255,0.08),transparent_50%)]" />
        <div className="max-w-5xl mx-auto grid grid-cols-3 gap-6 sm:gap-8 text-center relative">
          {[
            { value: c.stats.stat1_value, label: c.stats.stat1_label },
            { value: c.stats.stat2_value, label: c.stats.stat2_label },
            { value: c.stats.stat3_value, label: c.stats.stat3_label },
          ].map((stat, i) => (
            <FadeIn key={i} delay={i * 0.1}>
              <div className="py-4">
                <div className="text-4xl md:text-6xl font-extrabold tracking-tight text-white drop-shadow-lg">{stat.value}</div>
                <div className="text-white/70 text-sm mt-3 font-medium">{stat.label}</div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* How the platform works — for brands */}
      <section className="px-4 sm:px-6 py-24 sm:py-28 relative bg-neutral-900 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(225,48,108,0.08),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(131,58,180,0.06),transparent_50%)]" />
        <div className="max-w-3xl mx-auto relative">
          <FadeIn>
            <div className="text-center mb-16">
              <div className="flex items-center justify-center gap-2 mb-3">
                <div className="h-px w-8 bg-gradient-to-l from-ig-orange to-ig-pink" />
                <p className="text-sm font-semibold text-ig-pink tracking-wide">למותגים ועסקים</p>
                <div className="h-px w-8 bg-gradient-to-l from-ig-pink to-ig-purple" />
              </div>
              <h2 className="text-3xl md:text-5xl font-extrabold text-white">ככה הפלטפורמה עובדת</h2>
            </div>
          </FadeIn>

          <div className="relative">
            {/* Vertical timeline line */}
            <div className="absolute top-0 bottom-0 right-[23px] sm:right-auto sm:left-1/2 sm:-translate-x-1/2 w-[2px] bg-gradient-to-b from-ig-purple via-ig-pink to-ig-orange" />

            {[
              {
                step: "1",
                title: "העלו מוצר",
                desc: "הוסיפו את המוצר שלכם לפלטפורמה בקליק. תיאור, תמונות, ופרטי משלוח — ויוצרי התוכן כבר רואים אותו.",
                gradient: "from-ig-purple to-ig-magenta",
              },
              {
                step: "2",
                title: "התחברו ליוצרים",
                desc: "יוצרי תוכן מאומתים שולחים בקשות חיבור. בחרו את המתאימים לפי סגנון, קטגוריה ודירוג.",
                gradient: "from-ig-pink to-ig-orange",
              },
              {
                step: "3",
                title: "שלחו את המוצר",
                desc: "אשרו את החיבור ושלחו את המוצר ישירות ליוצר — הפלטפורמה מנהלת את כל התהליך.",
                gradient: "from-ig-orange to-ig-yellow",
              },
              {
                step: "4",
                title: "קבלו תוכן UGC",
                desc: "תוך 10 ימים תקבלו סרטון UGC אותנטי מוכן לפרסום ברשתות החברתיות שלכם.",
                gradient: "from-ig-yellow to-emerald-400",
              },
            ].map((item, i) => (
              <FadeIn key={item.step} delay={i * 0.12}>
                <div className={`relative flex items-start gap-5 sm:gap-8 mb-12 last:mb-0 ${i % 2 === 0 ? "sm:flex-row" : "sm:flex-row-reverse"}`}>
                  {/* Step number circle */}
                  <div className="relative z-10 shrink-0">
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${item.gradient} flex items-center justify-center shadow-lg shadow-ig-pink/30`}>
                      <span className="text-white text-lg font-bold">{item.step}</span>
                    </div>
                  </div>

                  {/* Content card */}
                  <div className={`flex-1 bg-white/[0.06] backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-ig-pink/30 transition-all ${i % 2 === 0 ? "sm:mr-auto" : "sm:ml-auto"}`}>
                    <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                    <p className="text-neutral-400 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={0.5}>
            <div className="text-center mt-14">
              <Link
                href="/register?type=brand"
                className="group inline-flex items-center gap-2 px-8 py-4 rounded-full ig-gradient-bg-animated text-white font-semibold transition-all shadow-lg shadow-ig-pink/30 hover:shadow-xl hover:shadow-ig-pink/40 hover:scale-[1.02]"
              >
                {c.brands.cta}
                <Icon d={arrowIcon} className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 sm:px-6 py-24 sm:py-28 relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(131,58,180,0.06), rgba(225,48,108,0.06), rgba(247,119,55,0.04), rgba(252,175,69,0.03))" }} />
        <FloatingOrb className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-ig-pink/10 blur-[120px]" delay={0} />
        <FadeIn>
          <div className="max-w-2xl mx-auto text-center relative">
            <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight text-neutral-900">
              {c.cta_final.title_line1} <span className="ig-gradient-text">{c.cta_final.title_line2}</span>
            </h2>
            <p className="mt-5 text-neutral-600 max-w-sm mx-auto leading-relaxed text-lg">
              {c.cta_final.subtitle}
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/register?type=creator"
                className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full ig-gradient-bg-animated text-white font-semibold transition-all shadow-lg shadow-ig-pink/25 hover:shadow-xl hover:shadow-ig-pink/40 hover:scale-[1.02]"
              >
                {c.cta_final.cta_primary}
                <Icon d={arrowIcon} className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/register?type=brand"
                className="inline-flex items-center justify-center px-8 py-4 rounded-full glass border border-neutral-200/80 text-neutral-700 font-semibold hover:border-ig-pink/30 hover:shadow-lg transition-all"
              >
                {c.cta_final.cta_secondary}
              </Link>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* Footer */}
      <footer className="px-4 sm:px-6 py-12 bg-neutral-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(131,58,180,0.08),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(247,119,55,0.05),transparent_50%)]" />
        <div className="max-w-5xl mx-auto relative">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2">
                <Image src="/icon-192.png" alt="משפיען אונליין" width={32} height={32} unoptimized className="rounded-lg" />
                <p className="text-lg font-bold">
                  <span className="ig-gradient-text">M</span>ashpian
                </p>
              </div>
              <p className="text-neutral-400 text-sm mt-1">{c.footer.tagline}</p>
            </div>
            <div className="flex gap-6 text-sm text-neutral-400">
              <Link href="/terms" className="hover:text-white transition-colors">תנאי שירות</Link>
              <Link href="/privacy" className="hover:text-white transition-colors">פרטיות</Link>
              <Link href="/refunds" className="hover:text-white transition-colors">החזרים</Link>
              <Link href="/login" className="hover:text-white transition-colors">התחברות</Link>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-neutral-800 text-center text-neutral-500 text-xs">
            &copy; {new Date().getFullYear()} {c.footer.copyright}
          </div>
        </div>
      </footer>
    </main>
  );
}
