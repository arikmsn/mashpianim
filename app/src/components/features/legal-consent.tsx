"use client";

import Link from "next/link";
import { FileDown } from "lucide-react";
import { LEGAL_CONSENT_TEXT } from "@/lib/legal";
import { cn } from "@/lib/utils";

// The two legal checkboxes (owner, 2026-11-26), shared by the last registration step and the in-app gate:
// 1. the terms, platform rules, privacy and refunds policies (with the business's licence on delivered videos
//    spelled out under it, so both sides see it plainly), and
// 2. a separate, explicit consent to the platform using uploaded videos to promote itself.
// Both are required. Every document opens in a new tab, where it can be saved as PDF.
export interface LegalConsentValue {
  terms: boolean;
  videoPromo: boolean;
}

export function legalConsentComplete(v: LegalConsentValue): boolean {
  return v.terms && v.videoPromo;
}

const docLink = "font-semibold underline underline-offset-2 hover:opacity-80";

export function LegalConsent({
  persona,
  value,
  onChange,
  accentClassName = "accent-pink-600",
  className,
  showTerms = true,
  showVideoPromo = true,
}: {
  persona: "creator" | "brand";
  value: LegalConsentValue;
  onChange: (next: LegalConsentValue) => void;
  accentClassName?: string;
  className?: string;
  // The gate hides a box the account already ticked under the current version
  showTerms?: boolean;
  showVideoPromo?: boolean;
}) {
  const brand = persona === "brand";
  return (
    <div className={cn("space-y-3 text-[13px] leading-relaxed text-ink-700", className)}>
      {showTerms && (
        <div className="space-y-1.5">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={value.terms}
              onChange={(e) => onChange({ ...value, terms: e.target.checked })}
              className={cn("mt-0.5 h-5 w-5 shrink-0 rounded", accentClassName)}
              aria-describedby="legal-consent-license"
            />
            <span>
              קראתי ואני מסכים/ה ל
              <Link href="/terms" target="_blank" className={docLink}>תנאי השירות ולכללי השימוש בפלטפורמה</Link>, ל
              <Link href="/privacy" target="_blank" className={docLink}>מדיניות הפרטיות</Link> ול
              <Link href="/refunds" target="_blank" className={docLink}>מדיניות הביטולים וההחזרים</Link>.
            </span>
          </label>
          <p id="legal-consent-license" className="ms-8 rounded-lg bg-neutral-50 px-3 py-2 text-[12px] text-neutral-600">
            {brand ? LEGAL_CONSENT_TEXT.brandLicense : LEGAL_CONSENT_TEXT.creatorLicense}
          </p>
        </div>
      )}

      {showVideoPromo && (
        <div className="space-y-1.5">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={value.videoPromo}
              onChange={(e) => onChange({ ...value, videoPromo: e.target.checked })}
              className={cn("mt-0.5 h-5 w-5 shrink-0 rounded", accentClassName)}
              aria-describedby="legal-consent-promo-note"
            />
            <span>{brand ? LEGAL_CONSENT_TEXT.videoPromoBrand : LEGAL_CONSENT_TEXT.videoPromoCreator}</span>
          </label>
          <p id="legal-consent-promo-note" className="ms-8 text-[12px] text-neutral-500">{LEGAL_CONSENT_TEXT.videoPromoNote}</p>
        </div>
      )}

      <p className="flex flex-wrap items-center gap-x-1 text-[12px] text-neutral-500">
        <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
        <span>כל המסמכים זמינים לקריאה ולהורדה כ-PDF:</span>
        <Link href="/terms" target="_blank" className="underline hover:text-ink-900">תנאים</Link>·
        <Link href="/privacy" target="_blank" className="underline hover:text-ink-900">פרטיות</Link>·
        <Link href="/refunds" target="_blank" className="underline hover:text-ink-900">החזרים</Link>·
        <Link href="/accessibility" target="_blank" className="underline hover:text-ink-900">הצהרת נגישות ופנייה בנושא נגישות</Link>
      </p>
    </div>
  );
}
