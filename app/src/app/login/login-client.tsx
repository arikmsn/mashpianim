"use client";

import { Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { clearCache } from "@/lib/client-cache";
import { normalizeIsraeliMobile, PHONE_ERROR } from "@/lib/phone";
import { otherOtpChannel, otpChannelLabel, type OtpChannel } from "@/lib/otp-channel";
import { otherPersona, parsePersona, personaForRole, readStoredPersona, storePersona, withType, type Persona } from "@/lib/persona";
import type { SectionContent } from "@/lib/site-content";
import { refreshAuth } from "@/hooks/use-auth";
import { useToast } from "@/components/ui";
import { RoleOptions, chooseRole, roleLabel, type AppRole } from "@/components/features";
import { AuthShell, PersonaSwap, SwapLine, authField, authLabel, personaButton } from "@/components/auth/auth-shell";
import { PersonaChooser } from "@/components/auth/persona-chooser";

type AuthTexts = SectionContent<"auth">;

export function LoginClient({ texts }: { texts: AuthTexts }) {
  return (
    <Suspense>
      <LoginContent texts={texts} />
    </Suspense>
  );
}

const noopSubscribe = () => () => {};
const noStoredPersona = () => null;

function LoginContent({ texts }: { texts: AuthTexts }) {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [step, setStep] = useState<"phone" | "otp" | "admin-login" | "admin-roles" | "choose-role">("phone");
  // Roles the verified account holds when there is more than one (creator / brand / admin)
  const [availableRoles, setAvailableRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [formattedPhone, setFormattedPhone] = useState("");
  // Where the last code went (the server decides: WhatsApp, or SMS when asked for / when WhatsApp fails)
  const [channel, setChannel] = useState<OtpChannel>("whatsapp");
  const tapRef = useRef({ count: 0, timer: 0 });
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/feed";
  const router = useRouter();
  const { toast } = useToast();

  // The account type colours the screen: ?type= wins, otherwise what this session remembers from the home page
  const typeParam = parsePersona(searchParams.get("type"));
  const stored = useSyncExternalStore(noopSubscribe, readStoredPersona, noStoredPersona);
  const persona: Persona | null = typeParam ?? stored;
  useEffect(() => {
    if (typeParam) storePersona(typeParam);
  }, [typeParam]);
  // "I'm a creator / a brand" rides through the code step into registration
  const presetType = persona;

  // The account holds several roles: this session signs in as the chosen one
  async function handleChooseRole(role: AppRole) {
    setLoading(true);
    try {
      const result = await chooseRole(role);
      if (!result.ok) throw new Error(result.error);
      clearCache();
      toast(texts.toast_login_ok, "success");
      window.location.assign(redirect !== "/feed" ? redirect : result.redirect || "/feed");
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : texts.err_choose_role, "error");
    } finally {
      setLoading(false);
    }
  }

  // Sends the code. `requested` is the channel the user asked for (undefined = the server's default); the server
  // answers with the channel it actually used, falling back to SMS when the WhatsApp send fails.
  async function sendCode(requested?: OtpChannel) {
    // Only an Israeli mobile number can receive the code; say so before touching the server
    if (!normalizeIsraeliMobile(phone)) {
      toast(PHONE_ERROR, "error");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requested ? { phone, channel: requested } : { phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const used: OtpChannel = data.channel === "sms" ? "sms" : "whatsapp";
      setChannel(used);
      setFormattedPhone(data.phone);
      setStep("otp");
      toast(`${texts.toast_code_sent} ${otpChannelLabel(used)}!`, "success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : texts.err_send_code;
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendOTP(e: React.FormEvent) {
    e.preventDefault();
    await sendCode();
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
        router.push(
          `/register?verified=1&userId=${data.userId}&phone=${encodeURIComponent(formattedPhone)}${presetType ? `&type=${presetType}` : ""}`
        );
      } else if (Array.isArray(data.roles) && data.roles.length > 1 && !data.role) {
        // The account holds several roles (creator / brand / admin): the session must pick one
        setAvailableRoles(data.roles as AppRole[]);
        setStep("choose-role");
      } else {
        toast(texts.toast_login_ok, "success");
        const role = data.role || data.userType;
        // The device now belongs to this side (admins keep the remembered colour)
        const signedInAs = personaForRole(role);
        if (signedInAs) storePersona(signedInAs);
        const defaultRedirect = role === "brand" ? "/brand" : role === "admin" ? "/admin" : "/feed";
        router.push(redirect !== "/feed" ? redirect : defaultRedirect);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : texts.err_bad_code;
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  // Opened from the link in the WhatsApp message (?phone=972...&code=123456): fill both in and verify at once
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
      const msg = err instanceof Error ? err.message : texts.err_generic;
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
      toast(`${texts.toast_entered_as}${roleLabel(role)}`, "success");
      storePersona(personaForRole(role));
      clearCache();
      window.location.assign(data.redirect || "/feed");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : texts.err_generic;
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

  const loginHref = (p: Persona) => withType(redirect !== "/feed" ? `/login?redirect=${encodeURIComponent(redirect)}` : "/login", p);

  // No type known: the chooser ("who are you?") picks the colour first
  if (!persona && step === "phone") {
    return <PersonaChooser texts={texts} hrefFor={loginHref} />;
  }

  const p = persona || "brand";
  const brand = p === "brand";
  const title = step === "admin-login" ? texts.admin_title : step === "admin-roles" || step === "choose-role" ? texts.roles_title : brand ? texts.brand_login_title : texts.creator_login_title;
  const subtitle = step === "admin-login" ? undefined : step === "choose-role" ? texts.roles_sub : step === "admin-roles" ? texts.roles_sub_admin : brand ? texts.brand_login_sub : texts.creator_login_sub;

  return (
    <AuthShell
      persona={p}
      brandName={texts.brand_name}
      homeLabel={texts.home_link}
      chip={brand ? texts.brand_chip : texts.creator_chip}
      title={title}
      subtitle={subtitle}
      onTitleClick={handleSecretTap}
      below={
        step === "phone" || step === "otp" ? (
          <>
            <SwapLine label={texts.no_account} linkLabel={brand ? texts.brand_no_account_cta : texts.creator_no_account_cta} href={withType("/register", p)} />
            <PersonaSwap label={texts.wrong_type} chipLabel={brand ? texts.brand_wrong_type_cta : texts.creator_wrong_type_cta} target={otherPersona(p)} href={loginHref(otherPersona(p))} />
          </>
        ) : null
      }
      bottom={
        step === "phone" ? (
          <span>
            {texts.admin_prefix}{" "}
            <button type="button" onClick={() => setStep("admin-login")} className="border-b border-neutral-400">
              {texts.admin_login}
            </button>
          </span>
        ) : null
      }
    >
      {step === "phone" && (
        <form onSubmit={handleSendOTP} className="flex flex-col gap-3.5">
          <div>
            <label htmlFor="login-phone" className={authLabel}>{texts.phone_label}</label>
            <input
              id="login-phone"
              type="tel"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={texts.f_phone_ph}
              className={`${authField} text-center text-xl tracking-[1px]`}
              required
              autoFocus
              autoComplete="tel"
            />
          </div>
          <p className="text-center text-xs text-neutral-500">{texts.phone_hint}</p>
          <button type="submit" disabled={loading} className={personaButton}>
            {loading ? texts.cta_sending : texts.cta_send_code}
          </button>
        </form>
      )}

      {step === "otp" && (
        <form onSubmit={handleVerifyOTP} className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-neutral-500">
              {texts.otp_sent} {otpChannelLabel(channel)} {texts.otp_to}
            </span>
            <span className="font-mono" dir="ltr">{formattedPhone}</span>
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
            aria-label={texts.cta_verify}
            className={`${authField} font-mono text-center text-2xl tracking-[0.5em] ${otp.length === 6 ? "border-ink-900" : ""}`}
            required
            autoFocus
          />
          <button type="submit" disabled={loading || otp.length < 6} className={personaButton}>
            {loading ? texts.cta_verifying : texts.cta_verify}
          </button>
          <div className="flex items-center justify-between text-[13px]">
            <button type="button" onClick={() => { setStep("phone"); setOtp(""); }} className="text-neutral-500 hover:text-ink-900">
              {texts.change_phone}
            </button>
            {/* The other channel, one tap away: WhatsApp can silently fail for a number it never chatted with */}
            <button type="button" disabled={loading} onClick={() => sendCode(otherOtpChannel(channel))} className="font-bold text-persona-ink disabled:opacity-50">
              {texts.not_received} {otpChannelLabel(otherOtpChannel(channel))}
            </button>
          </div>
        </form>
      )}

      {step === "admin-login" && (
        <form onSubmit={handleAdminVerify} className="flex flex-col gap-3.5">
          <div>
            <label htmlFor="admin-phone" className={authLabel}>{texts.phone_label}</label>
            <input id="admin-phone" type="tel" dir="ltr" value={adminPhone} onChange={(e) => setAdminPhone(e.target.value)} placeholder={texts.f_phone_ph} className={`${authField} text-center`} autoFocus />
          </div>
          <div>
            <label htmlFor="admin-password" className={authLabel}>{texts.admin_password_label}</label>
            <input id="admin-password" type="password" dir="ltr" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="••••••" className={`${authField} text-center`} />
          </div>
          <button type="submit" disabled={loading || !adminPhone || !adminPassword} className={personaButton}>
            {loading ? texts.cta_verifying : texts.cta_next}
          </button>
          <button type="button" onClick={() => setStep("phone")} className="text-sm text-neutral-500 hover:text-ink-900">
            {texts.admin_back}
          </button>
        </form>
      )}

      {/* Role choice: after the OTP for accounts that hold several roles, and for the test-account gate */}
      {(step === "admin-roles" || step === "choose-role") && (
        <div>
          <RoleOptions
            roles={step === "choose-role" ? availableRoles : (["creator", "brand"] as AppRole[])}
            busy={loading}
            onPick={(role) => (step === "choose-role" ? handleChooseRole(role) : handleAdminRoleLogin(role))}
          />
          <button type="button" onClick={() => { setStep("phone"); setAdminPhone(""); setAdminPassword(""); }} className="mt-4 w-full text-sm text-neutral-500 hover:text-ink-900">
            {texts.roles_back}
          </button>
        </div>
      )}
    </AuthShell>
  );
}
