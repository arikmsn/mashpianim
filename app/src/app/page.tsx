"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Hero */}
      <section className="relative flex items-center justify-center overflow-hidden px-6 py-24 min-h-[85vh]">
        <div className="absolute inset-0 bg-gradient-to-br from-pink-100 via-pink-50 to-background" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-pink-300/30 blur-[120px]" />

        <div className="relative z-10 text-center max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-block px-4 py-1.5 rounded-full bg-pink-500/10 text-pink-600 text-sm font-medium mb-6">
              הפלטפורמה ליוצרי תוכן ומותגים
            </span>
          </motion.div>

          <motion.h1
            className="text-4xl md:text-6xl font-bold leading-tight mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            יוצרים תוכן.
            <br />
            <span className="text-pink-500">מחברים מותגים.</span>
          </motion.h1>

          <motion.p
            className="text-lg text-neutral-500 mb-10 max-w-md mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            קבלו מוצרים חינם, צלמו סרטונים אותנטיים, וצמחו כיוצרי תוכן.
            עסקים — קבלו תוכן UGC איכותי במחיר שפוי.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <Link
              href="/register?type=creator"
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-full bg-pink-500 text-white font-medium hover:bg-pink-600 transition-colors shadow-lg shadow-pink-500/25"
            >
              אני יוצר/ת תוכן
            </Link>
            <Link
              href="/register?type=brand"
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-full bg-foreground text-background font-medium hover:opacity-90 transition-opacity"
            >
              אני בעל/ת עסק
            </Link>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-20 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-16">איך זה עובד?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "01", title: "בחרו מוצר", desc: "גלו מוצרים מעניינים מעסקים מובילים ושלחו בקשת חיבור", icon: "🛍️" },
              { step: "02", title: "צלמו סרטון", desc: "קבלו את המוצר חינם וצלמו סרטון UGC אותנטי תוך 10 ימים", icon: "🎬" },
              { step: "03", title: "צמחו", desc: "צברו ניסיון, עלו ברמות, והפכו ליוצרי תוכן מבוקשים", icon: "🚀" },
            ].map((item) => (
              <div key={item.step} className="text-center p-6 rounded-2xl hover:bg-pink-50/50 transition-colors">
                <div className="text-4xl mb-4">{item.icon}</div>
                <div className="text-xs font-bold text-pink-500 mb-2">{item.step}</div>
                <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                <p className="text-neutral-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="px-6 py-16 bg-gradient-to-r from-pink-500 to-pink-600 text-white">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-8 text-center">
          {[
            { value: "500+", label: "יוצרי תוכן" },
            { value: "200+", label: "מותגים" },
            { value: "2,000+", label: "סרטונים" },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-3xl md:text-4xl font-bold">{stat.value}</div>
              <div className="text-pink-100 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 text-center text-neutral-400 text-sm">
        <p>&copy; 2026 Mashpianim. כל הזכויות שמורות.</p>
        <div className="flex gap-4 justify-center mt-3">
          <Link href="/terms" className="hover:text-pink-500 transition-colors">תנאי שימוש</Link>
          <Link href="/about" className="hover:text-pink-500 transition-colors">אודות</Link>
        </div>
      </footer>
    </main>
  );
}
