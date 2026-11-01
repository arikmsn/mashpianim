"use client";

import { Suspense, useState, useRef, useCallback } from "react";
import Image from "next/image";
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
  const tapRef = useRef({ count: 0, timer: 0 });
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

      // Create Supabase session
      if (data.email && data.tempPassword) {
        const { error: sessionError } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.tempPassword,
        });
        if (sessionError) {
          console.error("[login] session error:", sessionError);
        }
      }

      if (data.needsOnboarding) {
        router.push(`/register?verified=1&userId=${data.userId}&phone=${encodeURIComponent(formattedPhone)}`);
      } else {
        toast("התחברתם בהצלחה!", "success");
        const defaultRedirect = data.userType === "brand" ? "/brand" : "/feed";
        router.push(redirect !== "/feed" ? redirect : defaultRedirect);
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
      const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast("התחברתם בהצלחה!", "success");

      let targetRedirect = redirect;
      if (redirect === "/feed" && signInData?.user) {
        try {
          const { data: dbUser } = await supabase
            .from("users")
            .select("type")
            .eq("auth_user_id", signInData.user.id)
            .single();
          if ((dbUser as any)?.type === "brand") {
            targetRedirect = "/brand";
          }
        } catch {
          // Default redirect
        }
      }
      router.push(targetRedirect);
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

      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.authPassword,
      });
      if (error) throw error;

      const roleLabel = role === "admin" ? "מנהל" : role === "creator" ? "יוצר תוכן" : "מפרסם";
      toast(`נכנסתם כ${roleLabel}`, "success");
      router.push(data.redirect);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "שגיאה";
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  const handleSecretTap = useCallback(() => {
    tapRef.current.count += 1;
    window.clearTimeout(tapRef.current.timer);
    if (tapRef.current.count >= 5) {
      tapRef.current.count = 0;
      setStep("admin-login");
    } else {
      tapRef.current.timer = window.setTimeout(() => { tapRef.current.count = 0; }, 2000);
    }
  }, []);

  async function handleGoogleLogin() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?redirect=${redirect}` },
    });
    if (error) toast(error.message, "error");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6" style={{ background: "linear-gradient(135deg, rgba(131,58,180,0.05), rgba(225,48,108,0.05), rgba(247,119,55,0.03))" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Image src="/logo.png" alt="משפיען אונליין" width={72} height={72} className="mx-auto rounded-2xl shadow-lg shadow-ig-pink/20 mb-4" />
          <h1
            className="text-3xl font-bold mb-2 cursor-default select-none"
            onClick={handleSecretTap}
          >
            ברוכים הבאים!
          </h1>
          <p className="text-neutral-500">התחברו או הצטרפו בקלות</p>
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
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-ig-pink focus:ring-2 focus:ring-ig-pink/20 outline-none transition-all text-center text-lg"
                required
              />
              <p className="text-xs text-neutral-400 mt-2 text-center">נשלח קוד אימות בוואטסאפ</p>
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-4 px-6 py-3 rounded-xl ig-gradient-bg text-white font-medium hover:opacity-90 transition-colors disabled:opacity-50"
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
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-ig-pink focus:ring-2 focus:ring-ig-pink/20 outline-none transition-all text-center text-2xl tracking-[0.5em]"
                required
              />
              <button
                type="submit"
                disabled={loading || otp.length < 6}
                className="w-full mt-4 px-6 py-3 rounded-xl ig-gradient-bg text-white font-medium hover:opacity-90 transition-colors disabled:opacity-50"
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
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-ig-pink focus:ring-2 focus:ring-ig-pink/20 outline-none transition-all text-center" required />
              <label className="block text-sm font-medium mb-2 mt-3">סיסמה</label>
              <input type="password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-ig-pink focus:ring-2 focus:ring-ig-pink/20 outline-none transition-all text-center" required />
              <button type="submit" disabled={loading}
                className="w-full mt-4 px-6 py-3 rounded-xl ig-gradient-bg text-white font-medium hover:opacity-90 transition-colors disabled:opacity-50">
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
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-ig-pink focus:ring-2 focus:ring-ig-pink/20 outline-none transition-all text-center mb-3"
              />
              <label className="block text-sm font-medium mb-2">סיסמה</label>
              <input
                type="password"
                dir="ltr"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="••••••"
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-ig-pink focus:ring-2 focus:ring-ig-pink/20 outline-none transition-all text-center"
              />
              <button
                type="submit"
                disabled={loading || !adminPhone || !adminPassword}
                className="w-full mt-4 px-6 py-3 rounded-xl ig-gradient-bg text-white font-medium hover:opacity-90 transition-colors disabled:opacity-50"
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
                {[
                  { role: "admin", label: "ממשק מנהל", desc: "דשבורד, מודרציה, הגדרות", color: "pink" },
                  { role: "creator", label: "ממשק יוצר תוכן", desc: "פיד, פרופיל, חיבורים", color: "purple" },
                  { role: "brand", label: "ממשק מפרסם", desc: "קמפיינים, יוצרים, סרטונים", color: "blue" },
                ].map((item) => (
                  <button
                    key={item.role}
                    type="button"
                    disabled={loading}
                    onClick={() => handleAdminRoleLogin(item.role)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-neutral-200 hover:bg-pink-50 hover:border-pink-200 transition-colors text-right disabled:opacity-50"
                  >
                    <div className={`w-10 h-10 rounded-xl bg-${item.color}-50 flex items-center justify-center shrink-0`}>
                      <div className={`w-5 h-5 rounded-full bg-${item.color}-200`} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">{item.label}</p>
                      <p className="text-xs text-neutral-400">{item.desc}</p>
                    </div>
                  </button>
                ))}
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
                className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-neutral-200 hover:bg-neutral-50 hover:border-neutral-300 hover:shadow-sm transition-all text-sm font-medium text-neutral-700"
              >
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Google
              </button>
            </div>
          )}
        </div>

        <p className="text-center mt-6 text-sm text-neutral-400">
          הזינו מספר טלפון — אם אין לכם חשבון, ניצור אחד אוטומטית
        </p>
      </div>
    </main>
  );
}
