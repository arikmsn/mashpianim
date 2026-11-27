"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Button, useToast } from "@/components/ui";
import { useAuth } from "@/hooks/use-auth";
import { PROFILE_UPDATED_EVENT, readCache, swrFetch, writeCache } from "@/lib/client-cache";
import { LEGAL_ORDER, needsTermsAcceptance, TERMS_POPUP, type LegalSlug } from "@/lib/legal";
import { mergeSiteContent, SITE_CONTENT_DEFAULTS, type SiteContent } from "@/lib/site-content";
import { LegalDocumentView, legalDoc } from "./legal-document";

// The legal texts as the admin last saved them (defaults from lib/legal.ts until the content arrives)
function useLegalContent(): SiteContent {
  const [content, setContent] = useState<SiteContent>(() => {
    const cached = readCache<{ content?: unknown }>("/api/admin/content");
    return cached?.content ? mergeSiteContent(cached.content) : SITE_CONTENT_DEFAULTS;
  });
  useEffect(() => {
    swrFetch<{ content?: unknown }>("/api/admin/content", (data) => {
      if (data?.content) setContent(mergeSiteContent(data.content));
    });
  }, []);
  return content;
}

// ---------------------------------------------------------------------------------------------------------------
// The read-only viewer behind "תנאי השירות" in the side menu: the documents as tabs, with a scrolling body
// ---------------------------------------------------------------------------------------------------------------
export function LegalModal({ open, onClose, initial = "terms" }: { open: boolean; onClose: () => void; initial?: LegalSlug }) {
  return <AnimatePresence>{open && <LegalModalPanel onClose={onClose} initial={initial} />}</AnimatePresence>;
}

function LegalModalPanel({ onClose, initial }: { onClose: () => void; initial: LegalSlug }) {
  // Mounted only while open, so the tab resets to `initial` each time
  const [tab, setTab] = useState<LegalSlug>(initial);
  const content = useLegalContent();
  const doc = legalDoc(content, tab);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[75]" role="dialog" aria-modal="true" aria-label={doc.title}>
      <motion.div className="absolute inset-0 bg-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        className="absolute inset-x-0 bottom-0 top-6 sm:inset-x-8 sm:inset-y-8 bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border">
          <div className="min-w-0">
            <h2 className="text-base font-bold truncate">{doc.title}</h2>
            <p className="text-[11px] text-neutral-500">{doc.updated_label}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 -ml-2 rounded-lg text-neutral-500 hover:bg-neutral-100" aria-label="סגירה">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex gap-1 px-4 pt-3">
          {LEGAL_ORDER.map((slug) => (
            <button
              key={slug}
              type="button"
              onClick={() => setTab(slug)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${tab === slug ? "bg-primary text-white" : "bg-neutral-50 text-neutral-600 hover:bg-neutral-100"}`}
            >
              {legalDoc(content, slug).short_title}
            </button>
          ))}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4">
          <LegalDocumentView body={doc.body} compact />
          <p className="mt-6 text-xs text-neutral-500 text-center">
            <Link href={`/${tab}`} target="_blank" className="text-pink-700 hover:underline">
              {content.legal_common.open_full}
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// The acceptance gate (owner, 2026-11-09): a creator or a business that has not accepted the current terms sees
// them full-screen on entering the app and must tick and confirm, or is signed out. Accepted once, never again
// (until the terms version changes: the admin bumps it on a material change). Rendered by the app layout.
// Since 2026-11-26 (owner: "not something heavy") it is a light popup on first entry with the key points (incl. the
// platform's promotional use of videos) and one button; the full documents open in a new tab, downloadable as PDF.
// ---------------------------------------------------------------------------------------------------------------
interface ProfilePayload {
  user?: { id?: string; type?: string; terms_accepted_at?: string | null; terms_version?: string | null } | null;
  role?: string;
  [key: string]: unknown;
}

export function TermsGate() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const content = useLegalContent();
  const terms = content.legal_terms;
  const [me, setMe] = useState<ProfilePayload | null>(() => readCache<ProfilePayload>("/api/profile") || null);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    swrFetch<ProfilePayload>("/api/profile", (data) => setMe(data));
  }, [user]);

  const role = me?.role || me?.user?.type || "";
  const show = !!user && !!me?.user && role !== "admin" && needsTermsAcceptance(me.user, terms.version);

  async function accept() {
    setSaving(true);
    try {
      const res = await fetch("/api/legal/accept", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string; terms_accepted_at?: string; terms_version?: string };
      if (!res.ok) {
        toast(data.error || "לא הצלחנו לשמור את האישור. נסו שוב", "error");
        return;
      }
      const next: ProfilePayload = { ...me, user: { ...me?.user, terms_accepted_at: data.terms_accepted_at, terms_version: data.terms_version } };
      writeCache("/api/profile", next);
      window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
      setMe(next);
    } catch {
      toast("לא הצלחנו לשמור את האישור. נסו שוב", "error");
    } finally {
      setSaving(false);
    }
  }

  async function decline() {
    setLeaving(true);
    try {
      await signOut();
    } finally {
      router.replace("/login");
    }
  }

  if (!show) return null;

  return <TermsPopup updated={!!me?.user?.terms_accepted_at} content={content} saving={saving} leaving={leaving} onAccept={accept} onDecline={decline} />;
}

// The popup itself, presentational (also used to preview it)
export function TermsPopup({
  updated,
  content,
  saving,
  leaving,
  onAccept,
  onDecline,
}: {
  updated: boolean;
  content: SiteContent;
  saving: boolean;
  leaving: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const terms = content.legal_terms;
  const link = "font-medium text-pink-700 underline underline-offset-2";
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="terms-gate-title">
      <motion.div className="absolute inset-0 bg-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
      <motion.div
        className="relative w-full sm:max-w-md max-h-[92dvh] flex flex-col bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        {/* The text scrolls on short screens (small phones, landscape); the button below always stays in view */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pt-6 pb-2 [@media(max-height:640px)]:pt-4">
          <div className="text-center">
            <span className="text-4xl block [@media(max-height:640px)]:hidden" aria-hidden="true">{updated ? "📝" : "👋"}</span>
            <h2 id="terms-gate-title" className="mt-2 text-lg font-bold text-neutral-900">{updated ? TERMS_POPUP.titleUpdated : TERMS_POPUP.titleNew}</h2>
            <p className="mt-1 text-sm text-neutral-500">{updated ? TERMS_POPUP.introUpdated : TERMS_POPUP.introNew}</p>
          </div>
          <ul className="mt-4 space-y-2.5">
            {TERMS_POPUP.points.map((p) => (
              <li key={p.icon} className="flex items-start gap-3 rounded-2xl bg-neutral-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-neutral-700">
                <span className="text-lg leading-6 shrink-0" aria-hidden="true">{p.icon}</span>
                <span>{p.text}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-center text-xs leading-relaxed text-neutral-500">
            בלחיצה על &quot;{updated ? TERMS_POPUP.acceptUpdated : TERMS_POPUP.accept}&quot; את/ה מסכים/ה ל
            <Link href="/terms" target="_blank" className={link}>{terms.title}</Link> ולכללי המערכת, ל
            <Link href="/privacy" target="_blank" className={link}>{content.legal_privacy.title}</Link> ול
            <Link href="/refunds" target="_blank" className={link}>{content.legal_refunds.title}</Link>
            {" "}(אפשר לקרוא ולהוריד כ-PDF).
          </p>
        </div>
        <div className="shrink-0 border-t border-neutral-100 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] space-y-1">
          <Button fullWidth disabled={leaving} loading={saving} onClick={onAccept}>
            {updated ? TERMS_POPUP.acceptUpdated : TERMS_POPUP.accept}
          </Button>
          <button type="button" disabled={saving || leaving} onClick={onDecline} className="w-full py-2 text-xs text-neutral-400 hover:text-neutral-600">
            {leaving ? "..." : TERMS_POPUP.decline}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
