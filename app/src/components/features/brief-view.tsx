"use client";

import { useState } from "react";
import { Modal } from "@/components/ui";
import { BRIEF_SECTIONS, BRIEF_MORE_TITLE, FORMAT_LINES, definesFormat, sectionValue, type BriefData, type BriefSnapshot } from "@/lib/brief";

// The full brief, section by section (the reference look: grey label, value below, chips for lists)
export function BriefFull({ data, notes, productName }: { data: BriefData | null | undefined; notes?: string | null; productName?: string }) {
  const filled = BRIEF_SECTIONS.filter((s) => sectionValue(data, s.key) !== null);
  if (filled.length === 0 && !notes?.trim()) {
    return <p className="text-sm text-neutral-400 text-center py-6">העסק עדיין לא מילא בריף.</p>;
  }
  return (
    <div className="space-y-4">
      {productName && <p className="text-xs text-neutral-400">{productName}</p>}
      {filled.map((section) => {
        const v = sectionValue(data, section.key)!;
        return (
          <div key={section.key} className="border-b border-neutral-100 pb-3 last:border-0">
            <p className="text-xs text-neutral-400 mb-1">{section.title}</p>
            {Array.isArray(v) ? (
              section.key === "rules" || section.key === "donts" ? (
                <div className="flex flex-wrap gap-1.5">
                  {v.map((o) => (
                    <span key={o} className="px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-700 text-xs">{o}</span>
                  ))}
                </div>
              ) : (
                <ul className="text-sm text-neutral-800 space-y-0.5">
                  {v.map((o) => (
                    <li key={o}>{o}</li>
                  ))}
                </ul>
              )
            ) : (
              <p className="text-sm text-neutral-800 whitespace-pre-line">{v}</p>
            )}
          </div>
        );
      })}
      {notes?.trim() && (
        <div className="pb-1">
          <p className="text-xs text-neutral-400 mb-1">{BRIEF_MORE_TITLE}</p>
          <p className="text-sm text-neutral-800 whitespace-pre-line">{notes.trim()}</p>
        </div>
      )}
      <ul className="text-[11px] text-neutral-400 space-y-0.5 border-t border-neutral-100 pt-3">
        {FORMAT_LINES.slice(definesFormat(data) ? 1 : 0).map((line) => (
          <li key={line}>• {line}</li>
        ))}
      </ul>
    </div>
  );
}

// The chat card: three headline fields + "לבריף המלא" (opens the full brief), then the approval state
export function BriefCard({
  snapshot,
  approved,
  canApprove,
  approving,
  onApprove,
}: {
  snapshot: BriefSnapshot;
  approved: boolean;
  canApprove: boolean;
  approving?: boolean;
  onApprove?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const data = snapshot.brief_data;
  const headline = ["see", "say", "length"]
    .map((key) => ({ key, section: BRIEF_SECTIONS.find((s) => s.key === key)!, value: sectionValue(data, key) }))
    .filter((h) => h.value !== null);

  return (
    <div className="max-w-[85%] bg-white rounded-2xl shadow-sm border border-pink-100 overflow-hidden">
      <div className="px-4 pt-3 pb-2 flex items-center gap-2">
        <span className="w-9 h-9 rounded-full bg-pink-50 text-pink-500 flex items-center justify-center text-lg">📋</span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm text-neutral-900">בריף לסרטון{snapshot.version > 1 ? ` · גרסה ${snapshot.version}` : ""}</p>
          <p className="text-[11px] text-neutral-400 truncate">{snapshot.product_name}</p>
        </div>
      </div>
      <div className="px-4 pb-3 space-y-2">
        {headline.length === 0 && !snapshot.brief ? (
          <p className="text-sm text-neutral-500">העסק עדיין לא מילא פרטים — פתחו את הבריף המלא או כתבו בצ&apos;אט.</p>
        ) : (
          headline.map((h) => (
            <div key={h.key}>
              <p className="text-[11px] text-neutral-400">{h.section.title}</p>
              <p className="text-sm text-neutral-800">{Array.isArray(h.value) ? h.value.join(", ") : h.value}</p>
            </div>
          ))
        )}
        {headline.length === 0 && snapshot.brief && (
          <div>
            <p className="text-[11px] text-neutral-400">{BRIEF_MORE_TITLE}</p>
            <p className="text-sm text-neutral-800 line-clamp-3">{snapshot.brief}</p>
          </div>
        )}
      </div>
      <button type="button" onClick={() => setOpen(true)} className="w-full border-t border-neutral-100 px-4 py-2.5 text-sm font-bold text-pink-600 text-right flex items-center justify-between">
        לבריף המלא
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-pink-400"><path d="M15 18l-6-6 6-6" /></svg>
      </button>
      {approved ? (
        <div className="bg-pink-500 text-white text-xs font-bold text-center py-1.5">אישרת את הבריף</div>
      ) : canApprove ? (
        <button
          type="button"
          disabled={approving}
          onClick={onApprove}
          className="w-full ig-gradient-bg text-white text-sm font-bold py-2.5 disabled:opacity-60"
        >
          {approving ? "מאשרת..." : "✅ אישור הבריף"}
        </button>
      ) : null}

      <Modal open={open} onClose={() => setOpen(false)} title="הבריף לסרטון" size="md" className="max-h-[90vh] overflow-y-auto">
        <BriefFull data={data} notes={snapshot.brief} productName={snapshot.product_name} />
        {!approved && canApprove && (
          <button
            type="button"
            disabled={approving}
            onClick={() => { setOpen(false); onApprove?.(); }}
            className="mt-4 w-full ig-gradient-bg text-white text-sm font-bold py-3 rounded-xl disabled:opacity-60"
          >
            ✅ אישור הבריף
          </button>
        )}
      </Modal>
    </div>
  );
}
