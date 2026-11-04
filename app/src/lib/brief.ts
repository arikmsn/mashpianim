// The brief: what the creator receives in the chat when a match opens and reads on the product page.
// Pure, unit-tested. Since 2026-11-04 a brief is structured (multi-select sections, every one optional)
// plus free text; the plain-text rendering below is what goes into the chat.

export interface BriefSection {
  key: string;
  title: string;
  hint?: string;
  options: readonly string[];
}

// One list drives the product form (the first section only), the brief screen, validation and rendering
export const BRIEF_SECTIONS: readonly BriefSection[] = [
  {
    key: "types",
    title: "סוג הסרטון",
    hint: "אפשר לבחור כמה",
    options: ["אנבוקסינג", "חדש על המדף", "שימוש / הדגמה", "ביקורת והמלצה", "לפני ואחרי", "שגרה יומית (GRWM)", "השוואה", "טיפים והדרכה"],
  },
  { key: "length", title: "אורך הסרטון", options: ["15–30 שנ'", "30–60 שנ'", "60–90 שנ'", "עד 3 דקות"] },
  { key: "orientation", title: "פורמט", options: ["אנכי 9:16", "אופקי 16:9", "ריבועי 1:1"] },
  { key: "style", title: "סגנון", options: ["טבעי ואותנטי", "מלוטש ומקצועי", "הומוריסטי", "אסתטי", "אנרגטי", "שקט ורגוע"] },
  { key: "speech", title: "דיבור וקול", options: ["דיבור למצלמה", "קריינות (voice-over)", "בלי דיבור — מוזיקה וכתוביות", "בעברית", "באנגלית"] },
  { key: "captions", title: "טקסט על המסך", options: ["כתוביות בעברית", "כותרת פתיחה (hook)", "שם המוצר על המסך", "בלי טקסט על המסך"] },
  { key: "location", title: "מיקום צילום", options: ["בבית", "בחוץ", "בסטודיו", "בחנות / בעסק", "בדרכים"] },
  {
    key: "showcase",
    title: "מה חייב להופיע",
    options: ["שם המוצר נאמר", "אריזה / לוגו בפריים", "שימוש בפועל במוצר", "קריאה לפעולה (CTA)", "קוד קופון / קישור בביו", "תוצאה / לפני-אחרי"],
  },
  { key: "platforms", title: "פלטפורמת יעד", options: ["TikTok", "Instagram Reels", "YouTube Shorts", "אתר / פרסום ממומן"] },
  {
    key: "donts",
    title: "מה לא לעשות",
    options: ["לא להזכיר מתחרים", "לא לציין מחיר", "בלי מותגים אחרים בפריים", "בלי ילדים", "בלי מוזיקה עם זכויות", "בלי פילטרים / עריכה כבדה"],
  },
] as const;

export const BRIEF_TEXT_MAX = 1000;

// Picks per section (section key → chosen options) plus the key messages text
export type BriefData = { [section: string]: string[] | string | undefined; messages?: string };

// Keeps only known sections with known options (order of the option list), and a bounded messages text.
// Returns null when nothing was picked and no text was written, so the column can be cleared.
export function sanitizeBriefData(input: unknown): BriefData | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  const out: BriefData = {};
  let any = false;
  for (const section of BRIEF_SECTIONS) {
    const picked = raw[section.key];
    if (!Array.isArray(picked)) continue;
    const set = new Set(picked.filter((v): v is string => typeof v === "string"));
    const kept = section.options.filter((o) => set.has(o));
    if (kept.length > 0) {
      out[section.key] = kept;
      any = true;
    }
  }
  if (typeof raw.messages === "string") {
    const text = raw.messages.trim().slice(0, BRIEF_TEXT_MAX);
    if (text) {
      out.messages = text;
      any = true;
    }
  }
  return any ? out : null;
}

export function hasBriefContent(data: BriefData | null | undefined, notes?: string | null): boolean {
  return !!(data && Object.keys(data).length > 0) || !!notes?.trim();
}

// "סוג הסרטון: אנבוקסינג, שימוש / הדגמה" — one line per picked section, then the key messages
export function briefDataLines(data: BriefData | null | undefined): string[] {
  if (!data) return [];
  const lines: string[] = [];
  for (const section of BRIEF_SECTIONS) {
    const picked = data[section.key];
    if (Array.isArray(picked) && picked.length > 0) lines.push(`${section.title}: ${picked.join(", ")}`);
  }
  if (data.messages) lines.push(`מסרים מרכזיים:`, data.messages);
  return lines;
}

// The structured brief already fixes length / format / speech when any of these was picked
export const FORMAT_SECTIONS = ["length", "orientation", "speech", "captions"];

export function definesFormat(data: BriefData | null | undefined): boolean {
  if (!data) return false;
  return FORMAT_SECTIONS.some((k) => {
    const v = data[k];
    return Array.isArray(v) && v.length > 0;
  });
}

export interface BriefProduct {
  name: string;
  price?: number | null;
  product_type?: string | null;
  description?: string | null;
  // Free text written by the brand (the "notes" of the brief)
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

export function buildBriefMessage(product: BriefProduct): string {
  const kind = product.product_type === "digital" ? "דיגיטלי" : "פיזי";
  const header = [`📦 בריף — ${product.name}`, `שווי: ₪${Number(product.price) || 0} · ${kind}`, ``];
  const data = sanitizeBriefData(product.brief_data);
  const notes = product.brief?.trim();
  // The default format line steps aside when the brand set its own format
  const terms = definesFormat(data) ? FORMAT_LINES.slice(1) : FORMAT_LINES;

  if (data || notes) {
    const body: string[] = [...briefDataLines(data)];
    if (notes) {
      if (body.length > 0) body.push(``);
      body.push(`הערות מהעסק:`, notes);
    }
    return [...header, ...body, ``, ...terms].join("\n");
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
