"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { tagClass } from "./styles";

// The fan of tilted 9:16 creator posters under the hero headline: real portfolio videos from the system (the
// admin curates the list in /admin/content). Posters everywhere, a single <video> at a time: the middle tile
// plays by itself (muted, looping) and a tap or hover moves the playback to another tile. Never a <video>
// per tile (CLAUDE.md), never autoplay when the visitor prefers reduced motion. Opens from flat to the fan once.
export interface FanTile {
  video_url: string;
  poster_url: string;
  caption: string;
  tag: string;
}

interface Props {
  // The admin's list (content registry); missing keys are tolerated
  tiles: Record<string, string>[];
  autoplay: boolean;
  label: string;
  counterLine: string;
  demoNote: string;
}

export function CreatorFan({ tiles, autoplay, label, counterLine, demoNote }: Props) {
  const reduce = useReducedMotion();
  const list: FanTile[] = tiles
    .map((t) => ({ video_url: t.video_url || "", poster_url: t.poster_url || "", caption: t.caption || "", tag: t.tag || "" }))
    .filter((t) => t.poster_url)
    .slice(0, 8);
  const n = list.length;
  const centre = (n - 1) / 2;
  const middle = Math.round(centre);
  const [picked, setPicked] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  // The middle tile plays by itself unless the visitor prefers reduced motion; a tap or hover picks another
  const active = picked ?? (autoplay && !reduce && n > 0 ? middle : null);
  const setActive = (i: number) => {
    if (i !== picked) setPlaying(false);
    setPicked(i);
  };

  // The small screens show the four middle tiles
  const mobileStart = Math.max(0, Math.min(n - 4, Math.floor(centre) - 1));

  if (n === 0) return null;

  return (
    <div className="relative">
      <div className="flex items-end justify-center gap-2 px-2 md:gap-3" aria-label={label} role="group">
        {list.map((t, i) => {
          const offset = i - centre;
          const rotate = n > 1 ? (offset / Math.max(1, centre)) * 7 : 0;
          const lift = Math.round((Math.abs(offset) / Math.max(1, centre)) * 64);
          const onMobile = i >= mobileStart && i < mobileStart + 4;
          const isActive = active === i;
          return (
            <motion.div
              key={`${t.video_url}-${i}`}
              className={cn(
                "group relative aspect-[9/16] w-[108px] shrink-0 cursor-pointer overflow-hidden rounded-xl bg-ink-700 shadow-[0_24px_60px_#00000066] sm:w-[120px] md:w-[150px] lg:w-[168px]",
                !onMobile && "hidden md:block",
                i === middle && "shadow-[0_32px_80px_#00000099]"
              )}
              style={{ marginTop: lift }}
              initial={reduce ? false : { rotate: 0, opacity: 0, y: 24 }}
              whileInView={{ rotate, opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-20px" }}
              transition={{ duration: 0.6, delay: 0.05 * i, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => setActive(i)}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              tabIndex={0}
              role="button"
              aria-label={t.caption}
              aria-pressed={isActive}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.poster_url} alt="" className="absolute inset-0 h-full w-full object-cover" loading={onMobile ? "eager" : "lazy"} decoding="async" />
              {isActive && (
                <video
                  key={t.video_url}
                  src={t.video_url}
                  poster={t.poster_url}
                  muted
                  playsInline
                  autoPlay
                  loop
                  preload="metadata"
                  onPlaying={() => setPlaying(true)}
                  onWaiting={() => setPlaying(false)}
                  className={cn("absolute inset-0 h-full w-full object-cover transition-opacity duration-300", playing ? "opacity-100" : "opacity-0")}
                />
              )}
              {t.tag && (
                <span className={cn("absolute left-2 top-2 rounded-full border border-on-ink/20 bg-surface-ink/80 px-2 py-1.5 text-[10px] font-medium leading-none text-on-ink md:text-[11px]", tagClass(t.tag))}>{t.tag}</span>
              )}
              {t.caption && (
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2.5 pt-7 text-[11px] font-medium text-on-ink md:text-xs">{t.caption}</span>
              )}
            </motion.div>
          );
        })}
      </div>
      {(counterLine || demoNote) && (
        <div className="relative z-[2] mt-4 text-center">
          {counterLine && <span className={cn("text-[11px] text-on-ink/60 md:text-xs", tagClass(counterLine))}>{counterLine}</span>}
          {demoNote && <span className="mt-1.5 block text-xs text-on-ink/40">{demoNote}</span>}
        </div>
      )}
    </div>
  );
}
