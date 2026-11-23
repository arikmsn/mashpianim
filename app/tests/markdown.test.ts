import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { containsHtml, isSafeHref, markdownToText, parseInlines, parseMarkdown } from "../src/lib/markdown.ts";
import { legalDocToMarkdown } from "../src/lib/legal-markdown.ts";
import { TERMS } from "../src/lib/legal.ts";

describe("markdown subset for admin-edited documents", () => {
  test("blocks: headings, paragraphs, bullet and numbered lists", () => {
    const blocks = parseMarkdown("# כותרת\n\nפסקה ראשונה\nממשיכה\n\n- אחד\n- שניים\n\n1. א\n2. ב\n## תת\nטקסט");
    assert.deepEqual(blocks.map((b) => b.kind), ["heading", "paragraph", "list", "list", "heading", "paragraph"]);
    assert.equal((blocks[0] as { level: number }).level, 1);
    assert.equal((blocks[1] as { inlines: { text: string }[] }).inlines[0].text, "פסקה ראשונה ממשיכה");
    assert.equal((blocks[2] as { ordered: boolean; items: unknown[] }).ordered, false);
    assert.equal((blocks[2] as { items: unknown[] }).items.length, 2);
    assert.equal((blocks[3] as { ordered: boolean }).ordered, true);
    assert.deepEqual(parseMarkdown(""), []);
    assert.deepEqual(parseMarkdown(null), []);
  });

  test("inlines: bold and safe links only", () => {
    assert.deepEqual(parseInlines("א **ב** [ג](/privacy) ד"), [
      { kind: "text", text: "א " },
      { kind: "bold", text: "ב" },
      { kind: "text", text: " " },
      { kind: "link", text: "ג", href: "/privacy" },
      { kind: "text", text: " ד" },
    ]);
    assert.deepEqual(parseInlines("[x](javascript:alert)"), [{ kind: "text", text: "x" }], "an unsafe href renders as text");
    assert.ok(isSafeHref("https://a.b"));
    assert.ok(isSafeHref("mailto:info@mashpian.online"));
    assert.ok(isSafeHref("tel:+972555700948"));
    assert.ok(isSafeHref("#how"));
    assert.ok(!isSafeHref("//evil.com"));
    assert.ok(!isSafeHref("data:text/html,x"));
  });

  test("html detection and plain text", () => {
    assert.ok(containsHtml("hello <b>x</b>"));
    assert.ok(!containsHtml("3 < 5 and 7 > 2"));
    assert.equal(markdownToText("# א\n\n- ב\n- ג\n\n**ד** [ה](/x)"), "א\nב\nג\nד ה");
  });

  test("the structured legal documents convert to markdown without losing anything", () => {
    const md = legalDocToMarkdown(TERMS);
    assert.ok(md.startsWith(TERMS.intro));
    for (const s of TERMS.sections) {
      assert.ok(md.includes(`## ${s.title}`), s.title);
      for (const b of s.bullets || []) assert.ok(md.includes(`- ${b}`));
      for (const p of s.paragraphs || []) assert.ok(md.includes(p));
    }
    assert.ok(md.includes("[להצהרת הנגישות](/accessibility)"));
    const text = markdownToText(md);
    assert.ok(text.includes("גוף מקשר"));
  });
});
