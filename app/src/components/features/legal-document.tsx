import Link from "next/link";
import { LEGAL_DOCUMENTS, LEGAL_ORDER, LEGAL_UPDATED_LABEL, type LegalDocument, type LegalSlug } from "@/lib/legal";

// Renders one legal document (terms / privacy / refunds) from its data. Server-safe (no hooks) so the public
// pages, the acceptance gate and the side-menu viewer all show exactly the same wording.
export function LegalDocumentView({ doc, compact = false }: { doc: LegalDocument; compact?: boolean }) {
  const Heading = compact ? "h3" : "h2";
  return (
    <div className={`space-y-${compact ? "5" : "8"} text-neutral-700 leading-relaxed ${compact ? "text-[15px]" : ""}`}>
      <p className={compact ? "text-sm text-neutral-600" : ""}>{doc.intro}</p>
      {doc.sections.map((section) => (
        <section key={section.title}>
          <Heading className={`${compact ? "text-base" : "text-xl"} font-bold text-neutral-900 mb-2`}>{section.title}</Heading>
          {section.paragraphs?.map((p, i) => (
            <p key={i} className="mb-2">{p}</p>
          ))}
          {section.bullets && (
            <ul className="list-disc list-inside space-y-1 mr-2">
              {section.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          )}
          {section.after?.map((p, i) => (
            <p key={`after-${i}`} className="mt-2">{p}</p>
          ))}
        </section>
      ))}
    </div>
  );
}

// The public page around a document: back link, title, date, the text, links to the two other documents
export function LegalPage({ doc }: { doc: LegalDocument }) {
  const others = LEGAL_ORDER.filter((slug) => slug !== doc.slug);
  return (
    <main className="min-h-screen bg-background px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-pink-500 hover:underline mb-8">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
          חזרה לדף הבית
        </Link>

        <h1 className="text-3xl font-bold mb-2">{doc.title}</h1>
        <p className="text-neutral-400 text-sm mb-10">{LEGAL_UPDATED_LABEL}</p>

        <LegalDocumentView doc={doc} />

        <div className="mt-12 pt-8 border-t border-neutral-200 text-sm text-neutral-500 flex flex-wrap items-center justify-between gap-3">
          <span>מסמכים נוספים:</span>
          <span className="flex gap-4">
            {others.map((slug: LegalSlug) => (
              <Link key={slug} href={`/${slug}`} className="text-pink-500 hover:underline">
                {LEGAL_DOCUMENTS[slug].title}
              </Link>
            ))}
          </span>
        </div>
        <p className="mt-6 text-center text-sm text-neutral-400">לשאלות ובירורים ניתן לפנות אלינו דרך &quot;צור קשר&quot; באפליקציה.</p>
      </div>
    </main>
  );
}
