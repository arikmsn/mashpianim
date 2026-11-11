"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Avatar, Button, useToast } from "@/components/ui";
import { useAuth } from "@/hooks/use-auth";
import { readCache, swrFetch } from "@/lib/client-cache";
import { FeedbackModal } from "./feedback-modal";
import { RoleSwitchModal, roleLabel, type AppRole } from "./role-switch";
import { LegalModal } from "./legal";
import { WelcomeSheet, useOnboarding, useOnboardingContent, type OnboardingUser } from "./onboarding";

interface ProfilePayload {
  user?: ({ full_name?: string | null; avatar_url?: string | null; type?: string | null } & OnboardingUser) | null;
  profile?: { shop_name?: string | null; logo_url?: string | null; portfolio_count?: number | null } | null;
  role?: string;
  roles?: string[];
}

// The side menu behind "☰ תפריט" in the bottom bar (owner, 2026-11-09): who is signed in, the profile,
// notifications, contact / report, switching the interface for accounts with several roles, and signing out.
// The bottom bar itself keeps only the working screens.
export function SideMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { signOut } = useAuth();
  const { toast } = useToast();
  const [me, setMe] = useState<ProfilePayload | null>(() => readCache<ProfilePayload>("/api/profile") || null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const onboarding = useOnboarding(me?.user || null);
  const onboardingContent = useOnboardingContent();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Fresh name / avatar each time the menu opens (shares the cached /api/profile of the screen behind it)
  useEffect(() => {
    if (!open) return;
    swrFetch<ProfilePayload>("/api/profile", (data) => setMe(data));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const role = (me?.role || me?.user?.type || "") as string;
  const isBrand = role === "brand";
  const name = isBrand ? me?.profile?.shop_name || me?.user?.full_name || "העסק שלי" : me?.user?.full_name || "הפרופיל שלי";
  const avatar = isBrand ? me?.profile?.logo_url || me?.user?.avatar_url || null : me?.user?.avatar_url || null;
  const roles = (me?.roles || []).filter((r): r is AppRole => r === "creator" || r === "brand" || r === "admin");

  function go(href: string) {
    onClose();
    router.push(href);
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await signOut();
      onClose();
      router.push("/login");
    } catch {
      toast("שגיאה בהתנתקות", "error");
      setLoggingOut(false);
    }
  }

  return (
    <>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="תפריט">
            <motion.div
              className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />
            <motion.aside
              className="absolute inset-y-0 right-0 w-[82%] max-w-xs bg-white shadow-2xl flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.22 }}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
                <span className="font-bold">תפריט</span>
                <button type="button" onClick={onClose} className="p-2 -ml-2 rounded-lg text-neutral-500 hover:bg-neutral-100" aria-label="סגירת התפריט">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <button type="button" onClick={() => go("/profile")} className="flex items-center gap-3 px-4 py-4 text-right hover:bg-pink-50/60 border-b border-neutral-100">
                <Avatar src={avatar} name={name} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold truncate">{name}</p>
                  <p className="text-xs text-neutral-500">{roleLabel(role)} · לצפייה ולעריכת הפרופיל</p>
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-neutral-300 shrink-0" aria-hidden="true">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>

              <nav className="flex-1 overflow-y-auto py-2">
                <MenuItem icon="👤" label="הפרופיל שלי" onClick={() => go("/profile")} />
                <MenuItem icon="🔔" label="התראות" onClick={() => go("/notifications")} />
                {role === "creator" && (
                  <MenuItem
                    icon="❓"
                    label="איך זה עובד?"
                    onClick={() => {
                      onClose();
                      setHowOpen(true);
                    }}
                  />
                )}
                <MenuItem
                  icon="📨"
                  label="צור קשר / דיווח על תקלה"
                  onClick={() => {
                    onClose();
                    setFeedbackOpen(true);
                  }}
                />
                {roles.length > 1 && (
                  <MenuItem
                    icon="🔁"
                    label={`החלפת ממשק (כרגע: ${roleLabel(role)})`}
                    onClick={() => {
                      onClose();
                      setRoleOpen(true);
                    }}
                  />
                )}
              </nav>

              <div className="border-t border-neutral-100 p-3">
                {/* The terms the account accepted, any time (owner, 2026-11-09) */}
                <MenuItem
                  icon="📄"
                  label="תנאי שירות, פרטיות, החזרים ונגישות"
                  onClick={() => {
                    onClose();
                    setLegalOpen(true);
                  }}
                />
                {confirmLogout ? (
                  <div className="space-y-2">
                    <p className="text-sm text-center text-neutral-700">להתנתק מהחשבון?</p>
                    <div className="flex gap-2">
                      <Button fullWidth variant="danger" loading={loggingOut} onClick={handleLogout}>התנתקות</Button>
                      <Button fullWidth variant="ghost" disabled={loggingOut} onClick={() => setConfirmLogout(false)}>ביטול</Button>
                    </div>
                  </div>
                ) : (
                  <MenuItem icon="🚪" label="התנתקות" tone="danger" onClick={() => setConfirmLogout(true)} />
                )}
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      {/* Replay of the welcome cards; marks the moment only if the account never saw it */}
      <WelcomeSheet
        open={howOpen}
        portfolioCount={me?.profile?.portfolio_count ?? null}
        content={onboardingContent.welcome}
        onDone={(how) => {
          setHowOpen(false);
          onboarding.mark("welcome", how);
        }}
      />
      <LegalModal open={legalOpen} onClose={() => setLegalOpen(false)} />
      <RoleSwitchModal open={roleOpen} onClose={() => setRoleOpen(false)} roles={roles} current={roles.includes(role as AppRole) ? (role as AppRole) : null} />
    </>
  );
}

function MenuItem({ icon, label, onClick, tone = "default" }: { icon: string; label: string; onClick: () => void; tone?: "default" | "danger" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 text-right text-sm font-medium hover:bg-neutral-50 active:bg-neutral-100 ${tone === "danger" ? "text-red-600" : "text-neutral-800"}`}
    >
      <span className="text-lg w-7 text-center" aria-hidden="true">{icon}</span>
      <span className="flex-1">{label}</span>
    </button>
  );
}
