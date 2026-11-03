// The brief the creator receives in the chat when a match opens (pure, unit-tested).

export interface BriefProduct {
  name: string;
  price?: number | null;
  product_type?: string | null;
  description?: string | null;
  // Written by the brand on the product; when present it replaces the fill-in template
  brief?: string | null;
}

const FORMAT_LINES = [
  `פורמט: וידאו 15–45 שנ' · 9:16 · דיבור למצלמה · כתוביות בעברית`,
  `יעד להעלאה: עד 10 ימים מקבלת המוצר`,
  `זכויות שימוש: העסק רשאי להשתמש בסרטון בכל הערוצים שלו`,
];

export function buildBriefMessage(product: BriefProduct): string {
  const kind = product.product_type === "digital" ? "דיגיטלי" : "פיזי";
  const header = [`📦 בריף — ${product.name}`, `שווי: ₪${Number(product.price) || 0} · ${kind}`, ``];

  const brandBrief = product.brief?.trim();
  if (brandBrief) {
    return [...header, brandBrief, ``, ...FORMAT_LINES].join("\n");
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
