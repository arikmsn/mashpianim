"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Briefcase, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Persona } from "@/lib/persona";

// The persona-coloured frame of the login and register screens (design package v3, AuthScreen): the page
// background and glow, the top row, the identity chip, the Rubik 900 title, the optional progress line and the
// white card. Everything inside reads --persona-* from data-persona on <main>; no direct pink or lemon here.
interface Props {
  persona: Persona | null;
  brandName: string;
  homeLabel: string;
  chip?: string;
  tag?: string;
  title: string;
  subtitle?: string;
  progress?: { current: number; total: number; hint?: string } | null;
  children: ReactNode;
  below?: ReactNode;
  bottom?: ReactNode;
  onTitleClick?: () => void;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

export function AuthShell({ persona, brandName, homeLabel, chip, tag, title, subtitle, progress, children, below, bottom, onTitleClick }: Props) {
  return (
    <main
      data-persona={persona || undefined}
      className={cn("flex min-h-screen flex-col px-4 pb-7 pt-3.5", persona ? "bg-persona-page" : "bg-canvas")}
      style={{ backgroundImage: persona ? "radial-gradient(90% 40% at 50% 0%, var(--persona-soft) 0%, transparent 70%)" : "radial-gradient(90% 40% at 50% 0%, var(--surface-2) 0%, transparent 70%)" }}
    >
      <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col">
        <div className="flex h-11 items-center justify-between">
          <Link href="/" className="flex items-center gap-1.5 text-sm text-neutral-600 hover:text-ink-900">
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
            {homeLabel}
          </Link>
          <div className="flex items-center gap-2 font-display text-base text-ink-900">
            <Image src="/icon-192.png" alt="" width={30} height={30} unoptimized className="h-[30px] w-[30px] rounded-lg" />
            {brandName}
          </div>
        </div>

        <div className="mt-6 flex flex-col items-start gap-3">
          {chip && persona && (
            <span className="inline-flex items-center gap-2 rounded-full bg-persona px-3.5 py-2.5 text-[13px] font-bold leading-none text-persona-fg">
              {persona === "brand" ? <Briefcase className="h-4 w-4" aria-hidden="true" /> : <UserRound className="h-4 w-4" aria-hidden="true" />}
              {chip}
            </span>
          )}
          {tag && !chip && <span className="font-mono text-[11px] text-neutral-500">{tag}</span>}
          <h1 className="font-display text-[32px] leading-[1.08] tracking-[-1px] text-ink-900 cursor-default select-none" onClick={onTitleClick}>
            {title}
          </h1>
          {subtitle && <p className="text-[15px] leading-relaxed text-ink-700">{subtitle}</p>}
        </div>

        {progress && (
          <div className="mt-5">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-xs text-persona-ink">
                {pad2(progress.current)} / {pad2(progress.total)}
              </span>
              <div className="flex flex-1 gap-1.5">
                {Array.from({ length: progress.total }).map((_, i) => (
                  <span key={i} className={cn("h-1 flex-1 rounded-full transition-colors", i < progress.current ? "bg-persona" : "bg-border")} />
                ))}
              </div>
            </div>
            {progress.hint && <div className="mt-1.5 text-xs text-neutral-500">{progress.hint}</div>}
          </div>
        )}

        <div className="mt-4 rounded-3xl border border-border bg-white p-5 shadow-[0_12px_32px_#0b051d12]">{children}</div>

        {below}

        {bottom && <div className="mt-auto pt-5 text-center text-[11px] leading-relaxed text-neutral-500">{bottom}</div>}
      </div>
    </main>
  );
}

// The "wrong account?" line with the other side's chip: the switch that colour alone cannot provide
export function PersonaSwap({ label, chipLabel, target, href, onClick }: { label: string; chipLabel: string; target: Persona; href?: string; onClick?: () => void }) {
  const chipCls = cn("inline-flex items-center rounded-full px-2.5 py-[7px] text-xs font-bold leading-none", target === "brand" ? "bg-pink-600 text-white" : "bg-lemon-400 text-ink-900");
  return (
    <div className="mt-2 flex items-center justify-center gap-2 text-[13px] text-neutral-600">
      <span>{label}</span>
      {href ? (
        <Link href={href} className={chipCls}>
          {chipLabel}
        </Link>
      ) : (
        <button type="button" onClick={onClick} className={chipCls}>
          {chipLabel}
        </button>
      )}
    </div>
  );
}

export function SwapLine({ label, linkLabel, href, onClick }: { label: string; linkLabel: string; href?: string; onClick?: () => void }) {
  const cls = "font-bold text-persona-ink border-b-[1.5px] border-current";
  return (
    <div className="mt-3.5 flex items-center justify-center gap-2 text-[13px] text-neutral-600">
      <span>{label}</span>
      {href ? (
        <Link href={href} className={cls}>
          {linkLabel}
        </Link>
      ) : (
        <button type="button" onClick={onClick} className={cls}>
          {linkLabel}
        </button>
      )}
    </div>
  );
}

// The full-width identity button inside the card
export const personaButton = "inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-persona text-base font-bold text-persona-fg transition-opacity hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";
export const authField = "w-full rounded-[14px] border border-border-strong bg-white px-3.5 py-3 text-base text-ink-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-ink-900 focus:ring-2 focus:ring-focus-ring/15";
export const authLabel = "mb-1.5 block text-[13px] font-medium text-neutral-700";
