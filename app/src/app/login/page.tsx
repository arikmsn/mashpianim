"use client";

import { Suspense, useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { clearCache } from "@/lib/client-cache";
import { refreshAuth } from "@/hooks/use-auth";
import { useToast } from "@/components/ui";
import { RoleOptions, chooseRole, type AppRole } from "@/components/features";

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
  const [step, setStep] = useState<"phone" | "otp" | "email" | "admin-login" | "admin-roles" | "choose-role">("phone");
  // Roles the verified account holds when there is more than one (creator / brand / admin)
  const [availableRoles, setAvailableRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [formattedPhone, setFormattedPhone] = useState("");
  const tapRef = useRef({ count: 0, timer: 0 });
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/feed";
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();

  // Opened from the link in the WhatsApp message (?phone=972…&code=123456): fill both in and verify at once
  const autoVerifyRef = useRef(false);
  useEffect(() => {
    const linkPhone = searchParams.get("phone");
    const linkCode = searchParams.get("code");
    if (!linkPhone || !linkCode || autoVerifyRef.current) return;
    autoVerifyRef.current = true;
    const digits = linkPhone.replace(/[^\d]/g, "");
    setPhone(digits.startsWith("972") ? `0${digits.slice(3)}` : digits);
    setFormattedPhone(`+${digits}`);
    setOtp(linkCode);
    setStep("otp");
    const t = setTimeout(() => {
      verifyCode(`+${digits}`, linkCode);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // The account holds several roles: this session signs in as the chosen one
  async function handleChooseRole(role: AppRole) {
    setLoading(true);
    try {
      const result = await chooseRole(role);
      if (!result.ok) throw new Error(result.error);
      clearCache();
      toast("התחברתם בהצלחה!", "success");
      window.location.assign(redirect !== "/feed" ? redirect : result.redirect || "/feed");
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "שגיאה בבחירת ממשק", "error");
    } finally {
      setLoading(false);
    }
  }

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
    await verifyCode(formattedPhone, otp);
  }

  // Shared by the form and by the link in the WhatsApp message (which passes the values directly,
  // before React state has caught up)
  async function verifyCode(phoneValue: string, codeValue: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneValue, code: codeValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // A new session must never see the previous user's cached responses
      clearCache();

      // The server already signed us in (auth cookies on the response); refresh the auth store from them
      await refreshAuth();

      if (data.needsOnboarding) {
        router.push(`/register?verified=1&userId=${data.userId}&phone=${encodeURIComponent(formattedPhone)}`);
      } else if (Array.isArray(data.roles) && data.roles.length > 1 && !data.role) {
        // The account holds several roles (creator / brand / admin): the session must pick one
        setAvailableRoles(data.roles as AppRole[]);
        setStep("choose-role");
      } else {
        toast("התחברתם בהצלחה!", "success");
        const role = data.role || data.userType;
        const defaultRedirect = role === "brand" ? "/brand" : role === "admin" ? "/admin" : "/feed";
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
      clearCache();
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

      // The session cookie was set by the server; a full navigation picks it up
      const roleLabel = role === "creator" ? "יוצר תוכן" : "מפרסם";
      toast(`נכנסתם כ${roleLabel}`, "success");
      clearCache();
      window.location.assign(data.redirect || "/feed");
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

  return (
    <main className="min-h-screen flex items-center justify-center px-6" style={{ background: "linear-gradient(135deg, rgba(131,58,180,0.05), rgba(225,48,108,0.05), rgba(247,119,55,0.03))" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Image src="/icon-192.png" alt="משפיען אונליין" width={72} height={72} unoptimized className="mx-auto rounded-2xl shadow-lg shadow-ig-pink/20 mb-4" />
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
                autoFocus
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
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                maxLength={6}
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-ig-pink focus:ring-2 focus:ring-ig-pink/20 outline-none transition-all text-center text-2xl tracking-[0.5em]"
                required
                autoFocus
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
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-ig-pink focus:ring-2 focus:ring-ig-pink/20 outline-none transition-all text-center" required autoFocus />
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
                autoFocus
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

          {/* Role choice: after the OTP for accounts that hold several roles, and for the test-account gate */}
          {(step === "admin-roles" || step === "choose-role") && (
            <div>
              <div className="text-center mb-5">
                <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="font-semibold text-neutral-900">אומתת בהצלחה</p>
                <p className="text-sm text-neutral-400 mt-1">
                  {step === "choose-role" ? "החשבון הזה רשום ביותר מתפקיד אחד — באיזה ממשק להיכנס?" : "בחרו ממשק כניסה"}
                </p>
              </div>
              <RoleOptions
                roles={step === "choose-role" ? availableRoles : (["creator", "brand"] as AppRole[])}
                busy={loading}
                onPick={(role) => (step === "choose-role" ? handleChooseRole(role) : handleAdminRoleLogin(role))}
              />
              <button type="button" onClick={() => { setStep("phone"); setAdminPhone(""); setAdminPassword(""); }}
                className="w-full mt-4 text-sm text-neutral-400 hover:text-neutral-600">
                חזרה להתחברות רגילה
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
