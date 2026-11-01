"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

type UserType = "creator" | "brand" | null;

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterContent />
    </Suspense>
  );
}

function RegisterContent() {
  const searchParams = useSearchParams();
  const initialType = searchParams.get("type") as UserType;
  const [userType, setUserType] = useState<UserType>(initialType);

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-gradient-to-br from-pink-50 to-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">הצטרפו אלינו ✨</h1>
          <p className="text-neutral-500">בואו נתחיל — מי אתם?</p>
        </div>

        <AnimatePresence mode="wait">
          {!userType ? (
            <motion.div
              key="type-select"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid gap-4"
            >
              <button
                onClick={() => setUserType("creator")}
                className="group bg-white rounded-2xl p-6 shadow-lg shadow-pink-500/5 text-right hover:ring-2 hover:ring-pink-500 transition-all"
              >
                <div className="text-3xl mb-3">🎬</div>
                <h3 className="text-lg font-bold mb-1">אני יוצר/ת תוכן</h3>
                <p className="text-sm text-neutral-500">
                  רוצה לקבל מוצרים חינם ולצלם סרטוני UGC
                </p>
              </button>

              <button
                onClick={() => setUserType("brand")}
                className="group bg-white rounded-2xl p-6 shadow-lg shadow-pink-500/5 text-right hover:ring-2 hover:ring-pink-500 transition-all"
              >
                <div className="text-3xl mb-3">🏪</div>
                <h3 className="text-lg font-bold mb-1">אני בעל/ת עסק</h3>
                <p className="text-sm text-neutral-500">
                  רוצה לקבל תוכן אותנטי ליוצרים עבור המוצרים שלי
                </p>
              </button>
            </motion.div>
          ) : userType === "creator" ? (
            <motion.div
              key="creator-form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <CreatorRegistration onBack={() => setUserType(null)} />
            </motion.div>
          ) : (
            <motion.div
              key="brand-form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <BrandRegistration onBack={() => setUserType(null)} />
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-center mt-6 text-sm text-neutral-400">
          כבר יש לכם חשבון?{" "}
          <Link href="/login" className="text-pink-500 font-medium hover:underline">
            התחברו
          </Link>
        </p>
      </div>
    </main>
  );
}

function CreatorRegistration({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState(1);

  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg shadow-pink-500/5">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-6">
        <button onClick={onBack} className="text-neutral-400 hover:text-neutral-600">
          ←
        </button>
        <div className="flex-1 flex gap-1">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                s <= step ? "bg-pink-500" : "bg-neutral-200"
              }`}
            />
          ))}
        </div>
        <span className="text-xs text-neutral-400">{step}/4</span>
      </div>

      {step === 1 && (
        <div>
          <h3 className="font-bold mb-4">פרטים אישיים</h3>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="שם מלא"
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none"
            />
            <input
              type="tel"
              dir="ltr"
              placeholder="מספר טלפון"
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none text-center"
            />
            <input
              type="date"
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none"
            />
            <input
              type="text"
              placeholder="עיר מגורים"
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none"
            />
          </div>
          <button
            onClick={() => setStep(2)}
            className="w-full mt-4 px-6 py-3 rounded-xl bg-pink-500 text-white font-medium hover:bg-pink-600 transition-colors"
          >
            המשך
          </button>
        </div>
      )}

      {step === 2 && (
        <div>
          <h3 className="font-bold mb-4">חיבור רשתות חברתיות</h3>
          <p className="text-sm text-neutral-500 mb-4">
            נשתמש בזה רק כדי להבין את הפרופיל שלך — הפרטים לא מוצגים לעסקים
          </p>
          <div className="space-y-3">
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-neutral-200 hover:border-pink-500 transition-colors">
              <span className="text-xl">📱</span>
              <span className="font-medium">חברו TikTok</span>
              <span className="mr-auto text-xs text-pink-500">חובה</span>
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-neutral-200 hover:border-pink-500 transition-colors">
              <span className="text-xl">📸</span>
              <span className="font-medium">חברו Instagram</span>
              <span className="mr-auto text-xs text-neutral-400">אופציונלי</span>
            </button>
          </div>
          <button
            onClick={() => setStep(3)}
            className="w-full mt-4 px-6 py-3 rounded-xl bg-pink-500 text-white font-medium hover:bg-pink-600 transition-colors"
          >
            המשך
          </button>
        </div>
      )}

      {step === 3 && (
        <div>
          <h3 className="font-bold mb-4">בחרו קטגוריות</h3>
          <p className="text-sm text-neutral-500 mb-4">
            באיזה סוגי מוצרים הייתם רוצים ליצור תוכן?
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              "ביוטי וטיפוח",
              "אופנה",
              "מזון ומשקאות",
              "ניקיון ובית",
              "ילדים ותינוקות",
              "ספורט ובריאות",
              "טכנולוגיה",
              "חיות מחמד",
              "אחר",
            ].map((cat) => (
              <button
                key={cat}
                className="px-4 py-2 rounded-full border border-neutral-200 text-sm hover:border-pink-500 hover:bg-pink-50 transition-all data-[selected=true]:bg-pink-500 data-[selected=true]:text-white data-[selected=true]:border-pink-500"
              >
                {cat}
              </button>
            ))}
          </div>
          <button
            onClick={() => setStep(4)}
            className="w-full mt-6 px-6 py-3 rounded-xl bg-pink-500 text-white font-medium hover:bg-pink-600 transition-colors"
          >
            המשך
          </button>
        </div>
      )}

      {step === 4 && (
        <div>
          <h3 className="font-bold mb-4">סרטון הכרות</h3>
          <p className="text-sm text-neutral-500 mb-4">
            צלמו סרטון קצר (15-60 שניות) שמציג אתכם — זה מה שהעסקים יראו
          </p>
          <div className="aspect-[9/16] max-h-64 mx-auto bg-neutral-100 rounded-2xl flex items-center justify-center border-2 border-dashed border-neutral-300">
            <div className="text-center">
              <div className="text-4xl mb-2">📹</div>
              <p className="text-sm text-neutral-400">לחצו להעלאת סרטון</p>
            </div>
          </div>
          <button className="w-full mt-4 px-6 py-3 rounded-xl bg-pink-500 text-white font-medium hover:bg-pink-600 transition-colors">
            סיימתי — בואו נתחיל!
          </button>
          <button
            onClick={() => setStep(3)}
            className="w-full mt-2 text-sm text-neutral-400 hover:text-neutral-600"
          >
            חזרה
          </button>
        </div>
      )}
    </div>
  );
}

function BrandRegistration({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState(1);

  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg shadow-pink-500/5">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-6">
        <button onClick={onBack} className="text-neutral-400 hover:text-neutral-600">
          ←
        </button>
        <div className="flex-1 flex gap-1">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                s <= step ? "bg-pink-500" : "bg-neutral-200"
              }`}
            />
          ))}
        </div>
        <span className="text-xs text-neutral-400">{step}/3</span>
      </div>

      {step === 1 && (
        <div>
          <h3 className="font-bold mb-4">פרטי העסק</h3>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="שם החנות / המותג"
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none"
            />
            <input
              type="tel"
              dir="ltr"
              placeholder="מספר טלפון"
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none text-center"
            />
            <select className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none bg-white">
              <option value="">קטגוריה</option>
              <option>ביוטי וטיפוח</option>
              <option>אופנה</option>
              <option>מזון ומשקאות</option>
              <option>ניקיון ובית</option>
              <option>ילדים ותינוקות</option>
              <option>ספורט ובריאות</option>
              <option>טכנולוגיה</option>
              <option>חיות מחמד</option>
              <option>אחר</option>
            </select>
            <input
              type="url"
              dir="ltr"
              placeholder="כתובת האתר (URL)"
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none"
            />
          </div>
          <button
            onClick={() => setStep(2)}
            className="w-full mt-4 px-6 py-3 rounded-xl bg-pink-500 text-white font-medium hover:bg-pink-600 transition-colors"
          >
            המשך
          </button>
        </div>
      )}

      {step === 2 && (
        <div>
          <h3 className="font-bold mb-4">הוסיפו מוצר ראשון</h3>
          <p className="text-sm text-neutral-500 mb-4">
            הדביקו קישור למוצר — נשלוף את הפרטים אוטומטית
          </p>
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="url"
                dir="ltr"
                placeholder="https://your-store.com/product"
                className="flex-1 px-4 py-3 rounded-xl border border-neutral-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none"
              />
              <button className="px-4 py-3 rounded-xl bg-pink-500 text-white hover:bg-pink-600 transition-colors">
                ייבא
              </button>
            </div>
            <div className="p-4 bg-neutral-50 rounded-xl text-center text-sm text-neutral-400">
              המוצר יופיע כאן אחרי הייבוא
            </div>
          </div>
          <button
            onClick={() => setStep(3)}
            className="w-full mt-4 px-6 py-3 rounded-xl bg-pink-500 text-white font-medium hover:bg-pink-600 transition-colors"
          >
            המשך
          </button>
          <button className="w-full mt-2 text-sm text-neutral-400 hover:text-neutral-600">
            דלגו — אוסיף מוצר אחר כך
          </button>
        </div>
      )}

      {step === 3 && (
        <div>
          <h3 className="font-bold mb-4">בחרו חבילת קרדיטים</h3>
          <p className="text-sm text-neutral-500 mb-4">
            כל קרדיט = סרטון UGC אחד. הנחת 15% לרכישה ראשונה!
          </p>
          <div className="space-y-3">
            {[
              { name: "Starter", videos: 1, price: 100, perVideo: 100 },
              { name: "Basic", videos: 5, price: 375, perVideo: 75 },
              { name: "Popular", videos: 12, price: 720, perVideo: 60, popular: true },
              { name: "Best Value", videos: 25, price: 1250, perVideo: 50, best: true },
            ].map((pkg) => (
              <button
                key={pkg.name}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-right transition-all hover:border-pink-500 ${
                  pkg.popular ? "border-pink-500 bg-pink-50" : "border-neutral-200"
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{pkg.videos} סרטונים</span>
                    {pkg.popular && (
                      <span className="text-xs bg-pink-500 text-white px-2 py-0.5 rounded-full">
                        הכי פופולרי
                      </span>
                    )}
                    {pkg.best && (
                      <span className="text-xs bg-foreground text-background px-2 py-0.5 rounded-full">
                        הכי משתלם
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-neutral-500">
                    ₪{pkg.perVideo} לסרטון
                  </div>
                </div>
                <div className="text-lg font-bold">₪{pkg.price}</div>
              </button>
            ))}
          </div>
          <button className="w-full mt-4 px-6 py-3 rounded-xl bg-pink-500 text-white font-medium hover:bg-pink-600 transition-colors">
            לתשלום — בואו נתחיל!
          </button>
          <button className="w-full mt-2 text-sm text-neutral-400 hover:text-neutral-600">
            דלגו — אקנה קרדיטים אחר כך
          </button>
        </div>
      )}
    </div>
  );
}
