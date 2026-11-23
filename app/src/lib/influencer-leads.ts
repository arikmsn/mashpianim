// The influencer quiz behind the scenes (design package v3, Phase C): the questions as the quiz component and
// the API see them, the lead validation and the answer summary. Pure, unit-tested.
//
// The option keys are stable identifiers (migration 026): the admin edits the texts in /admin/content, the keys
// are what gets stored on the lead.

import type { SectionContent } from "./site-content.ts";

export const LEAD_STATUSES = ["new", "contacted", "qualified", "closed"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "חדש",
  contacted: "נוצר קשר",
  qualified: "מתאים",
  closed: "נסגר",
};

export function isLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === "string" && (LEAD_STATUSES as readonly string[]).includes(value);
}

// Question keys, in the quiz order (the answers object is keyed by them): the follower slider, the platforms,
// the regions of the audience, how many videos, what kind of product
export const QUIZ_QUESTION_KEYS = ["tier", "platforms", "regions", "videos", "product"] as const;
export type QuizQuestionKey = (typeof QUIZ_QUESTION_KEYS)[number];

export interface QuizOption {
  key: string;
  tag: string;
  title: string;
  sub: string;
}

export interface QuizQuestion {
  key: QuizQuestionKey;
  question: string;
  hint: string;
  multi: boolean;
  options: QuizOption[];
}

type QuizContent = SectionContent<"quiz">;

// q1..q5 of the content section → the five questions
export function quizQuestions(quiz: QuizContent): QuizQuestion[] {
  const q = quiz as unknown as Record<string, unknown>;
  return QUIZ_QUESTION_KEYS.map((key, i) => {
    const n = i + 1;
    const options = Array.isArray(q[`q${n}_options`]) ? (q[`q${n}_options`] as Record<string, string>[]) : [];
    return {
      key,
      question: String(q[`q${n}_question`] ?? ""),
      hint: String(q[`q${n}_hint`] ?? ""),
      multi: q[`q${n}_multi`] === true,
      options: options
        .map((o) => ({ key: String(o.key || "").trim(), tag: String(o.tag || ""), title: String(o.title || ""), sub: String(o.sub || "") }))
        .filter((o) => o.key),
    };
  });
}

export type LeadAnswers = Partial<Record<QuizQuestionKey, string | string[]>>;

export interface LeadInput {
  answers: LeadAnswers;
  full_name: string;
  business_name: string | null;
  phone: string;
  email: string | null;
  note: string | null;
  utm: { source?: string; medium?: string; campaign?: string } | null;
}

export type LeadError = "required_name" | "required_phone" | "bad_phone" | "bad_email" | "invalid";
export type LeadValidation = { ok: true; value: LeadInput } | { ok: false; error: LeadError };

// Israeli phone, 9 or 10 digits (a mobile or a landline), stored as +972…
export function normalizeIsraeliPhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+972")) digits = "0" + digits.slice(4);
  else if (digits.startsWith("972")) digits = "0" + digits.slice(3);
  digits = digits.replace(/\D/g, "");
  if (!/^0\d{8,9}$/.test(digits)) return null;
  return "+972" + digits.slice(1);
}

export function isValidEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(raw.trim());
}

function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

// Keeps only known questions and known option keys; a single-choice question keeps its first valid key
export function normalizeAnswers(raw: unknown, questions: QuizQuestion[]): LeadAnswers {
  const input = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out: LeadAnswers = {};
  for (const q of questions) {
    const v = input[q.key];
    const allowed = new Set(q.options.map((o) => o.key));
    const picked = (Array.isArray(v) ? v : typeof v === "string" ? [v] : []).filter((k): k is string => typeof k === "string" && allowed.has(k));
    if (!picked.length) continue;
    out[q.key] = q.multi ? [...new Set(picked)].slice(0, q.options.length) : picked[0];
  }
  return out;
}

export function validateLeadInput(input: unknown, questions: QuizQuestion[]): LeadValidation {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, error: "invalid" };
  const body = input as Record<string, unknown>;
  const full_name = str(body.full_name, 80);
  if (full_name.length < 2) return { ok: false, error: "required_name" };
  const phoneRaw = str(body.phone, 30);
  if (!phoneRaw) return { ok: false, error: "required_phone" };
  const phone = normalizeIsraeliPhone(phoneRaw);
  if (!phone) return { ok: false, error: "bad_phone" };
  const emailRaw = str(body.email, 120);
  if (emailRaw && !isValidEmail(emailRaw)) return { ok: false, error: "bad_email" };
  const business_name = str(body.business_name, 80) || null;
  const note = str(body.note, 500) || null;
  const utmRaw = body.utm && typeof body.utm === "object" && !Array.isArray(body.utm) ? (body.utm as Record<string, unknown>) : null;
  const utm = utmRaw
    ? Object.fromEntries((["source", "medium", "campaign"] as const).map((k) => [k, str(utmRaw[k], 100)]).filter(([, v]) => v))
    : {};
  return {
    ok: true,
    value: {
      answers: normalizeAnswers(body.answers, questions),
      full_name,
      business_name,
      phone,
      email: emailRaw ? emailRaw.toLowerCase() : null,
      note,
      utm: Object.keys(utm).length ? (utm as LeadInput["utm"]) : null,
    },
  };
}

// "ננו · אינסטגרם, טיקטוק · ביוטי · מרכז · שניהם" (titles from the content, keys from the lead)
export function answersSummary(answers: LeadAnswers | null | undefined, questions: QuizQuestion[], separator = " · "): string {
  if (!answers) return "";
  const parts: string[] = [];
  for (const q of questions) {
    const v = answers[q.key];
    const keys = Array.isArray(v) ? v : typeof v === "string" ? [v] : [];
    const titles = keys.map((k) => q.options.find((o) => o.key === k)?.title || k);
    if (titles.length) parts.push(titles.join(", "));
  }
  return parts.join(separator);
}

// Reads utm_* from a query string once, for the lead (source, medium, campaign only)
export function utmFromSearch(search: string): LeadInput["utm"] {
  try {
    const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    const utm: Record<string, string> = {};
    for (const k of ["source", "medium", "campaign"]) {
      const v = params.get(`utm_${k}`);
      if (v) utm[k] = v.trim().slice(0, 100);
    }
    return Object.keys(utm).length ? utm : null;
  } catch {
    return null;
  }
}
