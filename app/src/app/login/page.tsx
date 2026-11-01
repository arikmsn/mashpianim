"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [step, setStep] = useState<"phone" | "otp" | "email" | "admin-login" | "admin-roles">("phone");
  const [loading, setLoading] = useState(false);
  const [formattedPhone, setFormattedPhone] = useState("");
  const [tapCount, setTapCount] = useState(0);
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/feed";
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();

  async function handleSendOTP(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFormattedPhone(data.phone);
      setStep("otp");
      toast("קוד אימות נשלח בוואטסאפ!", "success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "שגיאה בשליחת הקוד";
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOTP(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formattedPhone, code: otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.verificationUrl) {
        router.push(data.verificationUrl);
      } else if (data.needsOnboarding) {
        router.push("/register");
      } else {
        toast("התחברתם בהצלחה!", "success");
        router.push(redirect);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "קוד שגוי";
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast("התחברתם בהצלחה!", "success");
      router.push(redirect);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "שגיאה בהתחברות";
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdminVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/dev-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: adminPhone, password: adminPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.step === "choose_role") {
        setStep("admin-roles");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "שגיאה";
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdminRoleLogin(role: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/dev-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: adminPhone, password: adminPassword, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.verificationUrl) {
        router.push(data.verificationUrl);
      } else if (data.loginMethod === "email") {
        const { error } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: adminPassword,
        });
        if (error) throw error;
        router.push(role === "admin" ? "/admin" : "/feed");
      }
      const roleLabel = role === "admin" ? "מנהל" : role === "creator" ? "יוצר תוכן" : "מפרסם";
      toast(`נכנסתם כ${roleLabel}`, "success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "שגיאה";
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?redirect=${redirect}` },
    });
    if (error) toast(error.message, "error");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-gradient-to-br from-pink-50 to-background">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">שלום!</h1>
          <p className="text-neutral-500">התחברו לחשבון שלכם</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg shadow-pink-500/5">
          {step === "phone" && (
            <form onSubmit={handleSendOTP}>
              <label className="block text-sm font-medium mb-2">מספר טלפון</label>
              <input
                type="tel"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05X-XXX-XXXX"
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none transition-all text-center text-lg"
                required
              />
              <p className="text-xs text-neutral-400 mt-2 text-center">נשלח קוד אימות בוואטסאפ</p>
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-4 px-6 py-3 rounded-xl bg-pink-500 text-white font-medium hover:bg-pink-600 transition-colors disabled:opacity-50"
              >
                {loading ? "שולח..." : "שלחו לי קוד"}
              </button>
              <button type="button" onClick={() => setStep("email")} className="w-full mt-2 text-sm text-neutral-400 hover:text-neutral-600">
                התחברות עם אימייל
              </button>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={handleVerifyOTP}>
              <div className="text-center mb-4">
                <p className="text-sm text-neutral-500 mt-2">שלחנו קוד בוואטסאפ ל-</p>
                <p className="font-mono text-sm font-medium" dir="ltr">{formattedPhone}</p>
              </div>
              <input
                type="text"
                dir="ltr"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                maxLength={6}
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none transition-all text-center text-2xl tracking-[0.5em]"
                required
              />
              <button
                type="submit"
                disabled={loading || otp.length < 6}
                className="w-full mt-4 px-6 py-3 rounded-xl bg-pink-500 text-white font-medium hover:bg-pink-600 transition-colors disabled:opacity-50"
              >
                {loading ? "מאמת..." : "אישור"}
              </button>
              <button type="button" onClick={() => { setStep("phone"); setOtp(""); }} className="w-full mt-2 text-sm text-neutral-400 hover:text-neutral-600">
                שנו מספר טלפון
              </button>
            </form>
          )}

          {step === "email" && (
            <form onSubmit={handleEmailLogin}>
              <label className="block text-sm font-medium mb-2">אימייל</label>
              <input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com"
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none transition-all text-center" required />
              <label className="block text-sm font-medium mb-2 mt-3">סיסמה</label>
              <input type="password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none transition-all text-center" required />
              <button type="submit" disabled={loading}
                className="w-full mt-4 px-6 py-3 rounded-xl bg-pink-500 text-white font-medium hover:bg-pink-600 transition-colors disabled:opacity-50">
                {loading ? "מתחבר..." : "התחברות"}
              </button>
              <button type="button" onClick={() => setStep("phone")} className="w-full mt-2 text-sm text-neutral-400 hover:text-neutral-600">
                התחברות עם טלפון
              </button>
            </form>
          )}

          {step === "admin-login" && (
            <form onSubmit={handleAdminVerify}>
              <div className="text-center mb-4">
                <p className="text-sm font-medium">כניסת מנהל</p>
              </div>
              <label className="block text-sm font-medium mb-2">מספר טלפון</label>
              <input
                type="tel"
                dir="ltr"
                value={adminPhone}
                onChange={(e) => setAdminPhone(e.target.value)}
                placeholder="05X-XXX-XXXX"
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none transition-all text-center mb-3"
              />
              <label className="block text-sm font-medium mb-2">סיסמה</label>
              <input
                type="password"
                dir="ltr"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="••••••"
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none transition-all text-center"
              />
              <button
                type="submit"
                disabled={loading || !adminPhone || !adminPassword}
                className="w-full mt-4 px-6 py-3 rounded-xl bg-pink-500 text-white font-medium hover:bg-pink-600 transition-colors disabled:opacity-50"
              >
                {loading ? "מאמת..." : "המשך"}
              </button>
              <button type="button" onClick={() => setStep("phone")} className="w-full mt-3 text-sm text-neutral-400 hover:text-neutral-600">
                חזרה להתחברות רגילה
              </button>
            </form>
          )}

          {step === "admin-roles" && (
            <div>
              <div className="text-center mb-5">
                <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="font-semibold text-neutral-900">אומתת בהצלחה</p>
                <p className="text-sm text-neutral-400 mt-1">בחרו ממשק כניסה</p>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleAdminRoleLogin("admin")}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-neutral-200 hover:bg-pink-50 hover:border-pink-200 transition-colors text-right disabled:opacity-50"
                >
                  <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-pink-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">ממשק מנהל</p>
                    <p className="text-xs text-neutral-400">דשבורד, מודרציה, הגדרות</p>
                  </div>
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleAdminRoleLogin("creator")}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-neutral-200 hover:bg-pink-50 hover:border-pink-200 transition-colors text-right disabled:opacity-50"
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">ממשק יוצר תוכן</p>
                    <p className="text-xs text-neutral-400">פיד, פרופיל, חיבורים</p>
                  </div>
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleAdminRoleLogin("brand")}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-neutral-200 hover:bg-pink-50 hover:border-pink-200 transition-colors text-right disabled:opacity-50"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">ממשק מפרסם</p>
                    <p className="text-xs text-neutral-400">קמפיינים, יוצרים, קרדיטים</p>
                  </div>
                </button>
              </div>
              <button type="button" onClick={() => { setStep("phone"); setAdminPhone(""); setAdminPassword(""); }}
                className="w-full mt-4 text-sm text-neutral-400 hover:text-neutral-600">
                חזרה להתחברות רגילה
              </button>
            </div>
          )}

          {step !== "admin-login" && step !== "admin-roles" && (
            <div className="mt-6 pt-6 border-t border-neutral-100">
              <p className="text-center text-sm text-neutral-400 mb-4">או התחברו עם</p>
              <button
                onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 hover:bg-neutral-50 transition-colors text-sm"
              >
                <span>Google</span>
              </button>
            </div>
          )}
        </div>

        <p className="text-center mt-6 text-sm text-neutral-400">
          אין לכם חשבון?{" "}
          <Link href="/register" className="text-pink-500 font-medium hover:underline">
            הירשמו עכשיו
          </Link>
        </p>
      </div>
    </main>
  );
}
