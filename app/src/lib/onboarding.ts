// First-time walkthrough for creators (owner, 2026-11-11). Pure helpers; no framework imports (unit-tested).
//
// Three one-time "moments", each shown exactly once per account and recorded server-side in users.onboarding
// (migration 018) so a new phone, a cleared browser or a reinstalled PWA never brings them back:
//   welcome     — 3–4 cards on the first visit to the feed (after the terms gate): heart → match → brief/product/video
//   first_heart — right after the first heart ever: what happens next and where to look (חיבורים)
//   first_match — when the first match appears in חיבורים: what a match means and the way to the brief in the chat
// "דלג" (skip) counts as seen, like finishing; we only remember *how* it ended for later statistics.
// The side menu can replay the welcome cards any time ("איך זה עובד?").

import { needsTermsAcceptance } from "./legal.ts";

export const ONBOARDING_STEPS = ["welcome", "first_heart", "first_match"] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const ONBOARDING_HOWS = ["done", "skipped", "backfill"] as const;
export type OnboardingHow = (typeof ONBOARDING_HOWS)[number];

export interface OnboardingMark {
  at: string;
  how: OnboardingHow;
}
export type OnboardingState = Partial<Record<OnboardingStep, OnboardingMark>>;

// The slice of the /api/profile `user` the walkthrough needs
export interface OnboardingUser {
  type?: string | null;
  onboarding?: OnboardingState | null;
  terms_accepted_at?: string | null;
  terms_version?: string | null;
}

export function isOnboardingStep(value: unknown): value is OnboardingStep {
  return typeof value === "string" && (ONBOARDING_STEPS as readonly string[]).includes(value);
}

// Only the two endings a client may report; "backfill" is written by migrations
export function isClientOnboardingHow(value: unknown): value is "done" | "skipped" {
  return value === "done" || value === "skipped";
}

export function normalizeOnboarding(value: unknown): OnboardingState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: OnboardingState = {};
  for (const step of ONBOARDING_STEPS) {
    const mark = (value as Record<string, unknown>)[step];
    if (mark && typeof mark === "object" && typeof (mark as { at?: unknown }).at === "string") {
      const how = (mark as { how?: unknown }).how;
      out[step] = { at: (mark as { at: string }).at, how: (ONBOARDING_HOWS as readonly unknown[]).includes(how) ? (how as OnboardingHow) : "done" };
    }
  }
  return out;
}

export function hasSeen(state: OnboardingState | null | undefined, step: OnboardingStep): boolean {
  return !!state && !!state[step]?.at;
}

// Returns a new state; never un-marks and never overwrites an existing mark (the first ending wins)
export function markSeen(state: OnboardingState | null | undefined, step: OnboardingStep, how: OnboardingHow, now: Date = new Date()): OnboardingState {
  const current = normalizeOnboarding(state);
  if (current[step]) return current;
  return { ...current, [step]: { at: now.toISOString(), how } };
}

// The welcome shows to creators (the session role), never to admins, only after the terms gate, and only once
export function shouldShowWelcome(params: { role: string | null | undefined; user: OnboardingUser | null | undefined; state: OnboardingState | null | undefined }): boolean {
  const { role, user, state } = params;
  if (!user || role !== "creator" || user.type === "admin") return false;
  if (needsTermsAcceptance(user)) return false;
  return !hasSeen(state, "welcome");
}

// A connection counts as a match once the brand confirmed it (the paid step); pending hearts and endings don't
export function isMatchedStatus(status: string | null | undefined): boolean {
  return !!status && !["pending", "rejected", "cancelled"].includes(status);
}

export const MIN_PORTFOLIO_FOR_HEARTS = 5;

export interface WelcomeCard {
  icon: string;
  title: string;
  body: string;
}

// Three cards; a fourth one first when the portfolio is still short (the gate the creator will hit otherwise)
export function welcomeCards(portfolioCount: number | null | undefined): WelcomeCard[] {
  const cards: WelcomeCard[] = [];
  if (typeof portfolioCount === "number" && portfolioCount < MIN_PORTFOLIO_FOR_HEARTS) {
    cards.push({
      icon: "🎬",
      title: `קודם, ${MIN_PORTFOLIO_FOR_HEARTS} סרטונים לתיק העבודות`,
      body: `העסקים בוחרים יוצרים לפי התיק. העלו ${MIN_PORTFOLIO_FOR_HEARTS} סרטונים קצרים שמראים אותך, וזה מה שפותח את הלבבות.`,
    });
  }
  cards.push(
    {
      icon: "❤️",
      title: "לב = אני רוצה את המוצר הזה",
      body: "גללו בין המוצרים. מתאים לכם? לחצו ❤️. לא מתאים? ✕, והוא לא יחזור.",
    },
    {
      icon: "🤝",
      title: "העסק מאשר, וזה מאטץ'",
      body: "הלב מגיע לעסק. כשהוא מאשר נוצר מאטץ', נפתח צ'אט ותקבלו התראה. גם עסקים שולחים לבבות אליכם, ואותם מאשרים במסך חיבורים.",
    },
    {
      icon: "📦",
      title: "בריף, מוצר, סרטון",
      body: "בצ'אט מחכה הבריף: מה לצלם ואיך. מאשרים, העסק שולח את המוצר, מצלמים ומעלים כאן. העסק מאשר, והמוצר נשאר אצלכם.",
    }
  );
  return cards;
}

export interface MomentCopy {
  icon: string;
  title: string;
  lines: string[];
  primary: string;
  secondary: string;
}

// After the first heart: "mutual" = the business had hearted first, so the match only waits for its confirmation
export function firstHeartMoment(mutual: boolean): MomentCopy {
  return {
    icon: mutual ? "🎉" : "❤️",
    title: mutual ? "יש מאטץ' ראשוני!" : "הלב נשלח!",
    lines: mutual
      ? ["העסק הזה כבר שלח לך לב. עכשיו הוא מאשר סופית, ואז נפתח צ'אט ותקבלו התראה. הכול מרוכז במסך חיבורים.", "בינתיים אפשר להמשיך לשלוח לבבות למוצרים נוספים."]
      : ["עכשיו זה אצל העסק. כשהוא יאשר, זה מאטץ': תקבלו התראה והחיבור יופיע במסך חיבורים.", "בינתיים אפשר להמשיך לשלוח לבבות למוצרים נוספים."],
    primary: "למסך חיבורים",
    secondary: "להמשיך לגלול",
  };
}

export const FIRST_MATCH_MOMENT: MomentCopy = {
  icon: "🎉",
  title: "יש מאטץ'!",
  lines: ["העסק בחר בך. מכאן: קוראים את הבריף בצ'אט ומאשרים, העסק שולח את המוצר, מצלמים לפי הבריף ומעלים."],
  primary: "לצ'אט עם העסק",
  secondary: "סגירה",
};
