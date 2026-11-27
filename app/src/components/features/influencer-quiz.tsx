"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { tagClass } from "@/components/home/styles";
import { quizQuestions, utmFromSearch, type LeadAnswers, type LeadError, type QuizQuestion } from "@/lib/influencer-leads";
import type { SectionContent } from "@/lib/site-content";

// The influencer quiz (design package v3): five short questions on a dark card, a short contact form, a
// confirmation. Every text comes from the content registry (quiz + home_influencers sections); the option keys
// are what gets saved. Each question is presented by its stable key: the follower count as a slider, the
// platforms as icon tiles, everything else as chips. A single-choice chip moves on by itself after 320ms, the
// slider and the multiple-choice questions wait for the next button (an empty multiple choice may be skipped).

type QuizContent = SectionContent<"quiz">;
type SectionTexts = Pick<SectionContent<"home_influencers">, "card_eyebrow" | "privacy_note" | "cta_next" | "cta_back" | "progress_label">;

interface Props {
  quiz: QuizContent;
  texts: SectionTexts;
  homeHref: string;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

type Presentation = "slider" | "icons" | "chips";
const PRESENTATION: Partial<Record<string, Presentation>> = { tier: "slider", platforms: "icons" };

// Brand marks for the platform tiles (lucide ships no brand icons); keyed by the option key
function PlatformIcon({ name, className }: { name: string; className?: string }) {
  switch (name) {
    case "instagram":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "tiktok":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
          <path d="M12.53.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
        </svg>
      );
    case "youtube":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <path d="M2.5 12c0-2.6.2-4.4.5-5.3.3-.9 1-1.5 1.9-1.7C6.4 4.7 9 4.5 12 4.5s5.6.2 7.1.5c.9.2 1.6.8 1.9 1.7.3.9.5 2.7.5 5.3s-.2 4.4-.5 5.3c-.3.9-1 1.5-1.9 1.7-1.5.3-4.1.5-7.1.5s-5.6-.2-7.1-.5c-.9-.2-1.6-.8-1.9-1.7-.3-.9-.5-2.7-.5-5.3z" />
          <path d="M10 9.2v5.6l4.8-2.8L10 9.2z" fill="currentColor" stroke="none" />
        </svg>
      );
    case "facebook":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
          <path d="M13.5 21v-7.5h2.6l.4-3h-3v-1.9c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.8v3h2.6V21h3.1z" />
        </svg>
      );
    default:
      return <span className={className} aria-hidden="true" />;
  }
}

export function InfluencerQuiz({ quiz, texts, homeHref }: Props) {
  const reduce = useReducedMotion();
  const questions = quizQuestions(quiz);
  const total = questions.length;
  const [step, setStep] = useState(0); // 0..total-1 questions, total = form, total+1 = done
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [form, setForm] = useState({ full_name: "", business_name: "", phone: "", email: "", note: "" });
  const [fieldError, setFieldError] = useState<{ field: "full_name" | "phone" | "email"; text: string } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dir, setDir] = useState<1 | -1>(1);
  const timer = useRef<number | null>(null);
  const utm = useRef<ReturnType<typeof utmFromSearch>>(null);

  useEffect(() => {
    utm.current = utmFromSearch(window.location.search);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  const go = useCallback((next: number) => {
    setDir(next > step ? 1 : -1);
    setStep(next);
  }, [step]);

  const current: QuizQuestion | undefined = questions[step];
  const selected = current ? picked[current.key] || [] : [];
  const presentation: Presentation = current ? PRESENTATION[current.key] || "chips" : "chips";

  function setAnswer(q: QuizQuestion, keys: string[]) {
    setPicked((prev) => ({ ...prev, [q.key]: keys }));
  }

  function pick(q: QuizQuestion, key: string) {
    setPicked((prev) => {
      const prevKeys = prev[q.key] || [];
      const nextKeys = q.multi ? (prevKeys.includes(key) ? prevKeys.filter((k) => k !== key) : [...prevKeys, key]) : [key];
      return { ...prev, [q.key]: nextKeys };
    });
    if (!q.multi) {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => go(step + 1), 320);
    }
  }

  // The slider starts in the middle of its stops until the visitor moves it; the stop shown is what gets saved
  const sliderIndex = current && presentation === "slider"
    ? (selected[0] ? Math.max(0, current.options.findIndex((o) => o.key === selected[0])) : Math.floor((current.options.length - 1) / 2))
    : 0;
  const sliderOption = current && presentation === "slider" ? current.options[sliderIndex] : undefined;

  function next() {
    if (current && presentation === "slider" && !selected.length && sliderOption) setAnswer(current, [sliderOption.key]);
    go(step + 1);
  }

  function answers(): LeadAnswers {
    const out: LeadAnswers = {};
    for (const q of questions) {
      const keys = picked[q.key] || [];
      if (!keys.length) continue;
      out[q.key] = q.multi ? keys : keys[0];
    }
    return out;
  }

  function summary(): string {
    const parts: string[] = [];
    for (const q of questions) {
      const keys = picked[q.key] || [];
      const titles = keys.map((k) => q.options.find((o) => o.key === k)?.title).filter(Boolean);
      if (titles.length) parts.push(titles.join(", "));
    }
    return parts.length ? `${quiz.form_summary_prefix} ${parts.join(" · ")}` : "";
  }

  const errorText = (code: LeadError | "network" | "too_many"): string => {
    switch (code) {
      case "required_name":
        return quiz.err_required_name;
      case "required_phone":
        return quiz.err_required_phone;
      case "bad_phone":
        return quiz.err_bad_phone;
      case "bad_email":
        return quiz.err_bad_email;
      case "too_many":
        return quiz.err_too_many;
      default:
        return quiz.err_network;
    }
  };

  async function submit() {
    setSubmitError(null);
    const name = form.full_name.trim();
    if (name.length < 2) return setFieldError({ field: "full_name", text: quiz.err_required_name });
    const phoneDigits = form.phone.replace(/\D/g, "");
    if (!phoneDigits) return setFieldError({ field: "phone", text: quiz.err_required_phone });
    if (!/^(972)?0?\d{8,9}$/.test(phoneDigits) || phoneDigits.length > 12) return setFieldError({ field: "phone", text: quiz.err_bad_phone });
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) return setFieldError({ field: "email", text: quiz.err_bad_email });
    setFieldError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/influencer-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: answers(), ...form, utm: utm.current }),
      });
      if (res.ok) {
        go(total + 1);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.status === 429) setSubmitError(errorText("too_many"));
      else if (data.error === "required_name" || data.error === "required_phone" || data.error === "bad_phone" || data.error === "bad_email") {
        const field = data.error === "bad_email" ? "email" : data.error === "required_name" ? "full_name" : "phone";
        setFieldError({ field, text: errorText(data.error) });
      } else setSubmitError(errorText("network"));
    } catch {
      setSubmitError(errorText("network"));
    } finally {
      setSubmitting(false);
    }
  }

  function restart() {
    setPicked({});
    setForm({ full_name: "", business_name: "", phone: "", email: "", note: "" });
    setFieldError(null);
    setSubmitError(null);
    go(0);
  }

  const isForm = step === total;
  const isDone = step === total + 1;
  const progress = isDone ? 100 : Math.round(((Math.min(step, total - 1) + 1) / total) * 100);
  const counter = `${pad2(Math.min(step, total - 1) + 1)} / ${pad2(total)}`;
  const canContinue = presentation === "slider" || (current?.multi ?? false) || selected.length > 0;

  // Each step slides in on mount (24px in the reading direction, with a fade); no exit animation, so a tap on a
  // single-choice option never waits for the previous question to leave.
  const enter = reduce ? { opacity: 0 } : { x: 24 * dir, opacity: 0 };
  const center = reduce ? { opacity: 1 } : { x: 0, opacity: 1 };

  const fieldCls = "w-full rounded-xl border border-white/20 bg-white/5 px-3.5 py-3 text-base text-on-ink placeholder:text-on-ink/40 outline-none focus:border-pink-300 focus:ring-[3px] focus:ring-lemon-400/20";
  const labelCls = "block text-[13px] font-semibold text-on-ink/70 mb-1.5";
  const focusCls = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-300";
  const onCls = "border-pink-400 bg-pink-500/15";
  const offCls = "border-white/15 bg-white/5 hover:border-white/50";

  return (
    <div
      className="relative overflow-hidden rounded-3xl p-5 text-on-ink shadow-ink md:p-8"
      style={{ background: "var(--surface-ink) radial-gradient(80% 60% at 100% 0%, #ff2e7e40 0%, #ffd84d00 60%)" }}
      aria-live="polite"
    >
      {!isDone && (
        <>
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-xs text-pink-300">
              <span className="font-mono">{counter}</span>
              {isForm && quiz.last_step_tag && <span className="ms-2 font-medium">{quiz.last_step_tag}</span>}
            </span>
            <span className="inline-flex items-center gap-2 text-xs font-medium tracking-[1.2px] text-on-ink/70 before:content-[''] before:h-1.5 before:w-1.5 before:rounded-full before:bg-pink-500">{texts.card_eyebrow}</span>
          </div>
          <div className="mb-6 h-[3px] overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label={texts.progress_label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
            <div className="h-full rounded-full bg-pink-500 transition-[width] duration-500 ease-[cubic-bezier(.16,1,.3,1)]" style={{ width: `${progress}%` }} />
          </div>
        </>
      )}

      {current && !isForm && !isDone && (
        <motion.div key={`q-${step}`} initial={enter} animate={center} transition={{ duration: reduce ? 0.15 : 0.45, ease: [0.16, 1, 0.3, 1] }}>
          <h3 className="font-display text-2xl leading-tight text-on-ink md:text-[28px]">{current.question}</h3>
          <p className="mb-5 mt-1.5 text-[13px] text-on-ink/60">{current.hint}</p>

          {presentation === "slider" && sliderOption && (
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4 md:p-5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-display text-[26px] leading-none md:text-[30px]">{sliderOption.title}</span>
                {sliderOption.tag && <span className={cn("text-sm font-semibold text-pink-300", tagClass(sliderOption.tag))}>{sliderOption.tag}</span>}
              </div>
              {sliderOption.sub && <p className="mt-1.5 text-[13px] text-on-ink/60">{sliderOption.sub}</p>}
              <input
                type="range"
                min={0}
                max={current.options.length - 1}
                step={1}
                value={sliderIndex}
                onChange={(e) => setAnswer(current, [current.options[Number(e.target.value)].key])}
                aria-label={current.question}
                aria-valuetext={`${sliderOption.title}${sliderOption.tag ? `, ${sliderOption.tag}` : ""}`}
                className="quiz-range mt-5 w-full"
              />
              <div className="mt-1 flex justify-between text-[11px] text-on-ink/50">
                {current.options.map((o) => (
                  <span key={o.key} className={cn(tagClass(o.tag || o.title), o.key === sliderOption.key && "font-semibold text-on-ink")}>{o.tag || o.title}</span>
                ))}
              </div>
            </div>
          )}

          {presentation === "icons" && (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 md:gap-3">
              {current.options.map((o) => {
                const on = selected.includes(o.key);
                return (
                  <button
                    key={o.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => pick(current, o.key)}
                    className={cn("flex min-h-[112px] flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-center transition-[border-color,background] duration-150", focusCls, on ? onCls : offCls)}
                  >
                    <PlatformIcon name={o.key} className={cn("h-8 w-8", on ? "text-pink-300" : "text-on-ink/80")} />
                    <span className="text-[15px] font-semibold leading-tight">{o.title}</span>
                    {o.sub && <span className="text-[12px] text-on-ink/60">{o.sub}</span>}
                  </button>
                );
              })}
            </div>
          )}

          {presentation === "chips" && (
            <div className="flex flex-wrap gap-2 md:gap-2.5">
              {current.options.map((o) => {
                const on = selected.includes(o.key);
                return (
                  <button
                    key={o.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => pick(current, o.key)}
                    className={cn("inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 text-right transition-[border-color,background] duration-150", focusCls, on ? onCls : offCls)}
                  >
                    {on && <Check className="h-4 w-4 shrink-0 text-pink-300" aria-hidden="true" strokeWidth={3} />}
                    <span className="flex flex-col">
                      <span className={cn("text-[15px] font-semibold leading-tight", tagClass(o.title))}>{o.title}</span>
                      {o.sub && <span className="text-[12px] text-on-ink/60">{o.sub}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => go(step - 1)}
              className={cn("rounded-full px-3.5 py-3 text-[15px] font-semibold text-on-ink/70 hover:text-on-ink", step === 0 && "invisible")}
            >
              {texts.cta_back}
            </button>
            <span className="hidden flex-1 text-xs text-on-ink/40 sm:block">{texts.privacy_note}</span>
            <button
              type="button"
              disabled={!canContinue}
              onClick={next}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-[15px] font-semibold text-white hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-35"
            >
              {texts.cta_next}
              <ArrowLeft className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
          </div>
        </motion.div>
      )}

      {isForm && (
        <motion.div key="form" initial={enter} animate={center} transition={{ duration: reduce ? 0.15 : 0.45, ease: [0.16, 1, 0.3, 1] }}>
          <h3 className="font-display text-2xl leading-tight text-on-ink md:text-[28px]">{quiz.form_title}</h3>
          <p className="mb-5 mt-1.5 min-h-[1.25rem] text-[13px] text-on-ink/60">{summary()}</p>
          <form
            className="grid grid-cols-1 gap-3.5 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            noValidate
          >
            <div>
              <label htmlFor="quiz-name" className={labelCls}>{quiz.label_name}</label>
              <input id="quiz-name" className={fieldCls} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder={quiz.ph_name} autoComplete="name" aria-invalid={fieldError?.field === "full_name" || undefined} />
              {fieldError?.field === "full_name" && <p className="mt-1 text-xs text-pink-300">{fieldError.text}</p>}
            </div>
            <div>
              <label htmlFor="quiz-phone" className={labelCls}>{quiz.label_phone}</label>
              <input id="quiz-phone" className={`${fieldCls} text-right`} dir="ltr" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder={quiz.ph_phone} aria-invalid={fieldError?.field === "phone" || undefined} />
              {fieldError?.field === "phone" && <p className="mt-1 text-xs text-pink-300">{fieldError.text}</p>}
            </div>
            <div>
              <label htmlFor="quiz-email" className={labelCls}>{quiz.label_email}</label>
              <input id="quiz-email" className={`${fieldCls} text-right`} dir="ltr" inputMode="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder={quiz.ph_email} aria-invalid={fieldError?.field === "email" || undefined} />
              {fieldError?.field === "email" && <p className="mt-1 text-xs text-pink-300">{fieldError.text}</p>}
            </div>
            <div>
              <label htmlFor="quiz-business" className={labelCls}>{quiz.label_business}</label>
              <input id="quiz-business" className={fieldCls} value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} placeholder={quiz.ph_business} autoComplete="organization" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="quiz-note" className={labelCls}>{quiz.label_note}</label>
              <textarea id="quiz-note" rows={2} className={`${fieldCls} resize-y`} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder={quiz.ph_note} />
            </div>
            <div className="flex items-center justify-between gap-3 sm:col-span-2">
              <button type="button" onClick={() => go(step - 1)} className="rounded-full px-3.5 py-3 text-[15px] font-semibold text-on-ink/70 hover:text-on-ink">
                {texts.cta_back}
              </button>
              <button type="submit" disabled={submitting} className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 text-[15px] font-semibold text-white hover:bg-primary-hover disabled:opacity-60">
                {submitting ? quiz.submitting : quiz.submit}
              </button>
            </div>
            {submitError && <p className="text-sm text-pink-300 sm:col-span-2">{submitError}</p>}
            <p className="text-xs text-on-ink/40 sm:col-span-2">{quiz.legal_note}</p>
          </form>
        </motion.div>
      )}

      {isDone && (
        <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="flex flex-col items-center py-6 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-pink-500 text-white">
            <Check className="h-7 w-7" aria-hidden="true" />
          </span>
          {quiz.done_tag && <span className={cn("mt-5 text-xs font-medium text-pink-300", tagClass(quiz.done_tag))}>{quiz.done_tag}</span>}
          <h3 className="mb-2 mt-2.5 font-display text-[30px] leading-tight text-on-ink md:text-[34px]">{quiz.done_title}</h3>
          <p className="max-w-[420px] text-base leading-relaxed text-on-ink/70">{quiz.done_body}</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <a href={homeHref} className="inline-flex h-12 items-center justify-center rounded-full bg-canvas px-6 text-[15px] font-semibold text-ink-900">
              {quiz.done_cta_home}
            </a>
            <button type="button" onClick={restart} className="rounded-full px-3.5 py-3 text-[15px] font-semibold text-on-ink/70 hover:text-on-ink">
              {quiz.done_cta_again}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
