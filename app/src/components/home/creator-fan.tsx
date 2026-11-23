"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { tagClass } from "./styles";

// The fan of tilted 9:16 creator posters under the hero headline: real portfolio videos from the system (the
// admin curates the list in /admin/content). Posters everywhere, a single <video> at a time: one tile plays
// (muted, looping) and the playback walks from tile to tile every few seconds, so the hero lives on a phone
// where there is no hover; a tap or hover pins a tile. On small screens the fan is a swipeable strip that
// follows the playing tile. Never a <video> per tile (CLAUDE.md), nothing plays off-screen or under
// prefers-reduced-motion.
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

const CYCLE_MS = 7000;

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
  const [auto, setAuto] = useState<number>(middle);
  const [inView, setInView] = useState(false);
  const [playing, setPlaying] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef<(HTMLDivElement | null)[]>([]);
  const canPlay = autoplay && !reduce && n > 0;
  const active = canPlay ? (picked ?? auto) : picked;

  // Only while the fan is on screen: no playback and no cycling for a visitor who scrolled past
  useEffect(() => {
    const el = stripRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // The playback walks around the fan until the visitor pins a tile
  useEffect(() => {
    if (!canPlay || !inView || picked !== null || n < 2) return;
    const id = window.setInterval(() => setAuto((a) => (a + 1) % n), CYCLE_MS);
    return () => window.clearInterval(id);
  }, [canPlay, inView, picked, n]);

  // On the swipeable strip the playing tile is brought to the middle of the screen
  useEffect(() => {
    if (active === null || !inView) return;
    const strip = stripRef.current;
    const tile = tileRefs.current[active];
    if (!strip || !tile) return;
    const scrollable = strip.scrollWidth > strip.clientWidth + 8;
    if (!scrollable) return;
    const c = strip.getBoundingClientRect();
    const t = tile.getBoundingClientRect();
    strip.scrollBy({ left: t.left + t.width / 2 - (c.left + c.width / 2), behavior: reduce ? "auto" : "smooth" });
  }, [active, inView, reduce]);

  const pin = (i: number) => {
    if (i !== active) setPlaying(false);
    setPicked(i);
  };

  if (n === 0) return null;

  return (
    <div className="relative">
      <div
        ref={stripRef}
        className="flex items-end gap-2.5 overflow-x-auto px-6 pb-6 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory md:snap-none md:justify-center md:gap-3 md:overflow-visible md:px-2 md:pb-0"
        aria-label={label}
        role="group"
      >
        {list.map((t, i) => {
          const offset = i - centre;
          const rotate = n > 1 ? (offset / Math.max(1, centre)) * 7 : 0;
          const lift = Math.round((Math.abs(offset) / Math.max(1, centre)) * 64);
          const isActive = active === i;
          return (
            <motion.div
              key={`${t.video_url}-${i}`}
              ref={(el) => {
                tileRefs.current[i] = el;
              }}
              className={cn(
                "group relative aspect-[9/16] w-[132px] shrink-0 cursor-pointer snap-center overflow-hidden rounded-xl bg-ink-700 shadow-[0_24px_60px_#00000066] transition-[box-shadow] sm:w-[140px] md:w-[150px] md:[transform:rotate(var(--rot))] lg:w-[168px]",
                isActive && "ring-2 ring-lemon-400/80",
                i === middle && "shadow-[0_32px_80px_#00000099]"
              )}
              style={{ "--rot": `${rotate}deg`, marginTop: lift } as React.CSSProperties}
              initial={reduce ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-20px" }}
              transition={{ duration: 0.6, delay: 0.05 * i, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => pin(i)}
              onMouseEnter={() => pin(i)}
              onFocus={() => pin(i)}
              tabIndex={0}
              role="button"
              aria-label={t.caption}
              aria-pressed={isActive}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.poster_url} alt="" className="absolute inset-0 h-full w-full object-cover" loading={Math.abs(offset) <= 2 ? "eager" : "lazy"} decoding="async" />
              {isActive && inView && t.video_url && (
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
        <div className="relative z-[2] mt-1 text-center md:mt-4">
          {counterLine && <span className={cn("text-[11px] text-on-ink/60 md:text-xs", tagClass(counterLine))}>{counterLine}</span>}
          {demoNote && <span className="mt-1.5 block text-xs text-on-ink/40">{demoNote}</span>}
        </div>
      )}
    </div>
  );
}
