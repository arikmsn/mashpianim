// First-time walkthrough for creators (owner, 2026-11-11). Pure helpers; no framework imports (unit-tested).
//
// Three one-time "moments", each shown exactly once per account and recorded server-side in users.onboarding
// (migration 018) so a new phone, a cleared browser or a reinstalled PWA never brings them back:
//   welcome     — 3–4 cards on the first visit to the feed (after the terms gate): heart → match → brief/product/video
//   first_heart — right after the first heart ever: what happens next and where to look (חיבורים)
//   first_match — when the first match appears in חיבורים: what a match means and the way to the brief in the chat
// "דלג" (skip) counts as seen, like finishing; we only remember *how* it ended for later statistics.
// The side menu can replay the welcome cards any time ("איך זה עובד?").
//
// All the wording is editable in /admin ("content" → the two "הסבר ליוצר" sections), exactly like the landing
// text: ONBOARDING_CONTENT_DEFAULTS below are the defaults, the admin stores overrides in `site_content`
// (sections ONBOARDING_WELCOME_SECTION / ONBOARDING_MOMENTS_SECTION), and the builders read overrides with
// these defaults as the fallback. Emojis/icons stay in code.

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

// ---- Editable copy (admin → content) -------------------------------------------------------------------

export const ONBOARDING_WELCOME_SECTION = "onboarding_welcome";
export const ONBOARDING_MOMENTS_SECTION = "onboarding_moments";

// Defaults = the approved copy. The admin overrides individual keys in `site_content`; the builders below read
// {...defaults, ...overrides}. Keys here are the single source of truth — the admin editor and the content API
// import them, so nothing drifts.
export const ONBOARDING_CONTENT_DEFAULTS: { [ONBOARDING_WELCOME_SECTION]: Record<string, string>; [ONBOARDING_MOMENTS_SECTION]: Record<string, string> } = {
  [ONBOARDING_WELCOME_SECTION]: {
    card_portfolio_title: "קודם, 5 סרטונים לתיק העבודות",
    card_portfolio_body: "העסקים בוחרים יוצרים לפי התיק. העלו 5 סרטונים קצרים שמראים אתכם, וזה מה שפותח את הלבבות.",
    card_heart_title: "לב = אני רוצה את המוצר הזה",
    card_heart_body: "גללו בין המוצרים. מתאים לכם? לחצו ❤️. לא מתאים? ✕, והוא לא יחזור.",
    card_match_title: "העסק מאשר, וזה מאטץ'",
    card_match_body: "הלב מגיע לעסק. כשהוא מאשר נוצר מאטץ', נפתח צ'אט ותקבלו התראה. גם עסקים שולחים לבבות אליכם, ואותם מאשרים במסך חיבורים.",
    card_deliver_title: "בריף, מוצר, סרטון",
    card_deliver_body: "בצ'אט מחכה הבריף: מה לצלם ואיך. מאשרים, העסק שולח את המוצר, מצלמים ומעלים כאן. העסק מאשר, והמוצר נשאר אצלכם.",
  },
  [ONBOARDING_MOMENTS_SECTION]: {
    heart_title: "הלב נשלח!",
    heart_body: "עכשיו זה אצל העסק. כשהוא יאשר, זה מאטץ': תקבלו התראה והחיבור יופיע במסך חיבורים.",
    heart_more: "בינתיים אפשר להמשיך לשלוח לבבות למוצרים נוספים.",
    heart_primary: "למסך חיבורים",
    heart_secondary: "להמשיך לגלול",
    heart_mutual_title: "יש מאטץ' ראשוני!",
    heart_mutual_body: "העסק הזה כבר שלח לך לב. עכשיו הוא מאשר סופית, ואז נפתח צ'אט ותקבלו התראה. הכול מרוכז במסך חיבורים.",
    match_title: "יש מאטץ'!",
    match_body: "העסק בחר בך. מכאן: קוראים את הבריף בצ'אט ומאשרים, העסק שולח את המוצר, מצלמים לפי הבריף ומעלים.",
    match_primary: "לצ'אט עם העסק",
    match_secondary: "סגירה",
  },
};

export interface OnboardingContent {
  welcome: Record<string, string>;
  moments: Record<string, string>;
}

// Merges the content object from GET /api/admin/content (a map of section id → key/value) over the defaults.
// Only known keys matter to the builders; unknown keys are ignored.
export function mergeOnboardingContent(raw: unknown): OnboardingContent {
  const byId = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const pick = (section: string): Record<string, string> => {
    const stored = byId[section];
    const base = { ...ONBOARDING_CONTENT_DEFAULTS[section as keyof typeof ONBOARDING_CONTENT_DEFAULTS] };
    if (stored && typeof stored === "object" && !Array.isArray(stored)) {
      for (const [k, v] of Object.entries(stored as Record<string, unknown>)) {
        if (typeof v === "string" && v.trim() !== "" && k in base) base[k] = v;
      }
    }
    return base;
  };
  return { welcome: pick(ONBOARDING_WELCOME_SECTION), moments: pick(ONBOARDING_MOMENTS_SECTION) };
}

export const DEFAULT_ONBOARDING_CONTENT: OnboardingContent = mergeOnboardingContent(null);

function text(content: Record<string, string> | null | undefined, section: typeof ONBOARDING_WELCOME_SECTION | typeof ONBOARDING_MOMENTS_SECTION, key: string): string {
  const v = content?.[key];
  if (typeof v === "string" && v.trim() !== "") return v;
  return ONBOARDING_CONTENT_DEFAULTS[section][key];
}

export interface WelcomeCard {
  icon: string;
  title: string;
  body: string;
}

// Three cards; a fourth one first when the portfolio is still short (the gate the creator will hit otherwise).
// `content` is the merged welcome section (OnboardingContent.welcome) or undefined for the defaults.
export function welcomeCards(portfolioCount: number | null | undefined, content?: Record<string, string>): WelcomeCard[] {
  const t = (key: string) => text(content, ONBOARDING_WELCOME_SECTION, key);
  const cards: WelcomeCard[] = [];
  if (typeof portfolioCount === "number" && portfolioCount < MIN_PORTFOLIO_FOR_HEARTS) {
    cards.push({ icon: "🎬", title: t("card_portfolio_title"), body: t("card_portfolio_body") });
  }
  cards.push(
    { icon: "❤️", title: t("card_heart_title"), body: t("card_heart_body") },
    { icon: "🤝", title: t("card_match_title"), body: t("card_match_body") },
    { icon: "📦", title: t("card_deliver_title"), body: t("card_deliver_body") }
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

// After the first heart: "mutual" = the business had hearted first, so the match only waits for its confirmation.
// `content` is the merged moments section (OnboardingContent.moments) or undefined for the defaults.
export function firstHeartMoment(mutual: boolean, content?: Record<string, string>): MomentCopy {
  const t = (key: string) => text(content, ONBOARDING_MOMENTS_SECTION, key);
  return {
    icon: mutual ? "🎉" : "❤️",
    title: mutual ? t("heart_mutual_title") : t("heart_title"),
    lines: [mutual ? t("heart_mutual_body") : t("heart_body"), t("heart_more")],
    primary: t("heart_primary"),
    secondary: t("heart_secondary"),
  };
}

export function firstMatchMoment(content?: Record<string, string>): MomentCopy {
  const t = (key: string) => text(content, ONBOARDING_MOMENTS_SECTION, key);
  return {
    icon: "🎉",
    title: t("match_title"),
    lines: [t("match_body")],
    primary: t("match_primary"),
    secondary: t("match_secondary"),
  };
}
