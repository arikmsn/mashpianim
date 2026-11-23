import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LEGAL_ORDER, type LegalSlug } from "@/lib/legal";
import type { SiteContent } from "@/lib/site-content";
import { Markdown } from "./markdown";

// One legal document, rendered from its Markdown body in the content registry (the admin edits it in
// /admin/content, legal tab). Server-safe (no hooks), so the public pages, the acceptance gate and the side-menu
// viewer all show the very same wording.
export function LegalDocumentView({ body, compact = false }: { body: string; compact?: boolean }) {
  return <Markdown source={body} compact={compact} />;
}

export type LegalSectionId = `legal_${LegalSlug}`;

export function legalSectionId(slug: LegalSlug): LegalSectionId {
  return `legal_${slug}`;
}

export function legalDoc(content: SiteContent, slug: LegalSlug) {
  return content[legalSectionId(slug)];
}

// The public page around a document: back link, title, date, the text, links to the other documents
export function LegalPage({ slug, content }: { slug: LegalSlug; content: SiteContent }) {
  const doc = legalDoc(content, slug);
  const common = content.legal_common;
  const others = LEGAL_ORDER.filter((s) => s !== slug);
  return (
    <main className="min-h-screen bg-background px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-pink-700 hover:underline mb-8">
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
          {common.back_home}
        </Link>

        <h1 className="text-3xl font-bold mb-2">{doc.title}</h1>
        <p className="text-neutral-500 text-sm mb-10">{doc.updated_label}</p>

        <LegalDocumentView body={doc.body} />

        <div className="mt-12 pt-8 border-t border-border text-sm text-neutral-500 flex flex-wrap items-center justify-between gap-3">
          <span>{common.more_docs}</span>
          <span className="flex gap-4">
            {others.map((s) => (
              <Link key={s} href={`/${s}`} className="text-pink-700 hover:underline">
                {legalDoc(content, s).title}
              </Link>
            ))}
          </span>
        </div>
        <p className="mt-6 text-center text-sm text-neutral-500">{common.contact_note}</p>
      </div>
    </main>
  );
}
