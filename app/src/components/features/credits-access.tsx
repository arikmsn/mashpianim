"use client";

import { useState } from "react";
import { Button, Modal } from "@/components/ui";
import { FeedbackModal } from "./feedback-modal";
import { CREDITS_CONTACT_SUBJECT, CREDITS_HOW_TO, creditsSummary } from "@/lib/credits";

interface CreditsAccessProps {
  open: boolean;
  onClose: () => void;
  total: number;
  used: number;
  // true: the caller already showed the notice — open the contact form straight away
  startAtContact?: boolean;
}

// "רכישת סרטונים" until online payment exists: the owner's notice (purchases are handled by the team), then the
// in-app contact form with a preset subject. The team answers and loads the package from /admin/brands.
export function CreditsAccess({ open, onClose, total, used, startAtContact = false }: CreditsAccessProps) {
  const [contactOpen, setContactOpen] = useState(false);
  const showContact = open && (contactOpen || startAtContact);
  const showNotice = open && !showContact;

  function close() {
    setContactOpen(false);
    onClose();
  }

  return (
    <>
      <Modal open={showNotice} onClose={close} size="sm">
        <div className="text-center space-y-4">
          <span className="text-4xl block">🎬</span>
          <div className="space-y-2">
            <h3 className="text-lg font-bold">רכישת סרטונים</h3>
            <p className="text-sm text-neutral-600">{creditsSummary(total, used)}</p>
            <p className="text-sm text-neutral-800 bg-pink-50 rounded-xl px-3 py-2 text-right">{CREDITS_HOW_TO}</p>
          </div>
          <Button fullWidth onClick={() => setContactOpen(true)}>
            ✉️ לצור קשר
          </Button>
          <Button variant="ghost" fullWidth onClick={close}>
            סגירה
          </Button>
        </div>
      </Modal>

      <FeedbackModal
        key="credits-contact"
        open={showContact}
        onClose={close}
        title="רכישת סרטונים — צור קשר"
        initialKind="contact"
        initialSubject={CREDITS_CONTACT_SUBJECT}
        intro="כתבו כמה סרטונים תרצו (ולאיזה מוצרים) ונחזור אליכם לאישור הטעינה — בדרך כלל באותו יום."
      />
    </>
  );
}
