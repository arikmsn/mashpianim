// The brief: a fixed template the brand fills per product (chips + two free texts), posted into the chat at
// match as a card the creator approves. Pure, unit-tested. The template follows the owner's reference
// (2026-11-04): מה רואים · מה היא תגיד · אורך · שוטים שחייבים · כתוביות · כללי צילום · מה אסור · עוד משהו.

export interface BriefSection {
  key: string;
  title: string;
  type: "chips" | "text";
  hint?: string;
  options: readonly string[];
  placeholder?: string;
}

export const BRIEF_SECTIONS: readonly BriefSection[] = [
  {
    key: "see",
    title: "מה רואים",
    type: "chips",
    hint: "אפשר לבחור כמה",
    options: ["B-roll + Voice-over", "דיבור למצלמה", "אנבוקסינג", "שימוש / הדגמה", "לפני ואחרי", "שגרה יומית", "ביקורת והמלצה"],
  },
  {
    key: "say",
    title: "מה היא תגיד",
    type: "text",
    options: [],
    placeholder: "למשל: מתחילה מהבעיה, נגמרת בפתרון",
  },
  {
    key: "length",
    title: "אורך",
    type: "chips",
    options: ["עד 30 שניות", "30–45 שניות", "45 שניות עד דקה", "עד 90 שניות", "עד 3 דקות"],
  },
  {
    key: "shots",
    title: "שוטים שחייבים",
    type: "chips",
    hint: "אפשר לבחור כמה",
    options: ["המוצר מקרוב", "הבעיה לפני", "התוצאה אחרי", "המוצר ביד", "המוצר בתוך הבית", "המוצר בשימוש", "אריזה / פתיחה", "לוגו בפריים"],
  },
  {
    key: "captions",
    title: "כתוביות",
    type: "chips",
    options: ["עם כתוביות, למטה", "עם כתוביות, למעלה", "בלי כתוביות", "כותרת פתיחה (hook)"],
  },
  {
    key: "rules",
    title: "כללי צילום",
    type: "chips",
    hint: "אפשר לבחור כמה",
    options: ["לצלם לאורך", "לצלם באור יום", "מצלמה יציבה, בלי רעידות", "בלי רעש רקע", "פנים גלויות", "בלי עריכה כבדה"],
  },
  {
    key: "donts",
    title: "מה אסור",
    type: "chips",
    hint: "אפשר לבחור כמה",
    options: ["בלי מותגים אחרים", "בלי פילטרים", "בלי הבטחות רפואיות", "בלי שם המותג בפתיחה", "בלי ציון מחיר", "בלי מוזיקה עם זכויות"],
  },
] as const;

// "עוד משהו" is the product's free-text `brief` column (shared with the short notes in the product form)
export const BRIEF_MORE_TITLE = "עוד משהו";
export const BRIEF_TEXT_MAX = 1000;

// Chip sections hold the picked options; text sections hold a bounded string
export type BriefData = { [section: string]: string[] | string | undefined };

export const BRIEF_FORMAT_SECTIONS = ["length", "captions", "see"];

// Keeps only known sections: chip sections reduced to known options (in option order), text sections
// trimmed and bounded. Returns null when nothing is filled, so the column can be cleared.
export function sanitizeBriefData(input: unknown): BriefData | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  const out: BriefData = {};
  let any = false;
  for (const section of BRIEF_SECTIONS) {
    const value = raw[section.key];
    if (section.type === "chips") {
      if (!Array.isArray(value)) continue;
      const set = new Set(value.filter((v): v is string => typeof v === "string"));
      const kept = section.options.filter((o) => set.has(o));
      if (kept.length > 0) {
        out[section.key] = kept;
        any = true;
      }
    } else if (typeof value === "string") {
      const text = value.trim().slice(0, BRIEF_TEXT_MAX);
      if (text) {
        out[section.key] = text;
        any = true;
      }
    }
  }
  return any ? out : null;
}

export function hasBriefContent(data: BriefData | null | undefined, notes?: string | null): boolean {
  return !!(data && Object.keys(data).length > 0) || !!notes?.trim();
}

export function sectionValue(data: BriefData | null | undefined, key: string): string[] | string | null {
  const v = data?.[key];
  if (Array.isArray(v)) return v.length > 0 ? v : null;
  if (typeof v === "string") return v.trim() || null;
  return null;
}

// One line per filled section — "מה רואים: B-roll + Voice-over" — then "עוד משהו" from the notes
export function briefDataLines(data: BriefData | null | undefined, notes?: string | null): string[] {
  const lines: string[] = [];
  for (const section of BRIEF_SECTIONS) {
    const v = sectionValue(data, section.key);
    if (!v) continue;
    lines.push(`${section.title}: ${Array.isArray(v) ? v.join(", ") : v}`);
  }
  if (notes?.trim()) lines.push(`${BRIEF_MORE_TITLE}: ${notes.trim()}`);
  return lines;
}

// The brand fixed the format itself (length / captions / what we see) — the default format line steps aside
export function definesFormat(data: BriefData | null | undefined): boolean {
  return BRIEF_FORMAT_SECTIONS.some((k) => sectionValue(data, k) !== null);
}

// Snapshot stored on the chat card (kind "brief") so the creator approves exactly what she saw
export interface BriefSnapshot {
  product_name: string;
  brief_data: BriefData | null;
  brief: string | null;
  version: number;
}

export interface BriefProduct {
  name: string;
  price?: number | null;
  product_type?: string | null;
  description?: string | null;
  // Free text written by the brand ("עוד משהו" / the short notes)
  brief?: string | null;
  // Structured picks (migration 015)
  brief_data?: BriefData | null;
}

// Standard terms every deliverable follows (also shown on the product page)
export const FORMAT_LINES = [
  `פורמט: וידאו 15–45 שנ' · 9:16 · דיבור למצלמה · כתוביות בעברית`,
  `יעד להעלאה: עד 10 ימים מקבלת המוצר`,
  `זכויות שימוש: העסק רשאי להשתמש בסרטון בכל הערוצים שלו`,
];

// Plain-text rendering (WhatsApp, fallbacks, tests); the chat shows the card instead
export function buildBriefMessage(product: BriefProduct): string {
  const kind = product.product_type === "digital" ? "דיגיטלי" : "פיזי";
  const header = [`📦 בריף — ${product.name}`, `שווי: ₪${Number(product.price) || 0} · ${kind}`, ``];
  const data = sanitizeBriefData(product.brief_data);
  const notes = product.brief?.trim();
  const terms = definesFormat(data) ? FORMAT_LINES.slice(1) : FORMAT_LINES;

  if (data || notes) {
    return [...header, ...briefDataLines(data, notes), ``, ...terms].join("\n");
  }

  return [
    ...header,
    `מה המוצר: ${product.description?.trim() || "(העסק ישלים)"}`,
    `למי הוא מתאים: (העסק ישלים)`,
    ``,
    `3 דברים שחובה להגיד:`,
    `1.`,
    `2.`,
    `3.`,
    `מה לא להגיד או להראות: (העסק ישלים)`,
    ``,
    ...FORMAT_LINES,
  ].join("\n");
}
