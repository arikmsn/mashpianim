"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLandingCreators } from "./use-landing-creators";

// Seven tilted 9:16 posters under the hero headline (four on small screens). Posters only, never a <video> in
// a list. Opens once from flat to the fan when it scrolls into view. Placeholders are plain coloured tiles with
// a mono tag and the demo note underneath (no made-up people).
const TILES: { rotate: number; lift: number; color: string; tag: "UGC" | "POST"; mobile: boolean }[] = [
  { rotate: -7, lift: 64, color: "#7a6a73", tag: "UGC", mobile: false },
  { rotate: -4, lift: 34, color: "#8fa3b5", tag: "POST", mobile: true },
  { rotate: -2, lift: 12, color: "#b9b09a", tag: "UGC", mobile: true },
  { rotate: 0, lift: 0, color: "#c9a6a0", tag: "UGC", mobile: true },
  { rotate: 2, lift: 12, color: "#a58b94", tag: "UGC", mobile: true },
  { rotate: 4, lift: 34, color: "#7f8c7a", tag: "POST", mobile: false },
  { rotate: 7, lift: 64, color: "#b39a7e", tag: "UGC", mobile: false },
];

export function CreatorFan({ label, counterLine, demoNote }: { label: string; counterLine: string; demoNote: string }) {
  const reduce = useReducedMotion();
  const { creators } = useLandingCreators();
  const real = creators && creators.length >= 4 ? creators : null;

  return (
    <div className="relative">
      <div className="flex items-end justify-center gap-2 px-2 md:gap-3" aria-label={label} role="group">
        {TILES.map((t, i) => {
          const creator = real?.[i];
          return (
            <motion.div
              key={i}
              className={cn(
                "relative aspect-[9/16] w-[108px] shrink-0 overflow-hidden rounded-xl shadow-[0_24px_60px_#00000066] sm:w-[120px] md:w-[150px] lg:w-[168px]",
                !t.mobile && "hidden md:block",
                i === 3 && "shadow-[0_32px_80px_#00000099]"
              )}
              style={{ backgroundColor: creator ? undefined : t.color, marginTop: t.lift }}
              initial={reduce ? false : { rotate: 0, opacity: 0, y: 24 }}
              whileInView={{ rotate: t.rotate, opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-20px" }}
              transition={{ duration: 0.6, delay: 0.05 * i, ease: [0.16, 1, 0.3, 1] }}
            >
              {creator ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={creator.poster} alt={`${creator.firstName}, ${creator.category}`} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
              ) : (
                <span className="absolute inset-0 grid place-items-center font-mono text-[11px] text-on-ink/60">9:16</span>
              )}
              <span className="absolute left-2 top-2 rounded-full border border-on-ink/20 bg-surface-ink/80 px-2 py-1.5 font-mono text-[10px] font-medium leading-none text-on-ink md:text-[11px]">
                {creator?.tag || t.tag}
              </span>
              {creator && (
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 pb-2.5 pt-6 text-xs font-medium text-on-ink">
                  {creator.firstName}, {creator.category}
                </span>
              )}
            </motion.div>
          );
        })}
      </div>
      <div className="relative z-[2] mt-4 text-center">
        <span className="font-mono text-[11px] text-on-ink/60 md:text-xs">{counterLine}</span>
        {!real && <span className="mt-1.5 block text-xs text-on-ink/40">{demoNote}</span>}
      </div>
    </div>
  );
}
