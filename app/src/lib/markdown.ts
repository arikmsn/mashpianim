// A tiny, safe Markdown subset for the legal documents and other admin-edited long texts (design package v3,
// "ניהול תוכן מהאדמין" §5). Pure: no framework imports, unit-tested. The renderer in components/features/markdown.tsx
// maps these blocks to React elements, so no HTML ever reaches the page unescaped.
//
// Supported: "# ", "## ", "### " headings, "- " / "* " bullet lists, "1. " numbered lists, blank-line paragraphs,
// **bold**, [label](href) links with http(s), mailto:, tel: or a relative path. Everything else is plain text.

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "link"; text: string; href: string };

export type Block =
  | { kind: "heading"; level: 1 | 2 | 3; inlines: Inline[] }
  | { kind: "paragraph"; inlines: Inline[] }
  | { kind: "list"; ordered: boolean; items: Inline[][] };

const SAFE_HREF = /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/;

export function isSafeHref(href: string): boolean {
  return SAFE_HREF.test(href.trim());
}

// **bold** and [label](href); an unsafe href renders as plain text
export function parseInlines(text: string): Inline[] {
  const out: Inline[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ kind: "text", text: text.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ kind: "bold", text: m[1] });
    else if (isSafeHref(m[3])) out.push({ kind: "link", text: m[2], href: m[3].trim() });
    else out.push({ kind: "text", text: m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out.length ? out : [{ kind: "text", text: "" }];
}

export function parseMarkdown(source: string | null | undefined): Block[] {
  const lines = String(source || "").replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushPara = () => {
    if (para.length) {
      blocks.push({ kind: "paragraph", inlines: parseInlines(para.join(" ")) });
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      blocks.push({ kind: "list", ordered: list.ordered, items: list.items.map(parseInlines) });
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) {
      flushPara();
      flushList();
      continue;
    }
    const h = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (h) {
      flushPara();
      flushList();
      blocks.push({ kind: "heading", level: h[1].length as 1 | 2 | 3, inlines: parseInlines(h[2]) });
      continue;
    }
    const bullet = /^[-*•]\s+(.+)$/.exec(trimmed);
    const numbered = /^\d+[.)]\s+(.+)$/.exec(trimmed);
    if (bullet || numbered) {
      flushPara();
      const ordered = !!numbered && !bullet;
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push((bullet || numbered)![1]);
      continue;
    }
    flushList();
    para.push(trimmed);
  }
  flushPara();
  flushList();
  return blocks;
}

// Raw HTML is not allowed in admin-edited markdown (the renderer would show it as text, but the admin should know)
export function containsHtml(source: string): boolean {
  return /<\s*\/?\s*[a-zA-Z][^>]*>/.test(source);
}

// Plain text of a document (search in the admin, tests)
export function markdownToText(source: string): string {
  return parseMarkdown(source)
    .map((b) => (b.kind === "list" ? b.items.map((i) => i.map((x) => x.text).join("")).join("\n") : b.inlines.map((x) => x.text).join("")))
    .join("\n");
}
