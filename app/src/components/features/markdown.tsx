import Link from "next/link";
import { parseMarkdown, type Inline } from "@/lib/markdown";

// Renders the Markdown subset of lib/markdown.ts as React (never HTML): the legal documents and other long
// admin-edited texts. Server-safe (no hooks).
function Inlines({ parts, linkClassName }: { parts: Inline[]; linkClassName: string }) {
  return (
    <>
      {parts.map((p, i) => {
        if (p.kind === "bold") return <strong key={i}>{p.text}</strong>;
        if (p.kind === "link") {
          if (p.href.startsWith("/") || p.href.startsWith("#")) {
            return (
              <Link key={i} href={p.href} className={linkClassName}>
                {p.text}
              </Link>
            );
          }
          const external = p.href.startsWith("http");
          return (
            <a key={i} href={p.href} className={linkClassName} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
              {p.text}
            </a>
          );
        }
        return <span key={i}>{p.text}</span>;
      })}
    </>
  );
}

export function Markdown({ source, compact = false, className = "" }: { source: string; compact?: boolean; className?: string }) {
  const blocks = parseMarkdown(source);
  const linkClassName = "text-pink-700 font-medium underline underline-offset-2";
  const Heading2 = compact ? "h3" : "h2";
  const Heading3 = compact ? "h4" : "h3";
  return (
    <div className={`${compact ? "space-y-3 text-[15px]" : "space-y-4"} text-neutral-700 leading-relaxed ${className}`}>
      {blocks.map((b, i) => {
        if (b.kind === "heading") {
          const cls = `${compact ? "text-base" : b.level === 1 ? "text-2xl" : "text-xl"} font-bold text-neutral-900 ${i === 0 ? "" : "pt-3"}`;
          if (b.level === 1) return <h2 key={i} className={cls}><Inlines parts={b.inlines} linkClassName={linkClassName} /></h2>;
          if (b.level === 2) return <Heading2 key={i} className={cls}><Inlines parts={b.inlines} linkClassName={linkClassName} /></Heading2>;
          return <Heading3 key={i} className={cls}><Inlines parts={b.inlines} linkClassName={linkClassName} /></Heading3>;
        }
        if (b.kind === "list") {
          const ListTag = b.ordered ? "ol" : "ul";
          return (
            <ListTag key={i} className={`${b.ordered ? "list-decimal" : "list-disc"} list-inside space-y-1 ps-2`}>
              {b.items.map((item, j) => (
                <li key={j}>
                  <Inlines parts={item} linkClassName={linkClassName} />
                </li>
              ))}
            </ListTag>
          );
        }
        return (
          <p key={i}>
            <Inlines parts={b.inlines} linkClassName={linkClassName} />
          </p>
        );
      })}
    </div>
  );
}
