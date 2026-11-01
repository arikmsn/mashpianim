"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui";

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
    <main className="min-h-screen flex items-center justify-center px-6 bg-gradient-to-br from-pink-50 to-background py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Image src="/logo.png" alt="משפיען אונליין" width={72} height={72} className="mx-auto rounded-2xl shadow-lg shadow-ig-pink/20 mb-4" />
          <h1 className="text-3xl font-bold mb-2">הצטרפו אלינו</h1>
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
                  רוצה לקבל תוכן אותנטי מיוצרים עבור המוצרים שלי
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

const CATEGORIES = [
  "ביוטי וטיפוח",
  "אופנה",
  "מזון ומשקאות",
  "ניקיון ובית",
  "ילדים ותינוקות",
  "ספורט ובריאות",
  "טכנולוגיה",
  "חיות מחמד",
  "אחר",
];

function CreatorRegistration({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    dateOfBirth: "",
    city: "",
    tiktokHandle: "",
    instagramHandle: "",
    categories: [] as string[],
  });
  const router = useRouter();
  const { toast } = useToast();

  function updateForm(field: string, value: string | string[]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleCategory(cat: string) {
    setForm((prev) => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter((c) => c !== cat)
        : [...prev.categories, cat],
    }));
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      // First send OTP to verify phone
      const otpRes = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: form.phone }),
      });
      const otpData = await otpRes.json();
      if (!otpRes.ok) throw new Error(otpData.error);

      toast("קוד אימות נשלח בוואטסאפ! 💬", "success");
      setStep(5); // OTP verification step
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "שגיאה בשליחת קוד";
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyAndRegister(code: string) {
    setLoading(true);
    try {
      // Verify OTP
      const verifyRes = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: form.phone, code }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyData.error);

      // Register profile
      const registerRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: verifyData.userId,
          userType: "creator",
          profile: form,
        }),
      });
      const registerData = await registerRes.json();
      if (!registerRes.ok) throw new Error(registerData.error);

      toast("נרשמתם בהצלחה! 🎉", "success");
      if (verifyData.verificationUrl) {
        router.push(verifyData.verificationUrl);
      } else {
        router.push("/feed");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "שגיאה בהרשמה";
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg shadow-pink-500/5">
      <div className="flex items-center gap-2 mb-6">
        <button onClick={step === 1 ? onBack : () => setStep(step - 1)} className="text-neutral-400 hover:text-neutral-600">
          ←
        </button>
        <div className="flex-1 flex gap-1">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                s <= Math.min(step, 4) ? "bg-pink-500" : "bg-neutral-200"
              }`}
            />
          ))}
        </div>
        <span className="text-xs text-neutral-400">{Math.min(step, 4)}/4</span>
      </div>

      {step === 1 && (
        <div>
          <h3 className="font-bold mb-4">פרטים אישיים</h3>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="שם מלא"
              value={form.fullName}
              onChange={(e) => updateForm("fullName", e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none"
            />
            <input
              type="tel"
              dir="ltr"
              placeholder="05X-XXX-XXXX"
              value={form.phone}
              onChange={(e) => updateForm("phone", e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none text-center"
            />
            <input
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => updateForm("dateOfBirth", e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none"
            />
            <input
              type="text"
              placeholder="עיר מגורים"
              value={form.city}
              onChange={(e) => updateForm("city", e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none"
            />
          </div>
          <button
            onClick={() => setStep(2)}
            disabled={!form.fullName || !form.phone}
            className="w-full mt-4 px-6 py-3 rounded-xl bg-pink-500 text-white font-medium hover:bg-pink-600 transition-colors disabled:opacity-50"
          >
            המשך
          </button>
        </div>
      )}

      {step === 2 && (
        <div>
          <h3 className="font-bold mb-4">חיבור רשתות חברתיות</h3>
          <p className="text-sm text-neutral-500 mb-4">
            הפרטים האלה עוזרים לנו להתאים לך מוצרים — לא מוצגים לעסקים
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-neutral-500 mb-1">TikTok</label>
              <input
                type="text"
                dir="ltr"
                placeholder="@yourhandle"
                value={form.tiktokHandle}
                onChange={(e) => updateForm("tiktokHandle", e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-500 mb-1">Instagram</label>
              <input
                type="text"
                dir="ltr"
                placeholder="@yourhandle"
                value={form.instagramHandle}
                onChange={(e) => updateForm("instagramHandle", e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none"
              />
            </div>
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
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={`px-4 py-2 rounded-full border text-sm transition-all ${
                  form.categories.includes(cat)
                    ? "bg-pink-500 text-white border-pink-500"
                    : "border-neutral-200 hover:border-pink-500 hover:bg-pink-50"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <button
            onClick={() => setStep(4)}
            disabled={form.categories.length === 0}
            className="w-full mt-6 px-6 py-3 rounded-xl bg-pink-500 text-white font-medium hover:bg-pink-600 transition-colors disabled:opacity-50"
          >
            המשך
          </button>
        </div>
      )}

      {step === 4 && (
        <div>
          <h3 className="font-bold mb-4">סיכום 🎉</h3>
          <div className="space-y-2 mb-6 text-sm">
            <div className="flex justify-between py-2 border-b border-neutral-50">
              <span className="text-neutral-500">שם</span>
              <span className="font-medium">{form.fullName}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-neutral-50">
              <span className="text-neutral-500">טלפון</span>
              <span className="font-medium" dir="ltr">{form.phone}</span>
            </div>
            {form.city && (
              <div className="flex justify-between py-2 border-b border-neutral-50">
                <span className="text-neutral-500">עיר</span>
                <span className="font-medium">{form.city}</span>
              </div>
            )}
            {form.tiktokHandle && (
              <div className="flex justify-between py-2 border-b border-neutral-50">
                <span className="text-neutral-500">TikTok</span>
                <span className="font-medium" dir="ltr">{form.tiktokHandle}</span>
              </div>
            )}
            <div className="flex justify-between py-2">
              <span className="text-neutral-500">קטגוריות</span>
              <span className="font-medium">{form.categories.join(", ")}</span>
            </div>
          </div>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full px-6 py-3 rounded-xl bg-pink-500 text-white font-medium hover:bg-pink-600 transition-colors disabled:opacity-50"
          >
            {loading ? "שולח קוד אימות..." : "אימות והרשמה"}
          </button>
        </div>
      )}

      {step === 5 && (
        <OTPStep
          phone={form.phone}
          loading={loading}
          onVerify={handleVerifyAndRegister}
          onBack={() => setStep(4)}
        />
      )}
    </div>
  );
}

function BrandRegistration({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    shopName: "",
    category: "",
    websiteUrl: "",
  });
  const router = useRouter();
  const { toast } = useToast();

  function updateForm(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      const otpRes = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: form.phone }),
      });
      const otpData = await otpRes.json();
      if (!otpRes.ok) throw new Error(otpData.error);

      toast("קוד אימות נשלח בוואטסאפ! 💬", "success");
      setStep(4);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "שגיאה בשליחת קוד";
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyAndRegister(code: string) {
    setLoading(true);
    try {
      const verifyRes = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: form.phone, code }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyData.error);

      const registerRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: verifyData.userId,
          userType: "brand",
          profile: form,
        }),
      });
      const registerData = await registerRes.json();
      if (!registerRes.ok) throw new Error(registerData.error);

      toast("נרשמתם בהצלחה! 🎉", "success");
      if (verifyData.verificationUrl) {
        router.push(verifyData.verificationUrl);
      } else {
        router.push("/feed");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "שגיאה בהרשמה";
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg shadow-pink-500/5">
      <div className="flex items-center gap-2 mb-6">
        <button onClick={step === 1 ? onBack : () => setStep(step - 1)} className="text-neutral-400 hover:text-neutral-600">
          ←
        </button>
        <div className="flex-1 flex gap-1">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                s <= Math.min(step, 3) ? "bg-pink-500" : "bg-neutral-200"
              }`}
            />
          ))}
        </div>
        <span className="text-xs text-neutral-400">{Math.min(step, 3)}/3</span>
      </div>

      {step === 1 && (
        <div>
          <h3 className="font-bold mb-4">פרטי העסק</h3>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="שם מלא (איש קשר)"
              value={form.fullName}
              onChange={(e) => updateForm("fullName", e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none"
            />
            <input
              type="text"
              placeholder="שם החנות / המותג"
              value={form.shopName}
              onChange={(e) => updateForm("shopName", e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none"
            />
            <input
              type="tel"
              dir="ltr"
              placeholder="מספר טלפון"
              value={form.phone}
              onChange={(e) => updateForm("phone", e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none text-center"
            />
            <select
              value={form.category}
              onChange={(e) => updateForm("category", e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none bg-white"
            >
              <option value="">קטגוריה</option>
              {CATEGORIES.map((cat) => (
                <option key={cat}>{cat}</option>
              ))}
            </select>
            <input
              type="url"
              dir="ltr"
              placeholder="כתובת האתר (URL)"
              value={form.websiteUrl}
              onChange={(e) => updateForm("websiteUrl", e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none"
            />
          </div>
          <button
            onClick={() => setStep(2)}
            disabled={!form.shopName || !form.phone || !form.fullName}
            className="w-full mt-4 px-6 py-3 rounded-xl bg-pink-500 text-white font-medium hover:bg-pink-600 transition-colors disabled:opacity-50"
          >
            המשך
          </button>
        </div>
      )}

      {step === 2 && (
        <div>
          <h3 className="font-bold mb-4">בחרו חבילת קרדיטים</h3>
          <p className="text-sm text-neutral-500 mb-4">
            כל קרדיט = סרטון UGC אחד. אפשר גם לרכוש אחר כך
          </p>
          <div className="space-y-3">
            {[
              { name: "ניסיון", videos: 1, price: 100, perVideo: 100 },
              { name: "בסיסי", videos: 5, price: 375, perVideo: 75 },
              { name: "הכי פופולרי", videos: 12, price: 720, perVideo: 60, popular: true },
              { name: "הכי משתלם", videos: 25, price: 1250, perVideo: 50, best: true },
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
                        פופולרי
                      </span>
                    )}
                    {pkg.best && (
                      <span className="text-xs bg-foreground text-background px-2 py-0.5 rounded-full">
                        משתלם
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-neutral-500">₪{pkg.perVideo} לסרטון</div>
                </div>
                <div className="text-lg font-bold">₪{pkg.price}</div>
              </button>
            ))}
          </div>
          <button
            onClick={() => setStep(3)}
            className="w-full mt-4 px-6 py-3 rounded-xl bg-pink-500 text-white font-medium hover:bg-pink-600 transition-colors"
          >
            המשך
          </button>
          <button
            onClick={() => setStep(3)}
            className="w-full mt-2 text-sm text-neutral-400 hover:text-neutral-600"
          >
            דלגו — אקנה קרדיטים אחר כך
          </button>
        </div>
      )}

      {step === 3 && (
        <div>
          <h3 className="font-bold mb-4">סיכום 🏪</h3>
          <div className="space-y-2 mb-6 text-sm">
            <div className="flex justify-between py-2 border-b border-neutral-50">
              <span className="text-neutral-500">שם מותג</span>
              <span className="font-medium">{form.shopName}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-neutral-50">
              <span className="text-neutral-500">איש קשר</span>
              <span className="font-medium">{form.fullName}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-neutral-50">
              <span className="text-neutral-500">טלפון</span>
              <span className="font-medium" dir="ltr">{form.phone}</span>
            </div>
            {form.category && (
              <div className="flex justify-between py-2 border-b border-neutral-50">
                <span className="text-neutral-500">קטגוריה</span>
                <span className="font-medium">{form.category}</span>
              </div>
            )}
            {form.websiteUrl && (
              <div className="flex justify-between py-2">
                <span className="text-neutral-500">אתר</span>
                <span className="font-medium" dir="ltr">{form.websiteUrl}</span>
              </div>
            )}
          </div>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full px-6 py-3 rounded-xl bg-pink-500 text-white font-medium hover:bg-pink-600 transition-colors disabled:opacity-50"
          >
            {loading ? "שולח קוד אימות..." : "אימות והרשמה"}
          </button>
        </div>
      )}

      {step === 4 && (
        <OTPStep
          phone={form.phone}
          loading={loading}
          onVerify={handleVerifyAndRegister}
          onBack={() => setStep(3)}
        />
      )}
    </div>
  );
}

function OTPStep({
  phone,
  loading,
  onVerify,
  onBack,
}: {
  phone: string;
  loading: boolean;
  onVerify: (code: string) => void;
  onBack: () => void;
}) {
  const [code, setCode] = useState("");

  return (
    <div>
      <div className="text-center mb-4">
        <span className="text-3xl">💬</span>
        <p className="text-sm text-neutral-500 mt-2">שלחנו קוד אימות בוואטסאפ</p>
        <p className="font-mono text-sm font-medium" dir="ltr">{phone}</p>
      </div>
      <input
        type="text"
        dir="ltr"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        placeholder="000000"
        maxLength={6}
        className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none transition-all text-center text-2xl tracking-[0.5em]"
      />
      <button
        onClick={() => onVerify(code)}
        disabled={loading || code.length < 6}
        className="w-full mt-4 px-6 py-3 rounded-xl bg-pink-500 text-white font-medium hover:bg-pink-600 transition-colors disabled:opacity-50"
      >
        {loading ? "מאמת..." : "אישור והרשמה"}
      </button>
      <button
        onClick={onBack}
        className="w-full mt-2 text-sm text-neutral-400 hover:text-neutral-600"
      >
        חזרה
      </button>
    </div>
  );
}
