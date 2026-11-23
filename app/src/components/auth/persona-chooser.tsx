"use client";

import Link from "next/link";
import { Briefcase, UserRound } from "lucide-react";
import type { SectionContent } from "@/lib/site-content";
import type { Persona } from "@/lib/persona";
import { AuthShell } from "./auth-shell";

type AuthTexts = SectionContent<"auth">;

function PersonaCard({ persona, title, desc, cta, href, onPick }: { persona: Persona; title: string; desc: string; cta: string; href?: string; onPick?: (p: Persona) => void }) {
  const brand = persona === "brand";
  const cls = `relative mt-3 flex w-full flex-col gap-2.5 rounded-3xl border p-5 text-right ${brand ? "border-pink-200 bg-pink-100 text-pink-900" : "border-lemon-300 bg-lemon-100 text-lemon-900"}`;
  const inner = (
    <>
      <span className={`absolute left-4 top-4 rounded-full px-2.5 py-1.5 font-mono text-[10px] ${brand ? "bg-pink-600 text-white" : "bg-lemon-400 text-ink-900"}`}>{brand ? "BRANDS" : "CREATORS"}</span>
      <span className={`grid h-12 w-12 place-items-center rounded-full ${brand ? "bg-pink-600 text-white" : "bg-lemon-400 text-ink-900"}`}>
        {brand ? <Briefcase className="h-6 w-6" aria-hidden="true" /> : <UserRound className="h-6 w-6" aria-hidden="true" />}
      </span>
      <span className="font-display text-2xl leading-tight tracking-[-0.5px]">{title}</span>
      <span className="text-sm leading-relaxed">{desc}</span>
      <span className={`mt-1 inline-flex h-12 w-full items-center justify-center rounded-full text-base font-bold ${brand ? "bg-pink-600 text-white" : "bg-lemon-400 text-ink-900"}`}>{cta}</span>
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={() => onPick?.(persona)} className={cls}>
      {inner}
    </button>
  );
}

// The chooser ("who are you?"): the only screen where both colours appear together. Two coloured cards leading to the
// screen coloured like it (links on /login, a callback on /register after the phone was verified).
export function PersonaChooser({ texts, hrefFor, onPick }: { texts: AuthTexts; hrefFor?: (p: Persona) => string; onPick?: (p: Persona) => void }) {
  return (
    <AuthShell persona={null} brandName={texts.brand_name} homeLabel={texts.home_link} tag={texts.choose_tag} title={texts.choose_title} subtitle={texts.choose_subtitle} bottom={<span>{texts.both_note}</span>}>
      <div className="-m-5">
        <PersonaCard persona="brand" title={texts.brand_card_title} desc={texts.brand_card_desc} cta={texts.brand_card_cta} href={hrefFor?.("brand")} onPick={onPick} />
        <PersonaCard persona="creator" title={texts.creator_card_title} desc={texts.creator_card_desc} cta={texts.creator_card_cta} href={hrefFor?.("creator")} onPick={onPick} />
      </div>
    </AuthShell>
  );
}
