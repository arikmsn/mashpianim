"use client";

import { Suspense, useState, useRef, useCallback } from "react";
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

      if (data.verificationUrl) {
        router.push(data.verificationUrl);
      } else if (data.needsOnboarding) {
        router.push("/register");
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

      // Determine redirect based on user type
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

          {(
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
