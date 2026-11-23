// The legal documents as Markdown (design package v3, "ניהול תוכן מהאדמין" §5): the structured texts in lib/legal.ts
// are converted once into the content registry's defaults, so the admin edits the very same wording. Pure.

import type { LegalDocument } from "./legal.ts";

export function legalDocToMarkdown(doc: LegalDocument): string {
  const out: string[] = [doc.intro, ""];
  for (const section of doc.sections) {
    out.push(`## ${section.title}`, "");
    for (const p of section.paragraphs || []) out.push(p, "");
    if (section.bullets?.length) {
      for (const b of section.bullets) out.push(`- ${b}`);
      out.push("");
    }
    if (section.links?.length) {
      for (const l of section.links) out.push(`- [${l.label}](${l.href})`);
      out.push("");
    }
    for (const p of section.after || []) out.push(p, "");
  }
  return out.join("\n").trim() + "\n";
}
