"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

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

export default function HomePage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

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
              הפלטפורמה ליוצרי תוכן ומותגים בישראל
            </span>
          </motion.div>

          <motion.h1
            className="mt-8 text-5xl md:text-7xl font-extrabold leading-[1.08] tracking-tight text-neutral-900"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            יוצרים תוכן.
            <br />
            <span className="text-pink-500">מחברים מותגים.</span>
          </motion.h1>

          <motion.p
            className="mt-6 text-lg text-neutral-500 max-w-md mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.45 }}
          >
            קבלו מוצרים חינם, צלמו סרטונים אותנטיים, וצמחו כיוצרי תוכן.
            עסקים — קבלו תוכן UGC איכותי במחיר שפוי.
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
              אני יוצר/ת תוכן
              <Icon d={arrowIcon} className="w-4 h-4" />
            </Link>
            <Link
              href="/register?type=brand"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full border border-neutral-200 text-neutral-700 font-semibold hover:bg-neutral-50 transition-all"
            >
              אני בעל/ת עסק
            </Link>
          </motion.div>

          {/* Mock UI card */}
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
                  <div className="text-sm font-semibold text-neutral-900">שרה כ. — יוצרת תוכן</div>
                  <div className="text-xs text-neutral-400">רמה 3 · 28 סרטונים · 4.9 דירוג</div>
                </div>
                <span className="text-xs font-medium bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-full border border-emerald-100">פעילה</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="aspect-[9/16] rounded-xl bg-gradient-to-b from-neutral-100 to-neutral-50 flex items-center justify-center">
                    <svg className="w-8 h-8 text-neutral-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                    </svg>
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
            <h2 className="text-3xl md:text-4xl font-bold text-center mt-3 text-neutral-900">שלושה צעדים פשוטים</h2>
          </FadeIn>

          <div className="mt-16 grid md:grid-cols-3 gap-8">
            {[
              { step: "01", title: "בחרו מוצר", desc: "גלו מוצרים מעניינים מעסקים מובילים ושלחו בקשת חיבור", icon: stepIcon1 },
              { step: "02", title: "צלמו סרטון", desc: "קבלו את המוצר חינם וצלמו סרטון UGC אותנטי תוך 10 ימים", icon: stepIcon2 },
              { step: "03", title: "צמחו", desc: "צברו ניסיון, עלו ברמות, והפכו ליוצרי תוכן מבוקשים", icon: stepIcon3 },
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
              הפכו את <span className="text-pink-500">התשוקה למקצוע</span>
            </h2>
            <div className="mt-8 space-y-4">
              {[
                "קבלו מוצרים חינם מהמותגים המובילים",
                "צלמו תוכן בסגנון שלכם, בקצב שלכם",
                "צמחו עם מערכת דירוגים ייחודית",
                "בנו פורטפוליו מקצועי מרשים",
              ].map((text) => (
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
              הצטרפו כיוצרי תוכן
              <Icon d={arrowIcon} className="w-4 h-4" />
            </Link>
          </FadeIn>

          <FadeIn delay={0.15}>
            <div className="bg-neutral-50 rounded-2xl p-8 border border-neutral-100">
              <div className="space-y-3">
                {[
                  { name: "סרום ויטמין C", brand: "GlowUp Skincare", status: "ממתין לאישור" },
                  { name: "אוזניות ספורט", brand: "TechFit", status: "אושר — צלמו" },
                  { name: "סט יוגה", brand: "ZenLife", status: "סרטון הועלה" },
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
            { value: "500+", label: "יוצרי תוכן פעילים" },
            { value: "200+", label: "מותגים ועסקים" },
            { value: "2,000+", label: "סרטונים שנוצרו" },
          ].map((stat, i) => (
            <FadeIn key={stat.label} delay={i * 0.1}>
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
                <p className="text-sm font-bold text-neutral-900">ביצועי קמפיין</p>
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">+23% מהחודש שעבר</span>
              </div>
              <div className="space-y-3">
                {[
                  { label: "סרטונים שהתקבלו", val: "12" },
                  { label: "צפיות כוללות", val: "48.2K" },
                  { label: "עלות לסרטון", val: "₪70" },
                  { label: "ROI", val: "340%" },
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
              תוכן שעובד <span className="text-pink-500">בלי הפקות יקרות</span>
            </h2>
            <div className="mt-8 space-y-4">
              {[
                "תוכן UGC אותנטי שמביא תוצאות",
                "מחירים שפויים — קרדיט אחד = סרטון אחד",
                "יוצרים מאומתים ומדורגים",
                "ניהול קל דרך לוח בקרה חכם",
              ].map((text) => (
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
              הצטרפו כמפרסמים
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
              מוכנים <span className="text-pink-500">להתחיל?</span>
            </h2>
            <p className="mt-4 text-neutral-500 max-w-sm mx-auto">
              הצטרפו לקהילת היוצרים והמותגים הגדלה. חינם לגמרי ליוצרי תוכן.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/register?type=creator"
                className="inline-flex items-center justify-center px-8 py-3.5 rounded-full bg-pink-500 text-white font-semibold hover:bg-pink-600 transition-all shadow-lg shadow-pink-500/20"
              >
                הרשמה חינם
              </Link>
              <Link
                href="/register?type=brand"
                className="inline-flex items-center justify-center px-8 py-3.5 rounded-full border border-neutral-200 text-neutral-700 font-semibold hover:bg-white transition-all"
              >
                אני מפרסם
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
              <p className="text-neutral-500 text-sm mt-1">הפלטפורמה ליוצרי תוכן ומותגים</p>
            </div>
            <div className="flex gap-6 text-sm text-neutral-500">
              <Link href="/terms" className="hover:text-white transition-colors">תנאי שימוש</Link>
              <Link href="/about" className="hover:text-white transition-colors">אודות</Link>
              <Link href="/login" className="hover:text-white transition-colors">התחברות</Link>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-neutral-800 text-center text-neutral-600 text-xs">
            &copy; {new Date().getFullYear()} Mashpianim. כל הזכויות שמורות.
          </div>
        </div>
      </footer>
    </main>
  );
}
