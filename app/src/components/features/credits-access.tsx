"use client";

import { useEffect, useState } from "react";
import { Button, Input, Modal, useToast } from "@/components/ui";
import { FeedbackModal } from "./feedback-modal";
import { fetchJson } from "@/lib/client-cache";
import { CREDITS_CONTACT_SUBJECT, CREDITS_HOW_TO, creditsSummary } from "@/lib/credits";
import { formatILS, validateBilling, type PackageId, type PackageOffer } from "@/lib/payments";

interface CreditsAccessProps {
  open: boolean;
  onClose: () => void;
  total: number;
  used: number;
  // true: the caller already showed the notice — open the contact form straight away (when there is no online purchase)
  startAtContact?: boolean;
}

interface PackagesPayload {
  enabled: boolean;
  mode: string;
  packages: PackageOffer[];
  billing: { name: string; companyNumber: string; email: string } | null;
  notes?: string[];
}

// "רכישת סרטונים". With SUMIT connected (SUMIT_PAYMENTS on / admins): the packages, the invoice details and a
// hand-off to SUMIT's secure payment page; the credits land by themselves when the payment is verified.
// Without it: the owner's notice and the in-app contact form (the team loads the package from /admin/brands).
export function CreditsAccess({ open, onClose, total, used, startAtContact = false }: CreditsAccessProps) {
  const { toast } = useToast();
  const [contactOpen, setContactOpen] = useState(false);
  // null = still asking the server whether online purchase is open to this business
  const [offer, setOffer] = useState<PackagesPayload | null>(null);
  const [selected, setSelected] = useState<PackageId | null>(null);
  const [billing, setBilling] = useState({ name: "", companyNumber: "", email: "" });
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchJson<PackagesPayload>("/api/payments/packages").then((d) => {
      if (cancelled) return;
      const payload = d && typeof d.enabled === "boolean" ? d : { enabled: false, mode: "off", packages: [], billing: null };
      setOffer(payload);
      if (payload.billing) setBilling({ name: payload.billing.name || "", companyNumber: payload.billing.companyNumber || "", email: payload.billing.email || "" });
      const best = payload.packages.find((p) => p.best) || payload.packages[0];
      if (best) setSelected(best.id);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const online = !!offer?.enabled && (offer?.packages.length || 0) > 0;
  const showContact = open && !online && (contactOpen || startAtContact);
  const showNotice = open && !online && !showContact;

  function close() {
    setContactOpen(false);
    onClose();
  }

  async function pay() {
    if (!selected) return;
    const check = validateBilling(billing);
    if (!check.ok) {
      toast(check.error, "error");
      return;
    }
    setPaying(true);
    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ package: selected, billing: check.value }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof data.url === "string") {
        // Off to SUMIT's page; the business comes back to /brand?purchase=…
        window.location.assign(data.url);
        return;
      }
      toast((data as { error?: string }).error || "דף התשלום לא נפתח — נסו שוב", "error");
    } catch {
      toast("דף התשלום לא נפתח — נסו שוב", "error");
    } finally {
      setPaying(false);
    }
  }

  const chosen = offer?.packages.find((p) => p.id === selected) || null;

  return (
    <>
      <Modal open={open && online} onClose={close} title="רכישת סרטונים" size="md" className="max-h-[90vh] overflow-y-auto">
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">{creditsSummary(total, used)} כל סרטון בחבילה = אישור שיתוף פעולה אחד עם יוצר/ת.</p>

          <div className="grid grid-cols-2 gap-2">
            {offer?.packages.map((p) => {
              const active = selected === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelected(p.id)}
                  aria-pressed={active}
                  className={`relative text-right rounded-2xl border p-3 transition-colors ${active ? "border-pink-500 bg-pink-50" : "border-neutral-200 bg-white hover:border-pink-200"}`}
                >
                  {p.best && <span className="absolute -top-2 left-2 text-[10px] font-bold bg-emerald-500 text-white px-2 py-0.5 rounded-full">הכי משתלם</span>}
                  <p className="font-bold text-neutral-900">🎬 {p.label}</p>
                  <p className="text-lg font-bold text-pink-600">{formatILS(p.price)}</p>
                  <p className="text-[11px] text-neutral-500">{formatILS(p.perVideo)} לסרטון · כולל מע״מ</p>
                </button>
              );
            })}
          </div>

          <div className="space-y-3 border-t border-neutral-100 pt-3">
            <p className="text-sm font-bold text-neutral-800">פרטים לחשבונית</p>
            <Input label="שם העסק לחשבונית" value={billing.name} maxLength={120} onChange={(e) => setBilling((b) => ({ ...b, name: e.target.value }))} placeholder="השם שיופיע בחשבונית" />
            <Input label="מספר עוסק / ח.פ. (לא חובה)" value={billing.companyNumber} maxLength={15} inputMode="numeric" dir="ltr" onChange={(e) => setBilling((b) => ({ ...b, companyNumber: e.target.value }))} placeholder="512345678" />
            <Input label="אימייל לחשבונית" type="email" value={billing.email} maxLength={200} dir="ltr" onChange={(e) => setBilling((b) => ({ ...b, email: e.target.value }))} placeholder="name@business.co.il" />
          </div>

          <ul className="text-[11px] text-neutral-500 space-y-0.5">
            {(offer?.notes || []).map((n) => (
              <li key={n}>• {n}</li>
            ))}
          </ul>

          <Button fullWidth loading={paying} disabled={!chosen} onClick={pay}>
            {chosen ? `🔒 לתשלום מאובטח — ${formatILS(chosen.price)}` : "בחרו חבילה"}
          </Button>
          <Button variant="ghost" fullWidth onClick={close}>
            סגירה
          </Button>
        </div>
      </Modal>

      <Modal open={showNotice} onClose={close} size="sm">
        <div className="text-center space-y-4">
          <span className="text-4xl block">🎬</span>
          <div className="space-y-2">
            <h3 className="text-lg font-bold">רכישת סרטונים</h3>
            <p className="text-sm text-neutral-600">{creditsSummary(total, used)}</p>
            {offer === null ? (
              <p className="text-sm text-neutral-400">בודקים אפשרויות רכישה...</p>
            ) : (
              <p className="text-sm text-neutral-800 bg-pink-50 rounded-xl px-3 py-2 text-right">{CREDITS_HOW_TO}</p>
            )}
          </div>
          <Button fullWidth disabled={offer === null} onClick={() => setContactOpen(true)}>
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
