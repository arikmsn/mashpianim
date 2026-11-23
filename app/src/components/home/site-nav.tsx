"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { pill, pillCreator, pillPrimary, pillSmall } from "./styles";

export interface NavLink {
  label: string;
  href: string;
}

interface Props {
  brandName: string;
  links: NavLink[];
  loginLabel: string;
  loginHref: string;
  ctaCreator: string;
  ctaCreatorHref: string;
  ctaBrand: string;
  ctaBrandHref: string;
  menuLabel: string;
  menuClose: string;
  menuLogin: string;
}

// The home page navigation: transparent with light text over the dark hero, a floating white pill once the page
// scrolls. Four links and the login; on small screens a hamburger that opens a full sheet. Not the app's menu.
export function SiteNav(props: Props) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const light = !scrolled && !open;

  return (
    <div className="fixed inset-x-0 top-0 z-50 pointer-events-none">
      <div className={cn("mx-auto max-w-[1200px] transition-all duration-200", scrolled ? "px-3 pt-3 md:px-4" : "px-4 pt-3 md:px-6 md:pt-5")}>
        <nav
          aria-label={props.brandName}
          className={cn(
            "pointer-events-auto flex items-center justify-between gap-3 transition-all duration-200",
            scrolled ? "h-14 rounded-full border border-border bg-white/85 px-3 shadow-sm backdrop-blur-md md:px-4" : "h-14 px-0"
          )}
        >
          <Link href="/" className={cn("flex items-center gap-2.5 font-display text-[17px] md:text-[19px]", light ? "text-on-ink" : "text-ink-900")}>
            <Image src="/icon-192.png" alt="" width={34} height={34} unoptimized className="h-8 w-8 rounded-lg md:h-[34px] md:w-[34px]" />
            <span>{props.brandName}</span>
          </Link>

          <div className={cn("hidden items-center gap-7 text-[15px] font-medium lg:flex", light ? "text-on-ink/75" : "text-ink-700")}>
            {props.links.map((l) => (
              <a key={l.href} href={l.href} className={cn("transition-colors", light ? "hover:text-on-ink" : "hover:text-ink-900")}>
                {l.label}
              </a>
            ))}
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <Link href={props.loginHref} className={cn(pill, pillSmall, "px-3.5", light ? "text-on-ink/75 hover:text-on-ink" : "text-neutral-600 hover:bg-neutral-100")}>
              {props.loginLabel}
            </Link>
            <Link href={props.ctaCreatorHref} className={cn(pillCreator, pillSmall)}>
              {props.ctaCreator}
            </Link>
            <Link href={props.ctaBrandHref} className={cn(pillPrimary, pillSmall)}>
              {props.ctaBrand}
            </Link>
          </div>

          <div className="flex items-center gap-1 md:hidden">
            <Link href={props.loginHref} className={cn("px-2.5 py-2 text-sm font-semibold", light ? "text-on-ink/80" : "text-ink-700")}>
              {props.loginLabel}
            </Link>
            <button
              type="button"
              aria-label={open ? props.menuClose : props.menuLabel}
              aria-expanded={open}
              aria-controls="home-menu"
              onClick={() => setOpen((v) => !v)}
              className={cn("rounded-full p-2", light ? "text-on-ink" : "text-ink-900")}
            >
              {open ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
            </button>
          </div>
        </nav>
      </div>

      {open && (
        <div id="home-menu" className="pointer-events-auto fixed inset-0 top-[72px] z-40 flex flex-col bg-canvas px-5 pb-8 pt-4 md:hidden" role="dialog" aria-modal="true">
          <nav className="flex flex-col divide-y divide-border">
            {props.links.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="py-4 font-display text-[25px] text-ink-900">
                {l.label}
              </a>
            ))}
          </nav>
          <div className="mt-6 flex flex-col gap-3">
            <Link href={props.ctaBrandHref} className={pillPrimary} onClick={() => setOpen(false)}>
              {props.ctaBrand}
            </Link>
            <Link href={props.ctaCreatorHref} className={pillCreator} onClick={() => setOpen(false)}>
              {props.ctaCreator}
            </Link>
          </div>
          <Link href={props.loginHref} className="mt-auto py-3 text-center text-sm font-semibold text-neutral-600" onClick={() => setOpen(false)}>
            {props.menuLogin}
          </Link>
        </div>
      )}
    </div>
  );
}
