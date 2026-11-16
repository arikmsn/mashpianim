// The business's "סרטונים וחיוב" page copy (owner, 2026-11-16, modelled on a reference page): every string is
// editable in /admin → תוכן האתר (section BILLING_CONTENT_SECTION), these are the defaults. Pure, unit-tested.

export const BILLING_CONTENT_SECTION = "billing_page";

export const BILLING_CONTENT_DEFAULTS: Record<string, string> = {
  title: "סרטונים וחיוב",
  balance_label: "היתרה שלך",
  balance_note: "על כל חיבור שאתם מאשרים עם יוצר/ת יורד סרטון אחד מהיתרה. הסרטונים ביתרה לא פגים.",
  packages_title: "חבילות של סרטונים",
  discount_title: "מתנת פתיחה: {pct}% הנחה על חבילת הסרטונים הראשונה שלכם",
  discount_note: "ההנחה נכנסת לבד בסיכום ההזמנה, על כל חבילה.",
  package_name_single: "פעם ראשונה",
  package_name_pack5: "מוצאים מה עובד",
  package_name_pack10: "מעלים הילוך",
  package_name_pack20: "יוצאים לסקייל",
  per_video_label: "לסרטון",
  savings_note: "בחבילה הזו חוסכים {saving} מול קנייה של סרטונים בודדים",
  price_note: "המחירים כוללים מע״מ.",
  trust_1: "תשלום מאובטח בדף של SUMIT, בתקן PCI DSS",
  trust_2: "פרטי הכרטיס לא נשמרים אצלנו",
  trust_3: "חשבונית מס/קבלה נשלחת למייל",
  policy_line: "סרטון יורד מהיתרה רק כשאתם מאשרים חיבור עם יוצר/ת. חיבור שבוטל לפני שהמוצר נשלח מחזיר את הסרטון ליתרה. הסרטונים שקניתם לא פגים. ביטול חבילה שלא נוצלה אפשרי תוך 14 יום לפי מדיניות הביטולים.",
  includes_title: "מה כולל כל סרטון",
  includes_body:
    "• סרטון UGC אנכי, מצולם לפי הבריף שלכם, בדרך כלל 30–90 שניות\n• סבב תיקון אחד אם צריך, ואפשרות לקבל כמה גרסאות לבחירה באותו סבב\n• רישיון שימוש מלא בסרטון בכל הערוצים שלכם, והורדה באיכות מלאה\n• היוצר/ת מקבל/ת את המוצר ושומר/ת אותו",
  referral_title: "רוצים סרטונים בחינם?",
  referral_body: "הפניתם עסק שהצטרף ורכש חבילה? פנו אלינו דרך \"צור קשר\" עם שם העסק, ונטעין לכם 2 סרטונים מתנה.",
  faq_title: "שאלות ותשובות",
  faq:
    "ש: מתי יורד סרטון מהיתרה?\nת: רק כשאתם מאשרים חיבור עם יוצר/ת (אחרי מאטץ'). לב ששלחתם, או לב שקיבלתם ולא אישרתם, לא מוריד כלום.\n\n" +
    "ש: ואם ביטלתי אחרי שאישרתי?\nת: ביטול לפני שהמוצר נשלח מחזיר את הסרטון ליתרה אוטומטית. אחרי שהמוצר נשלח, הסרטון נשאר בחיבור.\n\n" +
    "ש: הסרטונים שקניתי פגים?\nת: לא. סרטון שקניתם נשאר ביתרה עד שתשתמשו בו.\n\n" +
    "ש: כמה סרטונים מקבלים מכל יוצר/ת?\nת: סרטון אחד לכל חיבור, ואם צריך, סבב תיקון אחד. היוצר/ת יכול/ה להעלות כמה גרסאות לבחירתכם באותו סבב.\n\n" +
    "ש: מה מותר לעשות עם הסרטונים?\nת: כל סרטון שאושר דרך האפליקציה זמין להורדה באיכות מלאה, עם רישיון שימוש בערוצים שלכם.\n\n" +
    "ש: איך משלמים?\nת: בכרטיס אשראי, בדף תשלום מאובטח של SUMIT. אנחנו לא רואים ולא שומרים את פרטי הכרטיס.\n\n" +
    "ש: מקבלים חשבונית?\nת: כן. חשבונית מס/קבלה נשלחת אוטומטית למייל שציינתם בעת הרכישה.\n\n" +
    "ש: אפשר לקבל החזר כספי?\nת: חבילה שלא נוצלה אפשר לבטל תוך 14 יום לפי מדיניות הביטולים. סרטון של חיבור שבוטל לפני המשלוח חוזר ליתרה.\n\n" +
    "ש: המוצר הגיע והסרטון לא עלה?\nת: ליוצר/ת יש 10 ימים לצלם מרגע שהמוצר הגיע. אם הזמן עבר, המערכת מתריעה ואפשר לפנות אלינו מתוך הצ'אט; חיבור שבוטל מחזיר את הסרטון ליתרה.",
  orders_title: "הזמנות",
  movements_title: "תנועות",
  empty_orders: "עדיין אין הזמנות.",
  empty_movements: "עדיין אין תנועות.",
  footer_note: "יוצר/ת מהאפליקציה פנה/תה אליכם ישירות מחוץ לפלטפורמה? ספרו לנו דרך \"צור קשר\".",
  cta: "מעבר לרכישה · {label} ב-{price}",
  cta_contact: "לרכישת סרטונים — צור קשר",
};

// What the admin edits (labels for /admin → תוכן האתר); the order is the page's order
export const BILLING_CONTENT_FIELDS: { key: string; label: string; type: "text" | "textarea" }[] = [
  { key: "title", label: "כותרת העמוד", type: "text" },
  { key: "balance_label", label: "יתרה — תווית", type: "text" },
  { key: "balance_note", label: "יתרה — הסבר", type: "textarea" },
  { key: "packages_title", label: "חבילות — כותרת", type: "text" },
  { key: "discount_title", label: "הנחת רכישה ראשונה — כותרת ({pct} = האחוז מההגדרות; מוצג רק כשההנחה > 0)", type: "text" },
  { key: "discount_note", label: "הנחת רכישה ראשונה — הסבר", type: "text" },
  { key: "package_name_single", label: "שם חבילת סרטון אחד", type: "text" },
  { key: "package_name_pack5", label: "שם חבילת 5 סרטונים", type: "text" },
  { key: "package_name_pack10", label: "שם חבילת 10 סרטונים", type: "text" },
  { key: "package_name_pack20", label: "שם חבילת 20 סרטונים", type: "text" },
  { key: "per_video_label", label: "מחיר לסרטון — תווית", type: "text" },
  { key: "savings_note", label: "שורת חיסכון ({saving} = הסכום)", type: "text" },
  { key: "price_note", label: "הערת מחירים", type: "text" },
  { key: "trust_1", label: "אמון — שורה 1", type: "text" },
  { key: "trust_2", label: "אמון — שורה 2", type: "text" },
  { key: "trust_3", label: "אמון — שורה 3", type: "text" },
  { key: "policy_line", label: "שורת מדיניות (מתחת לאמצעי התשלום)", type: "textarea" },
  { key: "includes_title", label: "מה כולל כל סרטון — כותרת", type: "text" },
  { key: "includes_body", label: "מה כולל כל סרטון — טקסט (שורה לכל נקודה)", type: "textarea" },
  { key: "referral_title", label: "סרטונים בחינם — כותרת (ריק = להסתיר)", type: "text" },
  { key: "referral_body", label: "סרטונים בחינם — טקסט", type: "textarea" },
  { key: "faq_title", label: "שאלות ותשובות — כותרת", type: "text" },
  { key: "faq", label: "שאלות ותשובות — כל שאלה בפורמט \"ש: …\" ושורה אחריה \"ת: …\", שורה ריקה בין שאלות", type: "textarea" },
  { key: "orders_title", label: "לשונית הזמנות", type: "text" },
  { key: "movements_title", label: "לשונית תנועות", type: "text" },
  { key: "empty_orders", label: "אין הזמנות — טקסט", type: "text" },
  { key: "empty_movements", label: "אין תנועות — טקסט", type: "text" },
  { key: "footer_note", label: "הערה בתחתית העמוד", type: "textarea" },
  { key: "cta", label: "כפתור הרכישה ({label} = החבילה, {price} = המחיר)", type: "text" },
  { key: "cta_contact", label: "כפתור כשהרכישה המקוונת סגורה", type: "text" },
];

export type BillingContent = Record<string, string>;

// Stored overrides on top of the defaults (a missing or empty-string key falls back to the default — except
// the referral block, which the admin may blank to hide)
export function mergeBillingContent(content: unknown): BillingContent {
  const all = (content && typeof content === "object" ? (content as Record<string, unknown>) : {})[BILLING_CONTENT_SECTION];
  const saved = (all && typeof all === "object" ? (all as Record<string, unknown>) : {}) as Record<string, unknown>;
  const out: BillingContent = { ...BILLING_CONTENT_DEFAULTS };
  for (const key of Object.keys(BILLING_CONTENT_DEFAULTS)) {
    const v = saved[key];
    if (typeof v !== "string") continue;
    if (v.trim() === "" && !key.startsWith("referral_")) continue;
    out[key] = v;
  }
  return out;
}

export function fillTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export interface FaqItem {
  q: string;
  a: string;
}

// "ש: question\nת: answer" blocks; a question without an answer is dropped, extra lines join the answer
export function parseFaq(text: string | null | undefined): FaqItem[] {
  const out: FaqItem[] = [];
  let q = "";
  let a: string[] = [];
  const flush = () => {
    if (q && a.length) out.push({ q, a: a.join("\n").trim() });
    q = "";
    a = [];
  };
  for (const raw of (text || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const qm = line.match(/^(?:ש|Q)\s*[:.]\s*(.+)$/i);
    const am = line.match(/^(?:ת|A)\s*[:.]\s*(.+)$/i);
    if (qm) {
      flush();
      q = qm[1].trim();
    } else if (am) {
      if (q) a.push(am[1].trim());
    } else if (q && a.length) {
      a.push(line);
    }
  }
  flush();
  return out;
}

// "• line" bullets (or plain lines) → list items
export function parseBullets(text: string | null | undefined): string[] {
  return (text || "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^[•\-*]\s*/, "").trim())
    .filter(Boolean);
}
