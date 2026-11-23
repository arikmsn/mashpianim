"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { tagClass } from "./styles";

// The strip of 9:16 creator posters under the hero headline: real portfolio videos from the system (the admin
// curates the list in /admin/content). Posters everywhere and a single <video> at a time (CLAUDE.md).
// Phone (below md): the strip is a marquee that never stands still, so the options are visible without a mouse
// or a tap; the tile passing the middle of the screen plays muted, a tap pins a tile (and pauses the marquee),
// a second tap releases it. Desktop (md and up): the tilted fan, one tile plays and the playback walks to the
// next every few seconds; hover or click pins. Nothing plays off screen or under prefers-reduced-motion.
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

const CYCLE_MS = 7000; // desktop: the playback walks to the next tile
const SCAN_MS = 400; // phone: which tile is passing the middle of the strip
const WIDE = "(min-width: 768px)";

function subscribeWide(onChange: () => void) {
  const mq = window.matchMedia(WIDE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
const readWide = () => window.matchMedia(WIDE).matches;
const serverWide = () => false;

export function CreatorFan({ tiles, autoplay, label, counterLine, demoNote }: Props) {
  const reduce = useReducedMotion();
  const wide = useSyncExternalStore(subscribeWide, readWide, serverWide);
  const list: FanTile[] = tiles
    .map((t) => ({ video_url: t.video_url || "", poster_url: t.poster_url || "", caption: t.caption || "", tag: t.tag || "" }))
    .filter((t) => t.poster_url)
    .slice(0, 8);
  const n = list.length;
  const centre = (n - 1) / 2;
  const middle = Math.round(centre);
  // Tile positions are counted over both copies of the list (the phone marquee): 0..n-1 and n..2n-1
  const [picked, setPicked] = useState<number | null>(null);
  const [auto, setAuto] = useState<number>(middle);
  const [inView, setInView] = useState(false);
  const [playing, setPlaying] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef<(HTMLDivElement | null)[]>([]);
  const canPlay = autoplay && !reduce && n > 0;
  const active = canPlay ? (picked ?? auto) : picked;

  // Only while the strip is on screen: no playback, no walking, no scanning for a visitor who scrolled past
  useEffect(() => {
    const el = frameRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Desktop: the playback walks around the fan until the visitor pins a tile
  useEffect(() => {
    if (!wide || !canPlay || !inView || picked !== null || n < 2) return;
    const id = window.setInterval(() => setAuto((a) => (a + 1) % n), CYCLE_MS);
    return () => window.clearInterval(id);
  }, [wide, canPlay, inView, picked, n]);

  // Phone: the tile passing the middle of the strip is the one that plays (the marquee keeps moving under it)
  useEffect(() => {
    if (wide || !canPlay || !inView || picked !== null) return;
    const id = window.setInterval(() => {
      const frame = frameRef.current;
      if (!frame) return;
      const c = frame.getBoundingClientRect();
      const cx = c.left + c.width / 2;
      let best = -1;
      let bestD = Infinity;
      tileRefs.current.forEach((el, i) => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        if (!r.width) return;
        const d = Math.abs(r.left + r.width / 2 - cx);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      if (best >= 0) setAuto((a) => (a === best ? a : best));
    }, SCAN_MS);
    return () => window.clearInterval(id);
  }, [wide, canPlay, inView, picked]);

  const pin = (k: number) => {
    if (k !== active) setPlaying(false);
    setPicked(k);
  };
  // A tap pins; a second tap on the pinned tile releases it (the marquee moves again)
  const toggle = (k: number) => {
    if (picked === k) setPicked(null);
    else pin(k);
  };

  if (n === 0) return null;

  // Two copies of the list make the phone marquee a seamless loop; the second copy is hidden from md up
  const copies = [0, 1] as const;
  const paused = !wide && (picked !== null || !inView);

  return (
    <motion.div
      className="relative"
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-20px" }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <div ref={frameRef} className="-mx-4 overflow-hidden md:mx-0 md:overflow-visible" role="group" aria-label={label}>
        <div className="fan-track flex w-max items-end md:w-auto md:justify-center" data-paused={paused ? "true" : undefined}>
          {copies.map((copy) => (
            <div
              key={copy}
              className={cn("flex items-end gap-2.5 pb-6 pe-2.5 pt-2 md:gap-3 md:pb-0 md:pe-0", copy === 1 && "md:hidden")}
              aria-hidden={copy === 1 || undefined}
            >
              {list.map((t, i) => {
                const k = copy * n + i;
                const offset = i - centre;
                const rotate = n > 1 ? (offset / Math.max(1, centre)) * 7 : 0;
                const lift = Math.round((Math.abs(offset) / Math.max(1, centre)) * 64);
                const isActive = active === k;
                return (
                  <div
                    key={`${t.video_url}-${k}`}
                    ref={(el) => {
                      tileRefs.current[k] = el;
                    }}
                    className={cn(
                      "group relative aspect-[9/16] w-[132px] shrink-0 cursor-pointer overflow-hidden rounded-xl bg-ink-700 shadow-[0_24px_60px_#00000066] transition-[box-shadow] sm:w-[140px] md:w-[150px] md:[transform:rotate(var(--rot))] lg:w-[168px]",
                      isActive && "ring-2 ring-lemon-400/80",
                      i === middle && "shadow-[0_32px_80px_#00000099]"
                    )}
                    style={{ "--rot": `${rotate}deg`, marginTop: lift } as React.CSSProperties}
                    onClick={() => toggle(k)}
                    onMouseEnter={() => {
                      if (wide) pin(k);
                    }}
                    onFocus={() => {
                      if (wide) pin(k);
                    }}
                    tabIndex={copy === 1 ? -1 : 0}
                    role="button"
                    aria-label={t.caption}
                    aria-pressed={isActive}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={t.poster_url} alt="" className="absolute inset-0 h-full w-full object-cover" loading={copy === 0 && Math.abs(offset) <= 2 ? "eager" : "lazy"} decoding="async" />
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
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {(counterLine || demoNote) && (
        <div className="relative z-[2] mt-1 text-center md:mt-4">
          {counterLine && <span className={cn("text-[11px] text-on-ink/60 md:text-xs", tagClass(counterLine))}>{counterLine}</span>}
          {demoNote && <span className="mt-1.5 block text-xs text-on-ink/40">{demoNote}</span>}
        </div>
      )}
    </motion.div>
  );
}
