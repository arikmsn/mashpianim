"use client";

import { FileDown } from "lucide-react";

// "הורדה כ-PDF" on the public legal pages (owner, 2026-11-26): opens the browser's print dialog, where "Save as PDF"
// gives a clean copy (the page's print styles hide the navigation). A real file, not a screenshot: the text stays
// selectable and Hebrew renders with the browser's own shaping, which server-side PDF libraries get wrong.
export function LegalDownloadButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-white px-3.5 py-2 text-sm font-medium text-ink-900 hover:border-ink-900 print:hidden"
    >
      <FileDown className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}
