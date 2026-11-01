"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

function FadeInSection({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default function HomePage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.8], [1, 0.95]);

  return (
    <main className="min-h-screen bg-[#F9F8F5] overflow-x-hidden">
      {/* Floating Nav */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="fixed top-0 left-0 right-0 z-50 px-6 py-4"
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between bg-white/80 backdrop-blur-xl rounded-2xl px-6 py-3 shadow-lg shadow-black/[0.04]">
          <Link href="/" className="text-xl font-bold tracking-tight">
            <span className="text-pink-500">M</span>ashpianim
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors px-4 py-2"
            >
              התחברות
            </Link>
            <Link
              href="/register?type=creator"
              className="text-sm font-medium bg-pink-500 text-white px-5 py-2 rounded-full hover:bg-pink-600 transition-colors shadow-md shadow-pink-500/20"
            >
              הצטרפו
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <motion.section
        ref={heroRef}
        style={{ opacity: heroOpacity, scale: heroScale }}
        className="relative min-h-screen flex items-center justify-center px-6 pt-24"
      >
        {/* Background Orbs */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-pink-300/40 to-pink-500/20 blur-[100px]" />
          <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] rounded-full bg-gradient-to-tr from-purple-300/20 to-pink-400/15 blur-[80px]" />
          <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] rounded-full bg-gradient-to-b from-orange-200/20 to-yellow-200/10 blur-[70px]" />
        </div>

        <div className="relative z-10 text-center max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-pink-500/10 text-pink-600 text-sm font-semibold mb-8 border border-pink-500/10">
              <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
              הפלטפורמה ליוצרי תוכן ומותגים בישראל
            </span>
          </motion.div>

          <motion.h1
            className="text-5xl md:text-7xl lg:text-8xl font-extrabold leading-[1.05] tracking-tight mb-8"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            יוצרים תוכן.
            <br />
            <span className="bg-gradient-to-l from-pink-600 via-pink-500 to-pink-400 bg-clip-text text-transparent">
              מחברים מותגים.
            </span>
          </motion.h1>

          <motion.p
            className="text-lg md:text-xl text-neutral-500 mb-12 max-w-lg mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            קבלו מוצרים חינם, צלמו סרטונים אותנטיים, וצמחו כיוצרי תוכן.
            <br className="hidden md:block" />
            עסקים — קבלו תוכן UGC איכותי במחיר שפוי.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <Link
              href="/register?type=creator"
              className="group relative inline-flex items-center justify-center px-8 py-4 rounded-full bg-pink-500 text-white font-semibold text-lg hover:bg-pink-600 transition-all shadow-xl shadow-pink-500/25 hover:shadow-pink-500/40 hover:scale-[1.02]"
            >
              🎬 אני יוצר/ת תוכן
            </Link>
            <Link
              href="/register?type=brand"
              className="inline-flex items-center justify-center px-8 py-4 rounded-full bg-neutral-900 text-white font-semibold text-lg hover:bg-neutral-800 transition-all shadow-xl shadow-neutral-900/15 hover:scale-[1.02]"
            >
              🏢 אני בעל/ת עסק
            </Link>
          </motion.div>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          className="absolute bottom-10 left-1/2 -translate-x-1/2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="w-6 h-10 rounded-full border-2 border-neutral-300 flex items-start justify-center p-1.5"
          >
            <div className="w-1.5 h-3 rounded-full bg-neutral-400" />
          </motion.div>
        </motion.div>
      </motion.section>

      {/* How It Works */}
      <section className="relative px-6 py-32 bg-white">
        <div className="max-w-5xl mx-auto">
          <FadeInSection>
            <div className="text-center mb-20">
              <span className="text-sm font-semibold text-pink-500 tracking-wide mb-4 block">
                איך זה עובד
              </span>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
                שלושה צעדים פשוטים
              </h2>
            </div>
          </FadeInSection>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: "01",
                title: "בחרו מוצר",
                desc: "גלו מוצרים מעניינים מעסקים מובילים ושלחו בקשת חיבור",
                icon: "🛍️",
                gradient: "from-pink-100 to-pink-50",
              },
              {
                step: "02",
                title: "צלמו סרטון",
                desc: "קבלו את המוצר חינם וצלמו סרטון UGC אותנטי תוך 10 ימים",
                icon: "🎬",
                gradient: "from-purple-100 to-purple-50",
              },
              {
                step: "03",
                title: "צמחו",
                desc: "צברו ניסיון, עלו ברמות, והפכו ליוצרי תוכן מבוקשים",
                icon: "🚀",
                gradient: "from-orange-100 to-orange-50",
              },
            ].map((item, i) => (
              <FadeInSection key={item.step} delay={i * 0.15}>
                <div className={`relative p-8 rounded-3xl bg-gradient-to-b ${item.gradient} border border-white/60 hover:shadow-lg transition-all duration-300 group`}>
                  <div className="text-5xl mb-6 group-hover:scale-110 transition-transform duration-300">
                    {item.icon}
                  </div>
                  <span className="inline-block text-xs font-bold text-pink-500 bg-pink-500/10 px-3 py-1 rounded-full mb-3">
                    {item.step}
                  </span>
                  <h3 className="text-2xl font-bold mb-3">{item.title}</h3>
                  <p className="text-neutral-500 leading-relaxed">{item.desc}</p>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* For Creators */}
      <section className="px-6 py-32 bg-[#F9F8F5]">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <FadeInSection>
              <div>
                <span className="text-sm font-semibold text-pink-500 tracking-wide mb-4 block">
                  ליוצרי תוכן
                </span>
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
                  הפכו את
                  <br />
                  <span className="text-pink-500">התשוקה למקצוע</span>
                </h2>
                <div className="space-y-4">
                  {[
                    { text: "קבלו מוצרים חינם מהמותגים המובילים", icon: "🎁" },
                    { text: "צלמו תוכן בסגנון שלכם, בקצב שלכם", icon: "📱" },
                    { text: "צמחו עם מערכת דירוגים ייחודית", icon: "⭐" },
                    { text: "בנו פורטפוליו מקצועי מרשים", icon: "💼" },
                  ].map((item) => (
                    <div key={item.text} className="flex items-start gap-4">
                      <span className="text-2xl shrink-0">{item.icon}</span>
                      <p className="text-neutral-600 text-lg">{item.text}</p>
                    </div>
                  ))}
                </div>
                <Link
                  href="/register?type=creator"
                  className="inline-flex items-center gap-2 mt-8 px-8 py-3.5 rounded-full bg-pink-500 text-white font-semibold hover:bg-pink-600 transition-all shadow-lg shadow-pink-500/20"
                >
                  הצטרפו כיוצרי תוכן
                  <span className="text-lg">←</span>
                </Link>
              </div>
            </FadeInSection>

            <FadeInSection delay={0.2}>
              <div className="relative">
                <div className="bg-gradient-to-br from-pink-100 via-pink-50 to-purple-50 rounded-3xl p-10 aspect-square flex items-center justify-center border border-pink-100/50">
                  <div className="text-center">
                    <div className="text-8xl mb-4">🎥</div>
                    <p className="text-lg text-neutral-500 font-medium">תוכן אותנטי = ערך אמיתי</p>
                  </div>
                </div>
                <div className="absolute -bottom-4 -left-4 bg-white rounded-2xl p-4 shadow-xl shadow-black/5 border border-neutral-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-lg">✅</div>
                    <div>
                      <p className="font-bold text-sm">מוצר התקבל!</p>
                      <p className="text-xs text-neutral-400">עכשיו אפשר לצלם</p>
                    </div>
                  </div>
                </div>
              </div>
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* Stats Banner */}
      <section className="relative px-6 py-20 bg-gradient-to-l from-pink-600 via-pink-500 to-pink-400 text-white overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-[300px] h-[300px] rounded-full bg-white/10 blur-[80px]" />
          <div className="absolute bottom-0 right-1/4 w-[200px] h-[200px] rounded-full bg-white/5 blur-[60px]" />
        </div>
        <div className="relative max-w-5xl mx-auto grid grid-cols-3 gap-8 text-center">
          {[
            { value: "500+", label: "יוצרי תוכן פעילים" },
            { value: "200+", label: "מותגים ועסקים" },
            { value: "2,000+", label: "סרטונים שנוצרו" },
          ].map((stat, i) => (
            <FadeInSection key={stat.label} delay={i * 0.1}>
              <div>
                <div className="text-4xl md:text-6xl font-extrabold tracking-tight mb-2">{stat.value}</div>
                <div className="text-pink-100 text-sm md:text-base font-medium">{stat.label}</div>
              </div>
            </FadeInSection>
          ))}
        </div>
      </section>

      {/* For Brands */}
      <section className="px-6 py-32 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <FadeInSection delay={0.2} className="order-2 md:order-1">
              <div className="relative">
                <div className="bg-gradient-to-br from-neutral-100 via-neutral-50 to-pink-50 rounded-3xl p-10 aspect-square flex items-center justify-center border border-neutral-100/50">
                  <div className="text-center">
                    <div className="text-8xl mb-4">📊</div>
                    <p className="text-lg text-neutral-500 font-medium">ROI שלא הכרתם</p>
                  </div>
                </div>
                <div className="absolute -top-4 -right-4 bg-white rounded-2xl p-4 shadow-xl shadow-black/5 border border-neutral-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center text-lg">🎯</div>
                    <div>
                      <p className="font-bold text-sm">3 סרטונים חדשים</p>
                      <p className="text-xs text-neutral-400">מוכנים לפרסום</p>
                    </div>
                  </div>
                </div>
              </div>
            </FadeInSection>

            <FadeInSection className="order-1 md:order-2">
              <div>
                <span className="text-sm font-semibold text-pink-500 tracking-wide mb-4 block">
                  למותגים ועסקים
                </span>
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
                  תוכן שעובד
                  <br />
                  <span className="text-pink-500">בלי הפקות יקרות</span>
                </h2>
                <div className="space-y-4">
                  {[
                    { text: "תוכן UGC אותנטי שמביא תוצאות", icon: "📈" },
                    { text: "מחירים שפויים — קרדיט אחד = סרטון אחד", icon: "💰" },
                    { text: "יוצרים מאומתים ומדורגים", icon: "🏆" },
                    { text: "ניהול קל דרך לוח בקרה חכם", icon: "🎛️" },
                  ].map((item) => (
                    <div key={item.text} className="flex items-start gap-4">
                      <span className="text-2xl shrink-0">{item.icon}</span>
                      <p className="text-neutral-600 text-lg">{item.text}</p>
                    </div>
                  ))}
                </div>
                <Link
                  href="/register?type=brand"
                  className="inline-flex items-center gap-2 mt-8 px-8 py-3.5 rounded-full bg-neutral-900 text-white font-semibold hover:bg-neutral-800 transition-all shadow-lg shadow-neutral-900/15"
                >
                  הצטרפו כמפרסמים
                  <span className="text-lg">←</span>
                </Link>
              </div>
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-32 bg-[#F9F8F5]">
        <FadeInSection>
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6">
              מוכנים
              <br />
              <span className="bg-gradient-to-l from-pink-600 via-pink-500 to-pink-400 bg-clip-text text-transparent">
                להתחיל?
              </span>
            </h2>
            <p className="text-lg text-neutral-500 mb-10 max-w-md mx-auto">
              הצטרפו לקהילת היוצרים והמותגים הגדלה. חינם לגמרי ליוצרי תוכן.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register?type=creator"
                className="inline-flex items-center justify-center px-10 py-4 rounded-full bg-pink-500 text-white font-semibold text-lg hover:bg-pink-600 transition-all shadow-xl shadow-pink-500/25 hover:scale-[1.02]"
              >
                הרשמה חינם
              </Link>
              <Link
                href="/register?type=brand"
                className="inline-flex items-center justify-center px-10 py-4 rounded-full border-2 border-neutral-200 text-neutral-700 font-semibold text-lg hover:bg-neutral-50 transition-all hover:scale-[1.02]"
              >
                אני מפרסם
              </Link>
            </div>
          </div>
        </FadeInSection>
      </section>

      {/* Footer */}
      <footer className="px-6 py-12 bg-neutral-900 text-white">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <p className="text-xl font-bold mb-1">
                <span className="text-pink-400">M</span>ashpianim
              </p>
              <p className="text-neutral-400 text-sm">הפלטפורמה ליוצרי תוכן ומותגים</p>
            </div>
            <div className="flex gap-6 text-sm text-neutral-400">
              <Link href="/terms" className="hover:text-pink-400 transition-colors">תנאי שימוש</Link>
              <Link href="/about" className="hover:text-pink-400 transition-colors">אודות</Link>
              <Link href="/login" className="hover:text-pink-400 transition-colors">התחברות</Link>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-neutral-800 text-center text-neutral-500 text-xs">
            &copy; {new Date().getFullYear()} Mashpianim. כל הזכויות שמורות.
          </div>
        </div>
      </footer>
    </main>
  );
}
