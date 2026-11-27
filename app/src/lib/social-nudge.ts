// When the creator feed reminds a creator to add a TikTok/Instagram handle (pure, unit-tested).
// Owner, 2026-11-27: the handles are optional at registration (drop-off), so the app asks again later,
// gently: never on the first visit after signing up, never while the 5-video portfolio is still missing
// (that gate matters more), a few visits apart after each dismissal, and never again after MAX dismissals.
// The counters live in this browser's localStorage, so the cadence is per device; that is fine for a nudge.

export const NUDGE_STORAGE_KEY = "mashpian:social-nudge";
export const NUDGE_SESSION_KEY = "mashpian:social-nudge-visit";
export const NUDGE_FIRST_VISIT = 2; // the first time it may show: the second app visit on this device
export const NUDGE_GAP = 3; // visits to wait after a dismissal
export const NUDGE_MAX_DISMISSALS = 3; // after this many dismissals it stops for good

export interface SocialNudgeState {
  visits: number;
  dismissals: number;
  nextAt: number;
}

export const INITIAL_NUDGE_STATE: SocialNudgeState = { visits: 0, dismissals: 0, nextAt: NUDGE_FIRST_VISIT };

const count = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : fallback);

export function parseNudgeState(raw: string | null | undefined): SocialNudgeState {
  if (!raw) return { ...INITIAL_NUDGE_STATE };
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (!o || typeof o !== "object") return { ...INITIAL_NUDGE_STATE };
    return {
      visits: count(o.visits, 0),
      dismissals: count(o.dismissals, 0),
      nextAt: count(o.nextAt, NUDGE_FIRST_VISIT),
    };
  } catch {
    return { ...INITIAL_NUDGE_STATE };
  }
}

export function hasSocialHandle(profile: { tiktok_handle?: unknown; instagram_handle?: unknown } | null | undefined): boolean {
  if (!profile) return false;
  const filled = (v: unknown) => typeof v === "string" && v.replace(/^@+/, "").trim().length > 0;
  return filled(profile.tiktok_handle) || filled(profile.instagram_handle);
}

export function recordVisit(state: SocialNudgeState): SocialNudgeState {
  return { ...state, visits: state.visits + 1 };
}

export function dismissNudge(state: SocialNudgeState): SocialNudgeState {
  return { ...state, dismissals: state.dismissals + 1, nextAt: state.visits + NUDGE_GAP };
}

export function shouldShowSocialNudge(input: { state: SocialNudgeState; hasHandle: boolean; portfolioComplete: boolean }): boolean {
  const { state, hasHandle, portfolioComplete } = input;
  if (hasHandle || !portfolioComplete) return false;
  if (state.dismissals >= NUDGE_MAX_DISMISSALS) return false;
  return state.visits >= state.nextAt;
}
