"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { useAuth } from "@/hooks/use-auth";
import { readCache, swrFetch } from "@/lib/client-cache";
import { FeedbackModal } from "./feedback-modal";

interface ProfilePayload {
  user?: { is_active?: boolean | null; type?: string | null } | null;
  role?: string;
}

// A suspended account (admin → השעיה, users.is_active = false) cannot sign in any more (verify-otp refuses) and a
// session that is already open sees this full-screen notice with the way to contact us. Admins are never gated.
export function SuspendedGate() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [me, setMe] = useState<ProfilePayload | null>(() => readCache<ProfilePayload>("/api/profile") || null);
  const [contactOpen, setContactOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    swrFetch<ProfilePayload>("/api/profile", (data) => setMe(data));
  }, [user]);

  const role = me?.role || me?.user?.type || "";
  const show = !!user && !!me?.user && me.user.is_active === false && role !== "admin";
  if (!show) return null;

  async function leave() {
    setLeaving(true);
    try {
      await signOut();
    } finally {
      router.replace("/login");
    }
  }

  return (
    <div className="fixed inset-0 z-[85] bg-white flex flex-col items-center justify-center p-6 text-center" role="dialog" aria-modal="true" aria-labelledby="suspended-title">
      <span className="text-5xl mb-4" aria-hidden="true">⛔</span>
      <h2 id="suspended-title" className="text-xl font-bold">החשבון שלך מושעה</h2>
      <p className="text-sm text-neutral-600 mt-3 max-w-sm leading-relaxed">
        צוות משפיען אונליין השעה את החשבון הזה, ולכן אי אפשר להשתמש בפלטפורמה כרגע. אם לדעתך זו טעות, או כדי להבין מה קרה, אפשר לפנות אלינו.
      </p>
      <div className="w-full max-w-xs mt-6 space-y-2">
        <Button fullWidth onClick={() => setContactOpen(true)}>
          ✉️ לפנייה אלינו
        </Button>
        <Button fullWidth variant="ghost" loading={leaving} onClick={leave}>
          התנתקות
        </Button>
      </div>
      <FeedbackModal
        key="suspended-contact"
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        title="פנייה בנושא השעיית החשבון"
        initialKind="contact"
        initialSubject="החשבון שלי מושעה — בקשת בירור"
        intro="ספרו לנו בקצרה מי אתם ומה קרה, ונחזור אליכם."
      />
    </div>
  );
}
