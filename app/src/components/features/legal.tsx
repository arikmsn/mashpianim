"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Button, useToast } from "@/components/ui";
import { useAuth } from "@/hooks/use-auth";
import { PROFILE_UPDATED_EVENT, readCache, swrFetch, writeCache } from "@/lib/client-cache";
import { LEGAL_ORDER, needsTermsAcceptance, type LegalSlug } from "@/lib/legal";
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
  const [checked, setChecked] = useState(false);
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

  return (
    <div className="fixed inset-0 z-[80] bg-white flex flex-col" role="dialog" aria-modal="true" aria-labelledby="terms-gate-title">
      <header className="px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-3 border-b border-border bg-gradient-to-b from-pink-50 to-white">
        <h2 id="terms-gate-title" className="text-lg font-bold">לפני שממשיכים: {terms.title}</h2>
        <p className="text-xs text-neutral-500 mt-1">
          {role === "brand"
            ? "כדי להשתמש במשפיען אונליין כעסק צריך לקרוא את תנאי השירות ולאשר אותם. זה נעשה פעם אחת."
            : "כדי להשתמש במשפיען אונליין צריך לקרוא את תנאי השירות ולאשר אותם. זה נעשה פעם אחת."}
        </p>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4">
        <LegalDocumentView body={terms.body} compact />
        <p className="mt-6 text-xs text-neutral-500 bg-neutral-50 rounded-xl p-3">
          התנאים כוללים גם את{" "}
          <Link href="/privacy" target="_blank" className="text-pink-700 hover:underline">{content.legal_privacy.title}</Link>
          {" "}ואת{" "}
          <Link href="/refunds" target="_blank" className="text-pink-700 hover:underline">{content.legal_refunds.title}</Link>
          . {terms.updated_label}.
        </p>
      </div>
      <footer className="border-t border-border p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-3 bg-white">
        <label className="flex items-start gap-3 text-sm text-neutral-800 cursor-pointer">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 w-5 h-5 accent-pink-600 shrink-0"
          />
          <span>קראתי ואני מסכים/ה לתנאי השירות, למדיניות הפרטיות ולמדיניות הביטולים וההחזרים של משפיען אונליין.</span>
        </label>
        <Button fullWidth disabled={!checked || leaving} loading={saving} onClick={accept}>
          ✅ מאשר/ת וממשיכ/ה
        </Button>
        <Button fullWidth variant="ghost" disabled={saving} loading={leaving} onClick={decline} className="text-neutral-500">
          לא מסכים/ה, יציאה מהמערכת
        </Button>
      </footer>
    </div>
  );
}
