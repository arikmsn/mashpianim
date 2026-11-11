"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button, Modal } from "@/components/ui";
import { PROFILE_UPDATED_EVENT, readCache, writeCache } from "@/lib/client-cache";
import {
  hasSeen,
  markSeen,
  normalizeOnboarding,
  welcomeCards,
  type MomentCopy,
  type OnboardingHow,
  type OnboardingState,
  type OnboardingStep,
  type OnboardingUser,
} from "@/lib/onboarding";

export { firstHeartMoment as FIRST_HEART_MOMENT, FIRST_MATCH_MOMENT, type OnboardingUser } from "@/lib/onboarding";

// Reads the account's walkthrough flags from the profile the screen already loaded, and marks moments as seen:
// optimistic locally, mirrored into the cached /api/profile (so other screens agree at once), then POST.
export function useOnboarding(user: OnboardingUser | null | undefined) {
  const [local, setLocal] = useState<OnboardingState>({});
  const state = useMemo(() => ({ ...normalizeOnboarding(user?.onboarding), ...local }), [user, local]);
  const ready = !!user;

  const seen = useCallback((step: OnboardingStep) => hasSeen(state, step), [state]);

  const mark = useCallback(
    async (step: OnboardingStep, how: Exclude<OnboardingHow, "backfill">) => {
      if (hasSeen(state, step)) return;
      const next = markSeen(state, step, how);
      setLocal((prev) => ({ ...prev, [step]: next[step] }));
      try {
        const cached = readCache<{ user?: Record<string, unknown> }>("/api/profile");
        if (cached?.user) {
          writeCache("/api/profile", { ...cached, user: { ...cached.user, onboarding: next } });
          window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
        }
      } catch {
        // cache is a convenience only
      }
      try {
        await fetch("/api/onboarding/seen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ step, how }),
        });
      } catch {
        // offline: the moment shows again next time, which is acceptable
      }
    },
    [state]
  );

  return useMemo(() => ({ ready, state, seen, mark }), [ready, state, seen, mark]);
}

const SWIPE_PX = 40;

interface WelcomeSheetProps {
  open: boolean;
  portfolioCount: number | null | undefined;
  // "done" = finished the cards, "skipped" = "דלג" or closed early; both count as seen
  onDone: (how: "done" | "skipped") => void;
}

// The 20-second welcome: one card at a time, dots, swipe or "הבא", "דלג" always visible. The Modal mounts its
// children only while open, so the card index below starts from the first card on every opening.
export function WelcomeSheet({ open, portfolioCount, onDone }: WelcomeSheetProps) {
  return (
    <Modal open={open} onClose={() => onDone("skipped")} size="sm">
      <WelcomeCards portfolioCount={portfolioCount} onDone={onDone} />
    </Modal>
  );
}

function WelcomeCards({ portfolioCount, onDone }: Omit<WelcomeSheetProps, "open">) {
  const cards = useMemo(() => welcomeCards(portfolioCount), [portfolioCount]);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const touchX = useRef<number | null>(null);

  const last = index >= cards.length - 1;
  const card = cards[Math.min(index, cards.length - 1)];

  function goTo(next: number) {
    if (next < 0 || next >= cards.length) return;
    setDirection(next > index ? 1 : -1);
    setIndex(next);
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    // RTL: the next card sits to the left, so a swipe leftwards advances
    if (dx < -SWIPE_PX) goTo(index + 1);
    else if (dx > SWIPE_PX) goTo(index - 1);
  }

  if (!card) return null;

  return (
    <div className="space-y-4" onTouchStart={(e) => (touchX.current = e.touches[0].clientX)} onTouchEnd={onTouchEnd}>
        <div className="flex items-center justify-between -mt-2">
          <span className="text-xs text-neutral-400 tabular-nums">
            {index + 1}/{cards.length}
          </span>
          <button type="button" onClick={() => onDone("skipped")} className="text-xs text-neutral-500 hover:text-neutral-800 px-2 py-1 -ml-2 rounded-lg">
            דלג
          </button>
        </div>

        <div className="relative min-h-[11rem] overflow-hidden">
          {/* Keyed so each card animates in on mount; no AnimatePresence exit (its "wait" mode could stall
              inside the frequently re-rendering feed and freeze the content on the first card) */}
          <motion.div
            key={index}
            initial={{ opacity: 0, x: direction > 0 ? -24 : 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.18 }}
            className="text-center space-y-3"
          >
            <span className="text-5xl block" aria-hidden="true">
              {card.icon}
            </span>
            <h3 className="text-lg font-bold text-neutral-900">{card.title}</h3>
            <p className="text-sm text-neutral-600 leading-relaxed px-1">{card.body}</p>
          </motion.div>
        </div>

        <div className="flex items-center justify-center gap-1.5" aria-hidden="true">
          {cards.map((_, i) => (
            <button
              key={i}
              type="button"
              tabIndex={-1}
              onClick={() => goTo(i)}
              className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-pink-500" : "w-1.5 bg-neutral-200"}`}
            />
          ))}
        </div>

        {last ? (
          <Button fullWidth onClick={() => onDone("done")}>
            הבנתי, יאללה 🚀
          </Button>
        ) : (
          <Button fullWidth onClick={() => goTo(index + 1)}>
            הבא
          </Button>
        )}
    </div>
  );
}

interface MomentSheetProps {
  open: boolean;
  moment: MomentCopy;
  onPrimary: () => void;
  onClose: () => void;
}

// A single-card moment ("הלב נשלח!", "יש מאטץ'!") with one action and a quiet way out
export function MomentSheet({ open, moment, onPrimary, onClose }: MomentSheetProps) {
  return (
    <Modal open={open} onClose={onClose} size="sm">
      <div className="text-center space-y-4">
        <span className="text-5xl block" aria-hidden="true">
          {moment.icon}
        </span>
        <h3 className="text-lg font-bold text-neutral-900">{moment.title}</h3>
        <div className="space-y-2">
          {moment.lines.map((line) => (
            <p key={line} className="text-sm text-neutral-600 leading-relaxed">
              {line}
            </p>
          ))}
        </div>
        <Button fullWidth onClick={onPrimary}>
          {moment.primary}
        </Button>
        <Button fullWidth variant="ghost" onClick={onClose}>
          {moment.secondary}
        </Button>
      </div>
    </Modal>
  );
}
