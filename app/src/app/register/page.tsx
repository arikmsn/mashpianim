"use client";

import { Suspense, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

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
  const verifiedUserId = searchParams.get("userId");
  const verifiedPhone = searchParams.get("phone");
  const isPreVerified = searchParams.get("verified") === "1" && !!verifiedUserId;
  const [userType, setUserType] = useState<UserType>(initialType);
  const router = useRouter();

  useEffect(() => {
    if (isPreVerified && verifiedUserId && !initialType) {
      fetch(`/api/auth/user-type?userId=${verifiedUserId}`)
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          if (data?.userType) {
            router.push(data.userType === "brand" ? "/brand" : "/feed");
          }
        })
        .catch(() => {});
    }
  }, [isPreVerified, verifiedUserId, initialType, router]);

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-gradient-to-br from-pink-50 to-background py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Image src="/logo.png" alt="משפיען אונליין" width={72} height={72} unoptimized className="mx-auto rounded-2xl shadow-lg shadow-ig-pink/20 mb-4" />
          <h1 className="text-3xl font-bold mb-2">הצטרפו אלינו</h1>
          {!userType && <p className="text-neutral-500">בואו נתחיל — מי אתם?</p>}
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
              <CreatorRegistration onBack={() => setUserType(null)} preVerifiedUserId={verifiedUserId} preVerifiedPhone={verifiedPhone} />
            </motion.div>
          ) : (
            <motion.div
              key="brand-form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <BrandRegistration onBack={() => setUserType(null)} preVerifiedUserId={verifiedUserId} preVerifiedPhone={verifiedPhone} />
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-center mt-6 text-sm text-neutral-400">
          כבר יש לכם חשבון?{" "}
          <Link href="/login" className="text-pink-500 font-medium hover:underline">
            התחברו כאן
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

function CreatorRegistration({ onBack, preVerifiedUserId, preVerifiedPhone }: { onBack: () => void; preVerifiedUserId?: string | null; preVerifiedPhone?: string | null }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    phone: preVerifiedPhone || "",
    city: "",
    tiktokHandle: "",
    instagramHandle: "",
    categories: [] as string[],
    ageConfirmed: false,
  });
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();

  function updateForm(field: string, value: string | string[] | boolean) {
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
    if (preVerifiedUserId) {
      await registerProfile(preVerifiedUserId);
      return;
    }
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
      setStep(5);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "שגיאה בשליחת קוד";
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  async function registerProfile(userId: string) {
    setLoading(true);
    try {
      const registerRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          userType: "creator",
          profile: form,
        }),
      });
      const registerData = await registerRes.json();
      if (!registerRes.ok) throw new Error(registerData.error);

      toast("נרשמתם בהצלחה! 🎉", "success");
      router.push("/feed");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "שגיאה בהרשמה";
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

      // Create session
      if (verifyData.email && verifyData.tempPassword) {
        await supabase.auth.signInWithPassword({ email: verifyData.email, password: verifyData.tempPassword });
      }

      await registerProfile(verifyData.userId);
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
              autoFocus
            />
            <input
              type="tel"
              dir="ltr"
              placeholder="05X-XXX-XXXX"
              value={form.phone}
              onChange={(e) => updateForm("phone", e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none text-center"
              disabled={!!preVerifiedPhone}
            />
            <input
              type="text"
              placeholder="עיר מגורים"
              value={form.city}
              onChange={(e) => updateForm("city", e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none"
            />
            <label className="flex items-center gap-3 cursor-pointer py-2">
              <input
                type="checkbox"
                checked={form.ageConfirmed}
                onChange={(e) => updateForm("ageConfirmed", e.target.checked)}
                className="w-5 h-5 rounded border-neutral-300 text-pink-500 focus:ring-pink-500/20 accent-pink-500"
              />
              <span className="text-sm text-neutral-600">אני מאשר/ת שגילי מעל 18</span>
            </label>
          </div>
          <button
            onClick={() => setStep(2)}
            disabled={!form.fullName || !form.phone || !form.ageConfirmed}
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
            {loading ? "רושם..." : preVerifiedUserId ? "סיום הרשמה" : "אימות והרשמה"}
          </button>
        </div>
      )}

      {step === 5 && !preVerifiedUserId && (
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

function BrandRegistration({ onBack, preVerifiedUserId, preVerifiedPhone }: { onBack: () => void; preVerifiedUserId?: string | null; preVerifiedPhone?: string | null }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [customCategory, setCustomCategory] = useState("");
  const [form, setForm] = useState({
    fullName: "",
    phone: preVerifiedPhone || "",
    shopName: "",
    category: "",
    websiteUrl: "",
  });
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();

  function updateForm(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit() {
    if (preVerifiedUserId) {
      await registerProfile(preVerifiedUserId);
      return;
    }
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
      setStep(3);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "שגיאה בשליחת קוד";
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  async function registerProfile(userId: string) {
    setLoading(true);
    try {
      const registerRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          userType: "brand",
          profile: form,
        }),
      });
      const registerData = await registerRes.json();
      if (!registerRes.ok) throw new Error(registerData.error);

      toast("נרשמתם בהצלחה! 🎉", "success");
      router.push("/brand");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "שגיאה בהרשמה";
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

      if (verifyData.email && verifyData.tempPassword) {
        await supabase.auth.signInWithPassword({ email: verifyData.email, password: verifyData.tempPassword });
      }

      await registerProfile(verifyData.userId);
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
          {[1, 2].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                s <= Math.min(step, 2) ? "bg-pink-500" : "bg-neutral-200"
              }`}
            />
          ))}
        </div>
        <span className="text-xs text-neutral-400">{Math.min(step, 2)}/2</span>
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
              autoFocus
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
            <div>
              <label className="block text-sm text-neutral-500 mb-2">קטגוריה</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => updateForm("category", form.category === cat ? "" : cat)}
                    className={`px-3 py-1.5 rounded-full border text-sm transition-all ${
                      form.category === cat
                        ? "bg-pink-500 text-white border-pink-500"
                        : "border-neutral-200 hover:border-pink-500 hover:bg-pink-50"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
                {form.category && !CATEGORIES.includes(form.category) && (
                  <span className="px-3 py-1.5 rounded-full bg-pink-500 text-white text-sm flex items-center gap-1">
                    {form.category}
                    <button type="button" onClick={() => updateForm("category", "")} className="mr-1 text-white/80 hover:text-white">✕</button>
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="או הקלידו קטגוריה..."
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customCategory.trim()) {
                      updateForm("category", customCategory.trim());
                      setCustomCategory("");
                    }
                  }}
                  className="flex-1 px-3 py-2 rounded-xl border border-neutral-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none text-sm"
                />
                {customCategory.trim() && (
                  <button
                    type="button"
                    onClick={() => { updateForm("category", customCategory.trim()); setCustomCategory(""); }}
                    className="px-3 py-2 rounded-xl bg-pink-500 text-white text-sm font-medium"
                  >
                    הוסף
                  </button>
                )}
              </div>
            </div>
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
            {loading ? "שולח..." : preVerifiedUserId ? "סיום הרשמה" : "אימות והרשמה"}
          </button>
        </div>
      )}

      {step === 3 && !preVerifiedUserId && (
        <OTPStep
          phone={form.phone}
          loading={loading}
          onVerify={handleVerifyAndRegister}
          onBack={() => setStep(2)}
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
        autoFocus
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
