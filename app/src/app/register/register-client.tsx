"use client";

import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/components/ui";
import { clearCache, fetchJson } from "@/lib/client-cache";
import { refreshAuth } from "@/hooks/use-auth";
import { ISRAEL_REGIONS } from "@/lib/regions";
import { REGISTRATION_CATEGORIES } from "@/lib/categories";
import { otpChannelLabel, otherOtpChannel, type OtpChannel } from "@/lib/otp-channel";
import { otherPersona, parsePersona, readStoredPersona, storePersona, withType, type Persona } from "@/lib/persona";
import type { SectionContent } from "@/lib/site-content";
import { cn } from "@/lib/utils";
import { AuthShell, PersonaSwap, SwapLine, authField, authLabel, personaButton } from "@/components/auth/auth-shell";
import { PersonaChooser } from "@/components/auth/persona-chooser";
import { Markdown } from "@/components/features/markdown";

type AuthTexts = SectionContent<"auth">;
type UserType = Persona | null;

export function RegisterClient({ texts }: { texts: AuthTexts }) {
  return (
    <Suspense>
      <RegisterContent texts={texts} />
    </Suspense>
  );
}

const noopSubscribe = () => () => {};
const noStoredPersona = () => null;

function RegisterContent({ texts }: { texts: AuthTexts }) {
  const searchParams = useSearchParams();
  const initialType = parsePersona(searchParams.get("type"));
  const stored = useSyncExternalStore(noopSubscribe, readStoredPersona, noStoredPersona);
  const verifiedUserId = searchParams.get("userId");
  const verifiedPhone = searchParams.get("phone");
  const isPreVerified = searchParams.get("verified") === "1" && !!verifiedUserId;
  // Adding the other role to a signed-in account (the profile sends ?add=1): the phone is already verified,
  // the account's name and phone prefill the form
  const addRole = searchParams.get("add") === "1";
  // Where a new business lands after registering (?next=billing: straight into the purchase screen)
  const nextScreen: "billing" | null = searchParams.get("next") === "billing" ? "billing" : null;
  const [me, setMe] = useState<{ phone: string; name: string } | null>(null);
  const [chosen, setChosen] = useState<UserType>(null);
  const userType: UserType = initialType ?? chosen ?? (addRole ? null : stored);
  const router = useRouter();

  useEffect(() => {
    if (userType) storePersona(userType);
  }, [userType]);

  useEffect(() => {
    if (isPreVerified && verifiedUserId && !initialType && !addRole) {
      fetch(`/api/auth/user-type?userId=${verifiedUserId}`)
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          if (data?.userType) {
            router.push(data.userType === "brand" ? "/brand" : "/feed");
          }
        })
        .catch(() => {});
    }
  }, [isPreVerified, verifiedUserId, initialType, addRole, router]);

  useEffect(() => {
    if (!addRole) return;
    fetchJson<{ user?: { phone?: string | null; full_name?: string | null } }>("/api/profile").then((d) => {
      setMe({ phone: d?.user?.phone || "", name: d?.user?.full_name || "" });
    });
  }, [addRole]);

  // Registration starts with the phone code, not with the form (QA 18): without a verified phone the
  // login screen takes over and sends new phones back here with verified=1 (the chosen type rides along)
  useEffect(() => {
    if (!isPreVerified) router.replace(withType(nextScreen ? `/login?next=${nextScreen}` : "/login", initialType ?? stored));
  }, [isPreVerified, initialType, stored, nextScreen, router]);

  if (!isPreVerified) {
    return (
      <main className="min-h-screen flex items-center justify-center text-sm text-neutral-500">
        {texts.redirecting}
      </main>
    );
  }
  if (addRole && !me) {
    return (
      <main className="min-h-screen flex items-center justify-center text-sm text-neutral-500">
        {texts.loading_account}
      </main>
    );
  }

  if (!userType) {
    return <PersonaChooser texts={texts} onPick={(p) => setChosen(p)} />;
  }

  const common = {
    texts,
    preVerifiedUserId: verifiedUserId,
    preVerifiedPhone: verifiedPhone || me?.phone || null,
    initialName: me?.name || null,
    addRole,
    nextScreen,
    onSwitch: () => setChosen(otherPersona(userType)),
    onBack: () => (addRole ? router.push("/profile") : setChosen(null)),
  };

  return userType === "creator" ? <CreatorRegistration {...common} /> : <BrandRegistration {...common} />;
}

const CATEGORIES: readonly string[] = REGISTRATION_CATEGORIES;

interface FormProps {
  texts: AuthTexts;
  onBack: () => void;
  onSwitch: () => void;
  preVerifiedUserId?: string | null;
  preVerifiedPhone?: string | null;
  initialName?: string | null;
  addRole?: boolean;
  nextScreen?: "billing" | null;
}

// The frame around one registration form: persona chip, title, progress, the white card, the swap links
function RegisterFrame({ persona, texts, step, total, addRole, children, onSwitch }: { persona: Persona; texts: AuthTexts; step: number; total: number; addRole?: boolean; children: React.ReactNode; onSwitch: () => void }) {
  const brand = persona === "brand";
  return (
    <AuthShell
      persona={persona}
      brandName={texts.brand_name}
      homeLabel={texts.home_link}
      chip={brand ? texts.brand_chip : texts.creator_chip}
      title={addRole ? texts.register_add_title : brand ? texts.brand_register_title : texts.creator_register_title}
      subtitle={addRole ? (brand ? texts.register_add_brand : texts.register_add_creator) : brand ? texts.brand_register_sub : texts.creator_register_sub}
      progress={{ current: Math.min(step, total), total, hint: brand ? texts.brand_register_steps : texts.creator_register_steps }}
      below={
        !addRole ? (
          <>
            <SwapLine label={texts.have_account} linkLabel={texts.have_account_cta} href={withType("/login", persona)} />
            <PersonaSwap label={texts.wrong_type} chipLabel={brand ? texts.brand_wrong_type_cta : texts.creator_wrong_type_cta} target={otherPersona(persona)} onClick={onSwitch} />
          </>
        ) : null
      }
      bottom={<Markdown source={texts.legal_note} compact className="text-[11px] text-neutral-500" />}
    >
      {children}
    </AuthShell>
  );
}

function StepHeader({ title, hint, badge, onBack, showBack }: { title: string; hint?: string; badge?: string; onBack: () => void; showBack: boolean }) {
  return (
    <div className="mb-4 flex items-start gap-2">
      {showBack && (
        <button type="button" onClick={onBack} className="-ms-1 rounded-lg p-1 text-neutral-500 hover:text-ink-900" aria-label="back">
          <ArrowLeft className="h-5 w-5 rotate-180" aria-hidden="true" />
        </button>
      )}
      <div>
        <h2 className="flex flex-wrap items-center gap-2 text-lg font-bold text-ink-900">
          {title}
          {badge && <span className="rounded-full border border-border-strong px-2 py-0.5 text-xs font-medium text-neutral-500">{badge}</span>}
        </h2>
        {hint && <p className="mt-0.5 text-sm text-neutral-500">{hint}</p>}
      </div>
    </div>
  );
}

const chip = (on: boolean) =>
  cn("rounded-full border px-3 py-1.5 text-sm transition-colors", on ? "border-persona bg-persona text-persona-fg" : "border-border-strong bg-white text-ink-900 hover:border-ink-900");

function SummaryRow({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border py-2 last:border-b-0">
      <span className="text-neutral-500">{label}</span>
      <span className="font-medium text-ink-900" dir={ltr ? "ltr" : undefined}>{value}</span>
    </div>
  );
}

function CreatorRegistration({ texts, onBack, onSwitch, preVerifiedUserId, preVerifiedPhone, initialName, addRole }: FormProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  // Where the last code went (the server decides: WhatsApp, or SMS when asked for / when WhatsApp fails)
  const [otpChannel, setOtpChannel] = useState<OtpChannel>("whatsapp");
  const [form, setForm] = useState({
    fullName: initialName || "",
    phone: preVerifiedPhone || "",
    city: "",
    tiktokHandle: "",
    instagramHandle: "",
    categories: [] as string[],
    ageConfirmed: false,
  });
  const router = useRouter();
  const { toast } = useToast();

  function updateForm(field: string, value: string | string[] | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleCategory(cat: string) {
    setForm((prev) => ({
      ...prev,
      categories: prev.categories.includes(cat) ? prev.categories.filter((c) => c !== cat) : [...prev.categories, cat],
    }));
  }

  async function sendCode(requested?: OtpChannel) {
    setLoading(true);
    try {
      const otpRes = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requested ? { phone: form.phone, channel: requested } : { phone: form.phone }),
      });
      const otpData = await otpRes.json();
      if (!otpRes.ok) throw new Error(otpData.error);
      const used: OtpChannel = otpData.channel === "sms" ? "sms" : "whatsapp";
      setOtpChannel(used);
      toast(`${texts.toast_code_sent} ${otpChannelLabel(used)}!`, "success");
      setStep(5);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : texts.err_send_code;
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (preVerifiedUserId) {
      await registerProfile(preVerifiedUserId);
      return;
    }
    await sendCode();
  }

  async function registerProfile(userId: string) {
    setLoading(true);
    try {
      const registerRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, userType: "creator", profile: form }),
      });
      const registerData = await registerRes.json();
      if (!registerRes.ok) throw new Error(registerData.error);

      toast(addRole ? texts.toast_added_creator : texts.toast_registered, "success");
      storePersona("creator");
      clearCache();
      // The session was set server-side; refresh the auth store, then land on the first upload
      await refreshAuth();
      router.push("/profile?onboarding=1");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : texts.err_register;
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
      // The server signed us in (auth cookies on the response); the register call below rides on them
      await registerProfile(verifyData.userId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : texts.err_register;
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  const back = step === 1 ? onBack : () => setStep(step - 1);

  return (
    <RegisterFrame persona="creator" texts={texts} step={step} total={4} addRole={addRole} onSwitch={onSwitch}>
      {step === 1 && (
        <div>
          <StepHeader title={texts.reg_creator_step1} onBack={back} showBack={!addRole} />
          <div className="space-y-3.5">
            <div>
              <label htmlFor="reg-name" className={authLabel}>{texts.f_full_name}</label>
              <input id="reg-name" type="text" placeholder={texts.f_full_name_ph} value={form.fullName} onChange={(e) => updateForm("fullName", e.target.value)} className={authField} autoFocus autoComplete="name" />
            </div>
            <div>
              <label htmlFor="reg-phone" className={authLabel}>{texts.phone_label}</label>
              <input id="reg-phone" type="tel" dir="ltr" placeholder={texts.f_phone_ph} value={form.phone} onChange={(e) => updateForm("phone", e.target.value)} className={`${authField} text-right`} disabled={!!preVerifiedPhone} />
            </div>
            <div>
              <label htmlFor="reg-city" className={authLabel}>{texts.f_city}</label>
              <input id="reg-city" type="text" placeholder={texts.f_city_ph} value={form.city} onChange={(e) => updateForm("city", e.target.value)} className={authField} />
            </div>
            <label className="flex cursor-pointer items-center gap-3 py-1 text-sm text-ink-700">
              <input type="checkbox" checked={form.ageConfirmed} onChange={(e) => updateForm("ageConfirmed", e.target.checked)} className="h-5 w-5 rounded accent-lemon-400" />
              <span>{texts.f_age_confirm}</span>
            </label>
          </div>
          <button type="button" onClick={() => setStep(2)} disabled={!form.fullName || !form.phone || !form.ageConfirmed} className={`${personaButton} mt-5`}>
            {texts.cta_next}
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      )}

      {step === 2 && (
        <div>
          <StepHeader title={texts.reg_creator_step2} hint={texts.reg_creator_step2_hint} badge={texts.reg_optional} onBack={back} showBack />
          <div className="space-y-3.5">
            <div>
              <label htmlFor="reg-tiktok" className={authLabel}>{texts.f_tiktok}</label>
              <input id="reg-tiktok" type="text" dir="ltr" placeholder={texts.f_handle_ph} value={form.tiktokHandle} onChange={(e) => updateForm("tiktokHandle", e.target.value)} className={`${authField} text-right`} />
            </div>
            <div>
              <label htmlFor="reg-instagram" className={authLabel}>{texts.f_instagram}</label>
              <input id="reg-instagram" type="text" dir="ltr" placeholder={texts.f_handle_ph} value={form.instagramHandle} onChange={(e) => updateForm("instagramHandle", e.target.value)} className={`${authField} text-right`} />
            </div>
          </div>
          <button type="button" onClick={() => setStep(3)} className={`${personaButton} mt-5`}>
            {texts.cta_next}
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          {/* Optional step (owner, 2026-11-27): a visible way past it so nobody drops off here; the feed nudges later */}
          <button
            type="button"
            onClick={() => {
              setForm((prev) => ({ ...prev, tiktokHandle: "", instagramHandle: "" }));
              setStep(3);
            }}
            className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-full text-sm font-medium text-neutral-500 transition-colors hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            {texts.reg_skip}
          </button>
        </div>
      )}

      {step === 3 && (
        <div>
          <StepHeader title={texts.reg_creator_step3} hint={texts.reg_creator_step3_hint} onBack={back} showBack />
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button key={cat} type="button" onClick={() => toggleCategory(cat)} aria-pressed={form.categories.includes(cat)} className={chip(form.categories.includes(cat))}>
                {cat}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setStep(4)} disabled={form.categories.length === 0} className={`${personaButton} mt-6`}>
            {texts.cta_next}
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      )}

      {step === 4 && (
        <div>
          <StepHeader title={texts.reg_creator_step4} onBack={back} showBack />
          <div className="mb-6 text-sm">
            <SummaryRow label={texts.sum_name} value={form.fullName} />
            <SummaryRow label={texts.sum_phone} value={form.phone} ltr />
            {form.city && <SummaryRow label={texts.sum_city} value={form.city} />}
            {form.tiktokHandle && <SummaryRow label={texts.sum_tiktok} value={form.tiktokHandle} ltr />}
            {form.instagramHandle && <SummaryRow label={texts.sum_instagram} value={form.instagramHandle} ltr />}
            <SummaryRow label={texts.sum_categories} value={form.categories.join(", ")} />
          </div>
          <button type="button" onClick={handleSubmit} disabled={loading} className={personaButton}>
            {loading ? texts.cta_registering : preVerifiedUserId ? texts.cta_finish : texts.cta_verify_register}
          </button>
        </div>
      )}

      {step === 5 && !preVerifiedUserId && (
        <OTPStep texts={texts} phone={form.phone} loading={loading} channel={otpChannel} onVerify={handleVerifyAndRegister} onBack={() => setStep(4)} onResend={(ch) => sendCode(ch)} />
      )}
    </RegisterFrame>
  );
}

function BrandRegistration({ texts, onBack, onSwitch, preVerifiedUserId, preVerifiedPhone, initialName, addRole, nextScreen }: FormProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [otpChannel, setOtpChannel] = useState<OtpChannel>("whatsapp");
  const [customCategory, setCustomCategory] = useState("");
  const [form, setForm] = useState({
    fullName: initialName || "",
    phone: preVerifiedPhone || "",
    shopName: "",
    category: "",
    websiteUrl: "",
    region: "",
  });
  const router = useRouter();
  const { toast } = useToast();

  function updateForm(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function sendCode(requested?: OtpChannel) {
    setLoading(true);
    try {
      const otpRes = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requested ? { phone: form.phone, channel: requested } : { phone: form.phone }),
      });
      const otpData = await otpRes.json();
      if (!otpRes.ok) throw new Error(otpData.error);
      const used: OtpChannel = otpData.channel === "sms" ? "sms" : "whatsapp";
      setOtpChannel(used);
      toast(`${texts.toast_code_sent} ${otpChannelLabel(used)}!`, "success");
      setStep(3);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : texts.err_send_code;
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (preVerifiedUserId) {
      await registerProfile(preVerifiedUserId);
      return;
    }
    await sendCode();
  }

  async function registerProfile(userId: string) {
    setLoading(true);
    try {
      const registerRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, userType: "brand", profile: form }),
      });
      const registerData = await registerRes.json();
      if (!registerRes.ok) throw new Error(registerData.error);

      toast(addRole ? texts.toast_added_brand : texts.toast_registered, "success");
      storePersona("brand");
      clearCache();
      await refreshAuth();
      router.push(nextScreen === "billing" ? "/brand/billing" : "/brand");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : texts.err_register;
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
      await registerProfile(verifyData.userId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : texts.err_register;
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  const back = step === 1 ? onBack : () => setStep(step - 1);

  return (
    <RegisterFrame persona="brand" texts={texts} step={step} total={2} addRole={addRole} onSwitch={onSwitch}>
      {step === 1 && (
        <div>
          <StepHeader title={texts.reg_brand_step1} onBack={back} showBack={!addRole} />
          <div className="space-y-3.5">
            <div>
              <label htmlFor="reg-contact" className={authLabel}>{texts.f_contact_name}</label>
              <input id="reg-contact" type="text" placeholder={texts.f_full_name_ph} value={form.fullName} onChange={(e) => updateForm("fullName", e.target.value)} className={authField} autoFocus autoComplete="name" />
            </div>
            <div>
              <label htmlFor="reg-shop" className={authLabel}>{texts.f_shop_name}</label>
              <input id="reg-shop" type="text" placeholder={texts.f_shop_name_ph} value={form.shopName} onChange={(e) => updateForm("shopName", e.target.value)} className={authField} autoComplete="organization" />
            </div>
            <div>
              <label htmlFor="reg-bphone" className={authLabel}>{texts.phone_label}</label>
              <input id="reg-bphone" type="tel" dir="ltr" placeholder={texts.f_phone_ph} value={form.phone} onChange={(e) => updateForm("phone", e.target.value)} className={`${authField} text-right`} disabled={!!preVerifiedPhone} />
            </div>
            <div>
              <span className={authLabel}>{texts.f_category}</span>
              <div className="mb-2 flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button key={cat} type="button" onClick={() => updateForm("category", form.category === cat ? "" : cat)} aria-pressed={form.category === cat} className={chip(form.category === cat)}>
                    {cat}
                  </button>
                ))}
                {form.category && !CATEGORIES.includes(form.category) && (
                  <span className={`${chip(true)} flex items-center gap-1`}>
                    {form.category}
                    <button type="button" onClick={() => updateForm("category", "")} className="ms-1 opacity-80 hover:opacity-100" aria-label="x">✕</button>
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={texts.f_custom_category_ph}
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customCategory.trim()) {
                      e.preventDefault();
                      updateForm("category", customCategory.trim());
                      setCustomCategory("");
                    }
                  }}
                  className={`${authField} flex-1 py-2 text-sm`}
                />
                {customCategory.trim() && (
                  <button type="button" onClick={() => { updateForm("category", customCategory.trim()); setCustomCategory(""); }} className="rounded-xl bg-persona px-3 py-2 text-sm font-semibold text-persona-fg">
                    {texts.f_custom_category_add}
                  </button>
                )}
              </div>
            </div>
            <div>
              <span className={authLabel}>{texts.f_region}</span>
              <div className="flex flex-wrap gap-2">
                {ISRAEL_REGIONS.map((region) => (
                  <button key={region} type="button" onClick={() => updateForm("region", form.region === region ? "" : region)} aria-pressed={form.region === region} className={chip(form.region === region)}>
                    {region}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="reg-site" className={authLabel}>{texts.f_website}</label>
              <input id="reg-site" type="url" dir="ltr" placeholder={texts.f_website_ph} value={form.websiteUrl} onChange={(e) => updateForm("websiteUrl", e.target.value)} className={`${authField} text-right`} />
            </div>
          </div>
          <button type="button" onClick={() => setStep(2)} disabled={!form.shopName || !form.phone || !form.fullName} className={`${personaButton} mt-5`}>
            {texts.cta_next}
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      )}

      {step === 2 && (
        <div>
          <StepHeader title={texts.reg_brand_step2} onBack={back} showBack />
          <div className="mb-6 text-sm">
            <SummaryRow label={texts.sum_brand} value={form.shopName} />
            <SummaryRow label={texts.sum_contact} value={form.fullName} />
            <SummaryRow label={texts.sum_phone} value={form.phone} ltr />
            {form.category && <SummaryRow label={texts.sum_category} value={form.category} />}
            {form.region && <SummaryRow label={texts.sum_region} value={form.region} />}
            {form.websiteUrl && <SummaryRow label={texts.sum_website} value={form.websiteUrl} ltr />}
          </div>
          <button type="button" onClick={handleSubmit} disabled={loading} className={personaButton}>
            {loading ? texts.cta_registering : preVerifiedUserId ? texts.cta_finish : texts.cta_verify_register}
          </button>
        </div>
      )}

      {step === 3 && !preVerifiedUserId && (
        <OTPStep texts={texts} phone={form.phone} loading={loading} channel={otpChannel} onVerify={handleVerifyAndRegister} onBack={() => setStep(2)} onResend={(ch) => sendCode(ch)} />
      )}
    </RegisterFrame>
  );
}

function OTPStep({ texts, phone, loading, channel, onVerify, onBack, onResend }: { texts: AuthTexts; phone: string; loading: boolean; channel: OtpChannel; onVerify: (code: string) => void; onBack: () => void; onResend: (channel: OtpChannel) => void }) {
  const [code, setCode] = useState("");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-[13px]">
        <span className="text-neutral-500">
          {texts.otp_sent} {otpChannelLabel(channel)} {texts.otp_to}
        </span>
        <span className="font-mono" dir="ltr">{phone}</span>
      </div>
      <input
        type="text"
        dir="ltr"
        inputMode="numeric"
        autoComplete="one-time-code"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        placeholder="000000"
        maxLength={6}
        aria-label={texts.cta_verify_otp_register}
        className={`${authField} font-mono text-center text-2xl tracking-[0.5em]`}
        autoFocus
      />
      <button type="button" onClick={() => onVerify(code)} disabled={loading || code.length < 6} className={personaButton}>
        {loading ? texts.cta_verifying : texts.cta_verify_otp_register}
      </button>
      <div className="flex items-center justify-between text-[13px]">
        <button type="button" onClick={onBack} className="text-neutral-500 hover:text-ink-900">
          {texts.otp_back}
        </button>
        {/* The other channel, one tap away: WhatsApp can silently fail for a number it never chatted with */}
        <button type="button" disabled={loading} onClick={() => onResend(otherOtpChannel(channel))} className="font-bold text-persona-ink disabled:opacity-50">
          {texts.not_received} {otpChannelLabel(otherOtpChannel(channel))}
        </button>
      </div>
    </div>
  );
}
