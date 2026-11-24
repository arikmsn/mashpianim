// The content registry of the public site (design package v3, "ניהול תוכן מהאדמין"): one schema that describes
// every visible string of the home page, the influencer quiz, the login / register screens, the legal documents,
// the SEO texts and the error pages, plus the in-app sections that were already editable (creator walkthrough,
// billing page). From this one file come the defaults, the admin form, the typed content object and the tests.
//
// Pure: no framework imports (unit-tested with node:test). Hebrew lives here and only here; the public pages
// render what getSiteContent() hands them.
//
// Conventions:
//   - `*word*` inside a headline marks the part that gets the signature gradient (hero) or the second tone
//     (section headlines). One marker per text.
//   - `{creators}`, `{videos}`, `{price_min}`, `{discount}`, `{days}` are replaced at render time
//     (resolveSiteContent) from the stats section and from site_settings.
//   - A stored override that is an empty string falls back to the default, unless the field says allowEmpty
//     (then the empty value hides the element, e.g. a sticker).
//   - The home page sections use the `home_` prefix so the rows of the old landing page (hero, brands, stats…)
//     are ignored rather than mixed into the new design.

import { ACCESSIBILITY, LEGAL_UPDATED_LABEL, PRIVACY, REFUNDS, TERMS, TERMS_VERSION } from "./legal.ts";
import { legalDocToMarkdown } from "./legal-markdown.ts";
import { ONBOARDING_CONTENT_DEFAULTS, ONBOARDING_MOMENTS_SECTION, ONBOARDING_WELCOME_SECTION } from "./onboarding.ts";
import { BILLING_CONTENT_DEFAULTS, BILLING_CONTENT_FIELDS, BILLING_CONTENT_SECTION } from "./billing-content.ts";
import { containsHtml } from "./markdown.ts";

export type FieldType = "text" | "textarea" | "list" | "select" | "toggle" | "number" | "url" | "markdown";
export type ContentPage = "home" | "quiz" | "legal" | "seo" | "system";

export interface ItemField {
  key: string;
  label: string;
  type: "text" | "textarea" | "url";
  help?: string;
  max?: number;
  // A stable identifier the code relies on (quiz option keys): shown, not meant to be edited
  stable?: boolean;
}

export interface ContentField {
  key: string;
  label: string;
  type: FieldType;
  default: unknown;
  help?: string;
  max?: number;
  min?: number;
  options?: readonly { value: string; label: string }[];
  item?: readonly ItemField[];
  minItems?: number;
  maxItems?: number;
  allowEmpty?: boolean;
  readonly?: boolean;
  // Extra {placeholders} this field's own renderer fills (besides CONTENT_VARIABLES), so they are not flagged
  variables?: readonly string[];
}

export interface ContentSection {
  id: string;
  page: ContentPage;
  label: string;
  help?: string;
  // The anchor on the public page ("/#biz") the admin's "view page" link opens
  anchor?: string;
  fields: readonly ContentField[];
}

export const CONTENT_PAGES: readonly { id: ContentPage; label: string; path: string }[] = [
  { id: "home", label: "דף הבית", path: "/" },
  { id: "quiz", label: "שאלון", path: "/#inf" },
  { id: "legal", label: "משפטי", path: "/terms" },
  { id: "seo", label: "SEO", path: "/" },
  { id: "system", label: "מערכת", path: "/login" },
];

export const CONTENT_VARIABLES = ["creators", "videos", "price_min", "discount", "days"] as const;
export type ContentVariable = (typeof CONTENT_VARIABLES)[number];
export type ContentVars = Record<ContentVariable, string | number>;

const VARIABLES_HELP = "משתנים: {creators} {videos} {price_min} {discount} {days}";
const MARKER_HELP = "החלק בין * * מקבל את הצבע השני";

// Real counts on 2026-11-23 (137 creators, 353 portfolio videos); "עדכון מהמערכת" in the admin refreshes them
// Shown as "500+" until the real count passes it ("עדכון מהמערכת" never lowers the number on the page)
const STATS_CREATORS_DEFAULT = "500";
const STATS_VIDEOS_DEFAULT = "353";

const listItem = (key: string, label: string, type: ItemField["type"] = "text", max?: number, extra?: Partial<ItemField>): ItemField => ({
  key,
  label,
  type,
  ...(max ? { max } : {}),
  ...(extra || {}),
});

const QUIZ_OPTION_ITEM = [
  listItem("key", "מפתח (נשמר בליד, לא לשנות)", "text", 24, { stable: true }),
  listItem("tag", "תגית מונו (לטינית / ספרות)", "text", 12),
  listItem("title", "כותרת", "text", 30),
  listItem("sub", "שורת הסבר", "text", 50),
] as const;

const onboardingWelcome = ONBOARDING_CONTENT_DEFAULTS[ONBOARDING_WELCOME_SECTION];
const onboardingMoments = ONBOARDING_CONTENT_DEFAULTS[ONBOARDING_MOMENTS_SECTION];

export const SITE_CONTENT_SCHEMA = [
  // ------------------------------------------------------------------------------------------ home
  {
    id: "home_nav",
    page: "home",
    label: "ניווט",
    anchor: "top",
    fields: [
      { key: "brand_name", label: "שם המותג ליד הלוגו", type: "text", default: "משפיען אונליין", max: 30 },
      { key: "link1_label", label: "קישור 1", type: "text", default: "לעסקים", max: 20 },
      { key: "link1_href", label: "קישור 1, עוגן", type: "url", default: "#biz", max: 80 },
      { key: "link2_label", label: "קישור 2", type: "text", default: "ליוצרי תוכן", max: 20 },
      { key: "link2_href", label: "קישור 2, עוגן", type: "url", default: "#ugc", max: 80 },
      { key: "link3_label", label: "קישור 3", type: "text", default: "משפיענים", max: 20 },
      { key: "link3_href", label: "קישור 3, עוגן", type: "url", default: "#inf", max: 80 },
      { key: "link4_label", label: "קישור 4", type: "text", default: "איך זה עובד", max: 20 },
      { key: "link4_href", label: "קישור 4, עוגן", type: "url", default: "#how", max: 80 },
      { key: "login", label: "כפתור כניסה", type: "text", default: "כניסה", max: 20 },
      { key: "cta_creator", label: "כפתור ליוצרי תוכן (לימון)", type: "text", default: "ליוצרי תוכן", max: 20 },
      { key: "cta_brand", label: "כפתור לעסקים (ורוד)", type: "text", default: "לעסקים", max: 20 },
      { key: "menu_label", label: "תיאור כפתור התפריט (קוראי מסך)", type: "text", default: "תפריט", max: 20 },
    ],
  },
  {
    id: "home_hero",
    page: "home",
    label: "הירו",
    anchor: "top",
    fields: [
      { key: "eyebrow", label: "תגית מעל הכותרת", type: "text", default: "תוכן אמיתי, מאנשים אמיתיים", max: 40 },
      { key: "title", label: "כותרת", help: `${MARKER_HELP} (גרדיאנט ורוד-כתום)`, type: "text", default: "סקירת וידאו מיוצרי תוכן אמיתיים. *יוצרים אמון אצל לקוחות.*", max: 90 },
      {
        key: "subtitle",
        label: "תת כותרת, שורה 1 (לעסקים)",
        type: "textarea",
        default: "עסקים מקבלים ביקורות וידאו חיוביות על המוצר שלהם מיוצרי תוכן אמיתיים.",
        max: 160,
      },
      {
        key: "subtitle2",
        label: "תת כותרת, שורה 2 (ליוצרים ולמשפיענים, ריק = לא מוצג)",
        type: "textarea",
        default: "יוצרים מקבלים מוצרים ותיק עבודות, ומשפיענים משתבצים לנבחרת הקמפיין.",
        max: 160,
        allowEmpty: true,
      },
      { key: "cta_primary", label: "כפתור עסקים (ורוד)", type: "text", default: "אני בעל/ת עסק", max: 24 },
      { key: "cta_secondary", label: "כפתור יוצרים (לימון)", type: "text", default: "אני יוצר/ת תוכן", max: 24 },
      { key: "how_link", label: "קישור טקסט מתחת לכפתורים", type: "text", default: "איך זה עובד", max: 24 },
      { key: "sticker1", label: "סטיקר לימון ליד הכותרת (ריק = לא מוצג)", type: "text", default: "", max: 16, allowEmpty: true },
      { key: "sticker2", label: "סטיקר ורוד ליד הכותרת (ריק = לא מוצג)", help: VARIABLES_HELP, type: "text", default: "", max: 16, allowEmpty: true },
      { key: "counter_line", label: "שורת המונים מתחת למניפה (ריק = לא מוצג)", help: VARIABLES_HELP, type: "text", default: "", max: 60, allowEmpty: true },
      { key: "fan_label", label: "תיאור המניפה (קוראי מסך)", type: "text", default: "סרטוני יוצרים מהמערכת", max: 40 },
      { key: "demo_note", label: "הערה מתחת למניפה (ריק = לא מוצג)", type: "text", default: "", max: 90, allowEmpty: true },
    ],
  },
  {
    id: "home_fan",
    page: "home",
    label: "מניפת הסרטונים בהירו",
    help: "סרטוני תיק עבודות אמיתיים מהמערכת (כתובות ציבוריות מה-bucket). הסרטון האמצעי מתנגן לבד בלי קול, השאר בלחיצה. כל שורה: סרטון, פוסטר, כיתוב (שם, תחום), תגית קטנה (ריק = לא מוצג).",
    anchor: "top",
    fields: [
      { key: "autoplay", label: "הסרטון האמצעי מתנגן לבד (בלי קול)", type: "toggle", default: true },
      {
        key: "tiles",
        label: "הסרטונים (4 עד 8, האמצעיים מוצגים גם במובייל)",
        type: "list",
        minItems: 4,
        maxItems: 8,
        item: [listItem("video_url", "כתובת הסרטון", "url", 300), listItem("poster_url", "כתובת הפוסטר", "url", 300), listItem("caption", "כיתוב", "text", 30), listItem("tag", "תגית (ריק = לא מוצג)", "text", 10)],
        // Seven uploads since the HEVC block (H.264, playable everywhere) whose first-frame poster is not black;
        // the lightest sit in the middle because the middle tile is the one that autoplays
        default: [
          { video_url: "https://rhhfzvmiwhmnviznxvlv.supabase.co/storage/v1/object/public/videos/portfolio/2dedc597-7160-4c65-adb5-a286350b9b39/1795178954457.mov", poster_url: "https://rhhfzvmiwhmnviznxvlv.supabase.co/storage/v1/object/public/thumbnails/portfolio/2dedc597-7160-4c65-adb5-a286350b9b39/1795178954457.jpg", caption: "עדן, בית", tag: "" },
          { video_url: "https://rhhfzvmiwhmnviznxvlv.supabase.co/storage/v1/object/public/videos/portfolio/7f12a68b-136c-4bd2-92dc-e72e19689762/1795110806872.mov", poster_url: "https://rhhfzvmiwhmnviznxvlv.supabase.co/storage/v1/object/public/thumbnails/portfolio/7f12a68b-136c-4bd2-92dc-e72e19689762/1795110806872.jpg", caption: "שילת, ביוטי", tag: "" },
          { video_url: "https://rhhfzvmiwhmnviznxvlv.supabase.co/storage/v1/object/public/videos/portfolio/88f47b65-0218-4ab0-9371-d153c5fbc195/1795175583705.mov", poster_url: "https://rhhfzvmiwhmnviznxvlv.supabase.co/storage/v1/object/public/thumbnails/portfolio/88f47b65-0218-4ab0-9371-d153c5fbc195/1795175583705.jpg", caption: "מעיין, ילדים", tag: "" },
          { video_url: "https://rhhfzvmiwhmnviznxvlv.supabase.co/storage/v1/object/public/videos/portfolio/3a70b414-6d62-4821-8c9d-dd8ff1041a3b/1795084092175.mov", poster_url: "https://rhhfzvmiwhmnviznxvlv.supabase.co/storage/v1/object/public/thumbnails/portfolio/3a70b414-6d62-4821-8c9d-dd8ff1041a3b/1795084092175.jpg", caption: "שיר, אופנה", tag: "" },
          { video_url: "https://rhhfzvmiwhmnviznxvlv.supabase.co/storage/v1/object/public/videos/portfolio/000903ff-2dd7-4db4-bd54-80ee7293b851/1795123978541.mp4", poster_url: "https://rhhfzvmiwhmnviznxvlv.supabase.co/storage/v1/object/public/thumbnails/portfolio/000903ff-2dd7-4db4-bd54-80ee7293b851/1795123978541.jpg", caption: "אודיה, ביוטי", tag: "" },
          { video_url: "https://rhhfzvmiwhmnviznxvlv.supabase.co/storage/v1/object/public/videos/portfolio/e3ba971f-dbf7-4857-b4be-948dae255ab0/1795387326294.mov", poster_url: "https://rhhfzvmiwhmnviznxvlv.supabase.co/storage/v1/object/public/thumbnails/portfolio/e3ba971f-dbf7-4857-b4be-948dae255ab0/1795387326294.jpg", caption: "שילת, טיפוח", tag: "" },
          { video_url: "https://rhhfzvmiwhmnviznxvlv.supabase.co/storage/v1/object/public/videos/portfolio/6716c467-1df3-4004-bb69-1f1266fabeb9/1795191572100.mov", poster_url: "https://rhhfzvmiwhmnviznxvlv.supabase.co/storage/v1/object/public/thumbnails/portfolio/6716c467-1df3-4004-bb69-1f1266fabeb9/1795191572100.jpg", caption: "ויקטוריה, אופנה", tag: "" },
        ],
      },
    ],
  },
  {
    id: "home_tracks",
    page: "home",
    label: "שלושת כרטיסי המסלול",
    anchor: "tracks",
    fields: [
      { key: "aria_label", label: "תיאור האזור (קוראי מסך)", type: "text", default: "שלושת המסלולים", max: 40 },
      { key: "brand_tag", label: "עסקים, תגית בפינה (ריק = לא מוצג)", type: "text", default: "", max: 12, allowEmpty: true },
      { key: "brand_title", label: "עסקים, כותרת", type: "text", default: "אני בעל/ת עסק", max: 30 },
      { key: "brand_desc", label: "עסקים, טקסט", type: "textarea", default: "רוצה ביקורות וידאו חיוביות על המוצר שלי, מלקוחות אמיתיים. בלי סוכנות ובלי הפקה.", max: 140 },
      { key: "brand_cta", label: "עסקים, כפתור", type: "text", default: "הרשמה כעסק", max: 24 },
      { key: "creator_tag", label: "יוצרים, תגית בפינה (ריק = לא מוצג)", type: "text", default: "", max: 12, allowEmpty: true },
      { key: "creator_title", label: "יוצרים, כותרת", type: "text", default: "אני יוצר/ת תוכן", max: 30 },
      { key: "creator_desc", label: "יוצרים, טקסט", type: "textarea", default: "מקבלים מוצר, מצלמים סרטון קצר, ובונים תיק עבודות עם מותגים אמיתיים.", max: 140 },
      { key: "creator_cta", label: "יוצרים, כפתור", type: "text", default: "הרשמה כיוצר/ת", max: 24 },
      { key: "influencer_badge", label: "משפיענים, סטיקר (ריק = לא מוצג)", type: "text", default: "חדש", max: 12, allowEmpty: true },
      { key: "influencer_title", label: "משפיענים, כותרת", type: "text", default: "אני מחפש/ת משפיענים", max: 30 },
      { key: "influencer_desc", label: "משפיענים, טקסט", type: "textarea", default: "מחפשים משפיענים לקמפיין? חמש שאלות קצרות ופרטי קשר, ונחזור אליכם עם משפיענים מתאימים מהמאגר שלנו.", max: 140 },
      { key: "influencer_cta", label: "משפיענים, כפתור", type: "text", default: "בונים נבחרת", max: 24 },
    ],
  },
  {
    id: "home_brands",
    page: "home",
    label: "לעסקים",
    anchor: "biz",
    fields: [
      { key: "eyebrow", label: "תגית", type: "text", default: "לעסקים", max: 30 },
      { key: "title", label: "כותרת", help: MARKER_HELP, type: "text", default: "ביקורות וידאו חיוביות על המוצר שלכם. *מלקוחות אמיתיים, לכל ערוץ.*", max: 90 },
      { key: "subtitle", label: "פסקת פתיחה", type: "textarea", default: "יוצרי תוכן מקבלים את המוצר, מצלמים ביקורת כנה ומומלצת, ואתם מקבלים סרטון שמוכר: לעמוד המוצר, לפרסום הממומן, לרשתות ולתוכנית התוכן שלכם.", max: 220 },
      {
        key: "benefits",
        label: "למה עסקים עושים את זה (ארבע נקודות)",
        type: "list",
        minItems: 2,
        maxItems: 4,
        item: [listItem("title", "כותרת", "text", 30), listItem("desc", "טקסט", "text", 110)],
        default: [
          { title: "ביקורות חיוביות", desc: "לקוחות אמיתיים מספרים למה המוצר שלכם טוב. זה מה שמשכנע לקוחות חדשים." },
          { title: "סרטון לעמוד המוצר", desc: "ביקורת וידאו בדף המוצר ובאתר מעלה אמון ומכירות." },
          { title: "חומר לפרסום ממומן", desc: "סרטוני UGC עובדים בפרסום בפייסבוק, באינסטגרם ובטיקטוק." },
          { title: "בסיס לתוכנית התוכן", desc: "כל סרטון נכנס למאגר התוכן שלכם, לשימוש חוזר ברשתות." },
        ],
      },
      { key: "process_title", label: "כותרת התהליך (ארבעת הצעדים)", type: "text", default: "ככה זה עובד לעסק, בארבעה צעדים", max: 60 },
      { key: "bento1_title", label: "צעד 1, כותרת", type: "text", default: "בוחרים יוצרים מהגלריה", max: 30 },
      { key: "bento1_desc", label: "צעד 1, טקסט", type: "textarea", default: "מסננים לפי קטגוריה, עיר ותיק עבודות, ורואים את הסרטונים לפני שבוחרים.", max: 140 },
      { key: "gallery_heart", label: "צעד 1, כפתור הלב (קוראי מסך)", type: "text", default: "לב: רוצים את היוצר/ת", max: 30 },
      { key: "gallery_pass", label: "צעד 1, כפתור הדילוג (קוראי מסך)", type: "text", default: "דילוג", max: 30 },
      { key: "bento2_title", label: "צעד 2, כותרת", type: "text", default: "התאמה הדדית", max: 30 },
      { key: "bento2_desc", label: "צעד 2, טקסט", type: "textarea", default: "לב מהעסק, לב מהיוצר, ויש חיבור. הקרדיט יורד רק כשיש התאמה.", max: 140 },
      { key: "bento2_sample", label: "צעד 2, שורת הדגמה", type: "text", default: "היוצרת אישרה את הבקשה", max: 40 },
      { key: "bento2_sample_tag", label: "צעד 2, תגית הדגמה", type: "text", default: "חיבור", max: 16 },
      { key: "bento3_title", label: "צעד 3, כותרת", type: "text", default: "צ'אט מנוהל עד הסרטון", max: 30 },
      { key: "bento3_desc", label: "צעד 3, טקסט", type: "textarea", default: "משלוח, קבלה, צילום, אישור. הכל בשיחה אחת בתוך המערכת, עם מועדים ברורים.", max: 140 },
      { key: "bento3_bubble1", label: "צעד 3, בועה 1 (העסק)", type: "text", default: "המוצר נשלח, מספר מעקב בפנים", max: 40 },
      { key: "bento3_bubble2", label: "צעד 3, בועה 2 (היוצרת)", type: "text", default: "קיבלתי! מצלמת השבוע", max: 40 },
      { key: "bento3_bubble3", label: "צעד 3, בועה 3 (העסק, ריק = לא מוצג)", type: "text", default: "מעולה, מחכים לסרטון", max: 40, allowEmpty: true },
      { key: "bento4_title", label: "צעד 4, כותרת", type: "text", default: "ביקורת וידאו מאושרת, לכל ערוץ", max: 32 },
      { key: "bento4_desc", label: "צעד 4, טקסט", type: "textarea", default: "סבב תיקונים אחד, אישור, והסרטון שלכם: לאתר, לפרסום הממומן ולרשתות.", max: 140 },
      { key: "approved_badge", label: "צעד 4, תגית על הסרטונים", type: "text", default: "אושר", max: 12 },
      { key: "screenshot_caption", label: "כיתוב קטן באריח הגלריה (ריק = לא מוצג)", type: "text", default: "", max: 30, allowEmpty: true },
      {
        key: "gallery_posters",
        label: "צעד 1 ו-2, פוסטרים אמיתיים (3 לגלריה, עוד 2 להתאמה)",
        type: "list",
        minItems: 3,
        maxItems: 6,
        item: [listItem("image_url", "כתובת התמונה", "url", 300), listItem("caption", "כיתוב (קוראי מסך)", "text", 30)],
        // Other creators than the hero fan, bright and colourful first frames (measured), first = the deck's front card
        default: [
          { image_url: "https://rhhfzvmiwhmnviznxvlv.supabase.co/storage/v1/object/public/thumbnails/portfolio/d1ab1b98-acf2-4fad-9634-c881a44e9836/1794924132972.jpg", caption: "אורית, ביוטי" },
          { image_url: "https://rhhfzvmiwhmnviznxvlv.supabase.co/storage/v1/object/public/thumbnails/portfolio/7107b79a-ccad-4107-8f27-afd784a592ca/1794730217375.jpg", caption: "מור, ביוטי" },
          { image_url: "https://rhhfzvmiwhmnviznxvlv.supabase.co/storage/v1/object/public/thumbnails/portfolio/01d1be7c-107a-47c6-8f60-fe241fd34cf2/1794750493046.jpg", caption: "אפק, אופנה" },
          { image_url: "https://rhhfzvmiwhmnviznxvlv.supabase.co/storage/v1/object/public/thumbnails/portfolio/a372b5e3-faa0-434b-aa8e-98bccfbe0b32/1794767832832.jpg", caption: "ליעד, ביוטי" },
          { image_url: "https://rhhfzvmiwhmnviznxvlv.supabase.co/storage/v1/object/public/thumbnails/portfolio/58b203ce-ca41-4163-890c-7495831e939a/1794829584142.jpg", caption: "גל, אופנה" },
          { image_url: "https://rhhfzvmiwhmnviznxvlv.supabase.co/storage/v1/object/public/thumbnails/portfolio/fe828027-a23b-44b6-b43c-de78dc615118/1794413758000.jpg", caption: "מיכל, אוכל" },
        ],
      },
      {
        key: "approved_posters",
        label: "צעד 4, סרטונים מאושרים, פוסטרים אמיתיים (1 עד 3)",
        type: "list",
        minItems: 1,
        maxItems: 3,
        item: [listItem("image_url", "כתובת התמונה", "url", 300), listItem("caption", "כיתוב (קוראי מסך)", "text", 30)],
        default: [
          { image_url: "https://rhhfzvmiwhmnviznxvlv.supabase.co/storage/v1/object/public/thumbnails/portfolio/15000d53-a88c-4f2e-9e94-1fb388e7a17c/1794403748859.jpg", caption: "מירית, טכנולוגיה" },
          { image_url: "https://rhhfzvmiwhmnviznxvlv.supabase.co/storage/v1/object/public/thumbnails/portfolio/b6f89ffb-c773-49be-9b9d-7cc0361031e7/1794428874787.jpg", caption: "רעות, טכנולוגיה" },
          { image_url: "https://rhhfzvmiwhmnviznxvlv.supabase.co/storage/v1/object/public/thumbnails/portfolio/8bf3b232-59a9-4151-880d-865da1e90096/1794416937437.jpg", caption: "מוריה, אוכל" },
        ],
      },
      { key: "cta_primary", label: "כפתור ראשי (מוביל להרשמה ומשם ישר לרכישה)", type: "text", default: "רכישת הסרטון הראשון", max: 30 },
      { key: "cta_secondary", label: "כפתור משני", type: "text", default: "איך זה עובד", max: 24 },
      { key: "price_note", label: "שורת המחיר", help: VARIABLES_HELP, type: "text", default: "חבילות מ-{price_min} ₪ לסרטון. {discount}% הנחה ברכישה הראשונה.", max: 80 },
    ],
  },
  {
    id: "home_stats",
    page: "home",
    label: "מספרים",
    help: "המספרים מוצגים תמיד מהערך השמור. \"עדכון מהמערכת\" ממלא את 1 ו-2 מספירה אמיתית ושומר.",
    anchor: "biz",
    fields: [
      { key: "stat1_value", label: "מספר 1 (יוצרים)", help: "מוצג כמו שהוא. \"עדכון מהמערכת\" מחליף אותו רק כשהספירה האמיתית גדולה ממנו.", type: "text", default: STATS_CREATORS_DEFAULT, max: 8 },
      { key: "stat1_suffix", label: "מספר 1, סיומת (למשל +)", type: "text", default: "+", max: 8, allowEmpty: true },
      { key: "stat1_label", label: "מספר 1, תווית", type: "text", default: "יוצרי תוכן רשומים", max: 40 },
      { key: "stat1_source", label: "מספר 1, שורת המקור (ריק = לא מוצג)", type: "text", default: "מהמערכת", max: 30, allowEmpty: true },
      { key: "stat1_dark", label: "מספר 1 על אריח כהה", type: "toggle", default: false },
      { key: "stat2_value", label: "מספר 2 (סרטונים)", type: "text", default: STATS_VIDEOS_DEFAULT, max: 8 },
      { key: "stat2_suffix", label: "מספר 2, סיומת", type: "text", default: "", max: 8, allowEmpty: true },
      { key: "stat2_label", label: "מספר 2, תווית", type: "text", default: "סרטונים שנוצרו", max: 40 },
      { key: "stat2_source", label: "מספר 2, שורת המקור (ריק = לא מוצג)", type: "text", default: "מהמערכת", max: 30, allowEmpty: true },
      { key: "stat2_dark", label: "מספר 2 על אריח כהה", type: "toggle", default: false },
      { key: "stat3_value", label: "מספר 3 (ימים)", help: `${VARIABLES_HELP} עברית מותרת, למשל "כ-7".`, type: "text", default: "כ-7", max: 8 },
      { key: "stat3_suffix", label: "מספר 3, סיומת", type: "text", default: "ימים", max: 8, allowEmpty: true },
      { key: "stat3_label", label: "מספר 3, תווית", type: "text", default: "מרגע קבלת המוצר ועד סרטון", max: 40 },
      { key: "stat3_source", label: "מספר 3, שורת המקור (ריק = לא מוצג)", type: "text", default: "מדיניות המערכת", max: 30, allowEmpty: true },
      { key: "stat3_dark", label: "מספר 3 על אריח כהה", type: "toggle", default: true },
    ],
  },
  {
    id: "home_how",
    page: "home",
    label: "איך זה עובד",
    anchor: "how",
    fields: [
      { key: "eyebrow", label: "תגית", type: "text", default: "איך זה עובד", max: 30 },
      { key: "title", label: "כותרת", help: MARKER_HELP, type: "text", default: "ארבעה צעדים. *שלושה שבועות.*", max: 60 },
      {
        key: "steps",
        label: "הצעדים",
        type: "list",
        minItems: 3,
        maxItems: 6,
        item: [listItem("tag", "תגית מונו (01, 03 · 10D)", "text", 12), listItem("title", "כותרת", "text", 30), listItem("desc", "טקסט", "text", 90)],
        default: [
          { tag: "01", title: "מעלים מוצר", desc: "תיאור קצר, בריף, וכמה יוצרים רוצים." },
          { tag: "02", title: "בוחרים יוצרים", desc: "מהגלריה או מהלבבות שכבר מחכים לכם." },
          { tag: "03", title: "שולחים את המוצר", desc: "מעקב משלוח בצ'אט. היוצר מצלם תוך {days} ימים." },
          { tag: "04", title: "מאשרים ומורידים", desc: "סבב תיקונים אחד, אישור, והסרטון שלכם." },
        ],
      },
    ],
  },
  {
    id: "home_creators",
    page: "home",
    label: "ליוצרי תוכן",
    anchor: "ugc",
    fields: [
      { key: "eyebrow", label: "תגית", type: "text", default: "ליוצרי תוכן", max: 30 },
      { key: "title", label: "כותרת", help: MARKER_HELP, type: "text", default: "שיתוף הפעולה הראשון שלך עם מותג. *בלי עוקבים.*", max: 80 },
      { key: "subtitle", label: "פסקת פתיחה", type: "textarea", default: "צריך 5 סרטונים בתיק העבודות, ומשם: מוצר בחינם, סרטון, והוכחה שעבדת עם מותג אמיתי.", max: 200 },
      {
        key: "steps",
        label: "שלושת הצעדים",
        type: "list",
        minItems: 2,
        maxItems: 5,
        item: [listItem("tag", "תגית מונו", "text", 8), listItem("title", "כותרת", "text", 40), listItem("desc", "טקסט", "text", 80)],
        default: [
          { tag: "01", title: "מעלים 5 סרטוני דוגמה", desc: "כל סרטון שצילמת על מוצר שאת אוהבת" },
          { tag: "02", title: "שולחים לב למוצר שמתאים", desc: "העסק מאשר, המוצר יוצא אלייך" },
          { tag: "03", title: "מצלמים, מעלים, מקבלים אישור", desc: "הסרטון נכנס לתיק העבודות שלך, עם שם המותג" },
        ],
      },
      { key: "cta_primary", label: "כפתור ראשי (לימון)", type: "text", default: "הרשמה כיוצר/ת", max: 24 },
      { key: "cta_secondary", label: "כפתור משני", type: "text", default: "מה מצפים ממני", max: 24 },
    ],
  },
  {
    id: "home_influencers",
    page: "home",
    label: "משפיענים (המקטע סביב השאלון)",
    anchor: "inf",
    fields: [
      { key: "eyebrow", label: "תגית", type: "text", default: "משפיענים · מסלול חדש", max: 30 },
      { key: "title", label: "כותרת", help: MARKER_HELP, type: "text", default: "ספרו לנו מה אתם מחפשים. *נחזור אליכם עם נבחרת.*", max: 80 },
      {
        key: "subtitle",
        label: "פסקת פתיחה",
        type: "textarea",
        default: "חמש שאלות קצרות: כמה עוקבים, איזו פלטפורמה, איפה בארץ, כמה סרטונים ומה המוצר. משאירים פרטים, ואנחנו חוזרים אליכם בטלפון או במייל עם משפיענים מתאימים מהמאגר שלנו.",
        max: 240,
      },
      {
        key: "bullets",
        label: "שלוש הנקודות",
        type: "list",
        minItems: 1,
        maxItems: 4,
        item: [listItem("tag", "תגית מונו", "text", 8), listItem("text", "טקסט", "text", 80)],
        default: [
          { tag: "01", text: "דקה אחת. חמש שאלות קצרות, בלי טפסים ארוכים." },
          { tag: "02", text: "בלי התחייבות. מקבלים הצעה, ואתם מחליטים." },
          { tag: "03", text: "אדם אמיתי חוזר אליכם, בטלפון או במייל, עם משפיענים מהמאגר." },
        ],
      },
      { key: "card_eyebrow", label: "תגית בכרטיס השאלון", type: "text", default: "בונים נבחרת", max: 24 },
      { key: "privacy_note", label: "שורת הרגעה ליד כפתור ההמשך", type: "text", default: "הפרטים נשארים אצלנו. בלי שליחה למשפיענים בלי אישורכם.", max: 90 },
      { key: "cta_next", label: "כפתור המשך", type: "text", default: "המשך", max: 16 },
      { key: "cta_back", label: "כפתור חזרה", type: "text", default: "חזרה", max: 16 },
    ],
  },
  {
    id: "home_cta",
    page: "home",
    label: "מקטע הסגירה",
    anchor: "closing",
    fields: [
      { key: "eyebrow", label: "תגית", type: "text", default: "מתחילים", max: 30 },
      { key: "title", label: "כותרת", help: `${MARKER_HELP} (לימון על כהה)`, type: "text", default: "מותגים גדולים מתחילים *בתוכן אמיתי.*", max: 70 },
      { key: "subtitle", label: "פסקה", help: VARIABLES_HELP, type: "textarea", default: "{creators} יוצרים כבר כאן. חלקם כבר סימנו שהם רוצים לצלם את המוצרים שלכם.", max: 160 },
      { key: "cta_primary", label: "כפתור עסקים (ורוד)", type: "text", default: "אני בעל/ת עסק", max: 24 },
      { key: "cta_secondary", label: "כפתור יוצרים (לימון)", type: "text", default: "אני יוצר/ת תוכן", max: 24 },
    ],
  },
  {
    id: "home_footer",
    page: "home",
    label: "פוטר",
    anchor: "footer",
    fields: [
      { key: "logo_tagline", label: "שם ליד הלוגו", type: "text", default: "משפיען אונליין", max: 30 },
      {
        key: "links",
        label: "קישורים",
        type: "list",
        minItems: 1,
        maxItems: 6,
        item: [listItem("label", "טקסט", "text", 24), listItem("href", "כתובת (יחסית או https)", "url", 120)],
        default: [
          { label: "תנאי שימוש", href: "/terms" },
          { label: "פרטיות", href: "/privacy" },
          { label: "ביטולים", href: "/refunds" },
          { label: "נגישות", href: "/accessibility" },
        ],
      },
      { key: "login", label: "קישור כניסה", type: "text", default: "כניסה", max: 20 },
      { key: "copyright", label: "שורת הזכויות", type: "text", default: "© 2026 משפיען אונליין", max: 40 },
    ],
  },
  {
    id: "home_mobile",
    page: "home",
    label: "מובייל (סרגל דביק ותפריט)",
    anchor: "top",
    fields: [
      { key: "sticky_primary", label: "כפתור דביק, עסקים", type: "text", default: "בעל/ת עסק", max: 20 },
      { key: "sticky_secondary", label: "כפתור דביק, יוצרים", type: "text", default: "יוצר/ת תוכן", max: 20 },
      { key: "menu_login", label: "תפריט, כניסה", type: "text", default: "כניסה", max: 20 },
      { key: "menu_close", label: "תפריט, סגירה (קוראי מסך)", type: "text", default: "סגירה", max: 20 },
    ],
  },
  // ------------------------------------------------------------------------------------------ quiz
  {
    id: "quiz",
    page: "quiz",
    label: "שאלון המשפיענים",
    anchor: "inf",
    help: "המפתחות של האפשרויות נשמרים בליד. לשנות טקסטים, לא מפתחות.",
    fields: [
      { key: "q1_question", label: "שאלה 1 (סליידר עוקבים)", type: "text", default: "כמה עוקבים למשפיען/ית שאתם מחפשים?", max: 60 },
      { key: "q1_hint", label: "שאלה 1, רמז", type: "text", default: "גררו את הסליידר. בערך זה מספיק.", max: 60 },
      { key: "q1_multi", label: "שאלה 1, בחירה מרובה", type: "toggle", default: false },
      {
        key: "q1_options",
        label: "שאלה 1, תחנות הסליידר (מהקטן לגדול; התגית = טווח העוקבים)",
        type: "list",
        minItems: 2,
        maxItems: 8,
        item: QUIZ_OPTION_ITEM,
        default: [
          { key: "nano", tag: "עד 10K", title: "ננו", sub: "אותנטי, מקומי, משתלם" },
          { key: "micro", tag: "10K עד 50K", title: "מיקרו", sub: "קהל נאמן בנישה" },
          { key: "mid", tag: "50K עד 100K", title: "בינוני", sub: "קהל רחב ועדיין אישי" },
          { key: "macro", tag: "100K+", title: "גדולים", sub: "חשיפה רחבה" },
        ],
      },
      { key: "q2_question", label: "שאלה 2 (פלטפורמות, אייקונים)", type: "text", default: "באילו פלטפורמות?", max: 60 },
      { key: "q2_hint", label: "שאלה 2, רמז", type: "text", default: "אפשר לבחור כמה, או לדלג.", max: 60 },
      { key: "q2_multi", label: "שאלה 2, בחירה מרובה", type: "toggle", default: true },
      {
        key: "q2_options",
        label: "שאלה 2, אפשרויות (המפתח בוחר את האייקון: instagram, tiktok, youtube, facebook)",
        type: "list",
        minItems: 2,
        maxItems: 8,
        item: QUIZ_OPTION_ITEM,
        default: [
          { key: "instagram", tag: "", title: "אינסטגרם", sub: "רילס וסטורי" },
          { key: "tiktok", tag: "", title: "טיקטוק", sub: "סרטונים קצרים" },
          { key: "youtube", tag: "", title: "יוטיוב", sub: "שורטס או ארוך" },
          { key: "facebook", tag: "", title: "פייסבוק", sub: "קבוצות וקהילות" },
        ],
      },
      { key: "q3_question", label: "שאלה 3 (אזורים, צ'יפים)", type: "text", default: "איפה בארץ הקהל שלכם?", max: 60 },
      { key: "q3_hint", label: "שאלה 3, רמז", type: "text", default: "אפשר לבחור כמה אזורים, או לדלג.", max: 60 },
      { key: "q3_multi", label: "שאלה 3, בחירה מרובה", type: "toggle", default: true },
      {
        key: "q3_options",
        label: "שאלה 3, אפשרויות (אזורי הארץ כמו בסינון של העסקים)",
        type: "list",
        minItems: 2,
        maxItems: 12,
        item: QUIZ_OPTION_ITEM,
        default: [
          { key: "all", tag: "", title: "כל הארץ / אונליין", sub: "" },
          { key: "north", tag: "", title: "צפון", sub: "" },
          { key: "haifa", tag: "", title: "חיפה והקריות", sub: "" },
          { key: "sharon", tag: "", title: "השרון", sub: "" },
          { key: "center", tag: "", title: "המרכז", sub: "" },
          { key: "tel_aviv", tag: "", title: "תל אביב", sub: "" },
          { key: "jerusalem", tag: "", title: "ירושלים והסביבה", sub: "" },
          { key: "shfela", tag: "", title: "השפלה", sub: "" },
          { key: "south", tag: "", title: "הדרום", sub: "" },
          { key: "eilat", tag: "", title: "אילת", sub: "" },
          { key: "judea_samaria", tag: "", title: "יהודה ושומרון", sub: "" },
        ],
      },
      { key: "q4_question", label: "שאלה 4 (כמות סרטונים)", type: "text", default: "כמה סרטונים אתם צריכים?", max: 60 },
      { key: "q4_hint", label: "שאלה 4, רמז", type: "text", default: "בערך. אפשר לשנות אחר כך.", max: 60 },
      { key: "q4_multi", label: "שאלה 4, בחירה מרובה", type: "toggle", default: false },
      {
        key: "q4_options",
        label: "שאלה 4, אפשרויות",
        type: "list",
        minItems: 2,
        maxItems: 8,
        item: QUIZ_OPTION_ITEM,
        default: [
          { key: "one", tag: "", title: "סרטון אחד", sub: "להתחיל בקטן" },
          { key: "few", tag: "", title: "2 עד 5", sub: "קמפיין קטן" },
          { key: "several", tag: "", title: "6 עד 10", sub: "קמפיין מלא" },
          { key: "many", tag: "", title: "יותר מ-10", sub: "סדרה או כמה מוצרים" },
          { key: "unsure", tag: "", title: "עוד לא יודעים", sub: "נחליט יחד" },
        ],
      },
      { key: "q5_question", label: "שאלה 5 (סוג המוצר)", type: "text", default: "מה אתם רוצים לקדם?", max: 60 },
      { key: "q5_hint", label: "שאלה 5, רמז", type: "text", default: "בחירה אחת.", max: 60 },
      { key: "q5_multi", label: "שאלה 5, בחירה מרובה", type: "toggle", default: false },
      {
        key: "q5_options",
        label: "שאלה 5, אפשרויות",
        type: "list",
        minItems: 2,
        maxItems: 8,
        item: QUIZ_OPTION_ITEM,
        default: [
          { key: "physical", tag: "", title: "מוצר פיזי", sub: "נשלח למשפיען/ית הביתה" },
          { key: "digital", tag: "", title: "מוצר דיגיטלי", sub: "אפליקציה, קורס, מנוי" },
          { key: "service", tag: "", title: "שירות או מקום", sub: "מסעדה, קליניקה, חוויה" },
          { key: "unsure", tag: "", title: "עדיין לא ברור", sub: "נעזור להחליט" },
        ],
      },
      { key: "last_step_tag", label: "תגית בשלב האחרון (ריק = לא מוצג)", type: "text", default: "צעד אחרון", max: 16, allowEmpty: true },
      { key: "form_title", label: "טופס, כותרת", type: "text", default: "למי לחזור?", max: 40 },
      { key: "form_summary_prefix", label: "טופס, תחילית הסיכום", type: "text", default: "בחרתם:", max: 20 },
      { key: "label_name", label: "שדה שם, תווית", type: "text", default: "שם מלא", max: 24 },
      { key: "ph_name", label: "שדה שם, placeholder", type: "text", default: "איך קוראים לך", max: 30 },
      { key: "label_business", label: "שדה עסק, תווית", type: "text", default: "שם העסק", max: 24 },
      { key: "ph_business", label: "שדה עסק, placeholder", type: "text", default: "המותג או החנות", max: 30 },
      { key: "label_phone", label: "שדה טלפון, תווית", type: "text", default: "טלפון", max: 24 },
      { key: "ph_phone", label: "שדה טלפון, placeholder", type: "text", default: "050-0000000", max: 20 },
      { key: "label_email", label: "שדה אימייל, תווית", type: "text", default: "אימייל", max: 24 },
      { key: "ph_email", label: "שדה אימייל, placeholder", type: "text", default: "you@brand.co.il", max: 30 },
      { key: "label_note", label: "שדה הערה, תווית", type: "text", default: "משהו שכדאי שנדע (לא חובה)", max: 40 },
      { key: "ph_note", label: "שדה הערה, placeholder", type: "text", default: "המוצר, התאריך, התקציב", max: 40 },
      { key: "submit", label: "כפתור שליחה", type: "text", default: "שליחה", max: 16 },
      { key: "submitting", label: "כפתור שליחה בזמן שליחה", type: "text", default: "שולחים...", max: 16 },
      { key: "legal_note", label: "שורת אישור מתחת לטופס", type: "textarea", default: "בלחיצה על שליחה אתם מאשרים שניצור איתכם קשר. לא נשלח כלום למשפיענים בלי אישורכם.", max: 160 },
      { key: "done_tag", label: "אישור, תגית קטנה (ריק = לא מוצג)", type: "text", default: "הבקשה התקבלה", max: 20, allowEmpty: true },
      { key: "done_title", label: "אישור, כותרת", type: "text", default: "הבקשה עברה למערכת", max: 40 },
      { key: "done_body", label: "אישור, טקסט", type: "textarea", default: "ניצור איתכם קשר בימים הקרובים, בטלפון או במייל, כדי להשלים את התמונה ולהציע לכם משפיענים מתאימים מהמאגר שלנו.", max: 200 },
      { key: "done_cta_home", label: "אישור, כפתור חזרה לראש הדף", type: "text", default: "חזרה לראש הדף", max: 24 },
      { key: "done_cta_again", label: "אישור, כפתור למלא שוב", type: "text", default: "למלא שוב", max: 24 },
      { key: "err_required_name", label: "שגיאה: שם חסר", type: "text", default: "איך קוראים לך? שם מלא הוא שדה חובה.", max: 60 },
      { key: "err_required_phone", label: "שגיאה: טלפון חסר", type: "text", default: "מספר טלפון הוא שדה חובה.", max: 60 },
      { key: "err_bad_phone", label: "שגיאה: טלפון לא תקין", type: "text", default: "מספר טלפון ישראלי, 9 עד 10 ספרות.", max: 60 },
      { key: "err_bad_email", label: "שגיאה: אימייל לא תקין", type: "text", default: "כתובת האימייל לא נראית תקינה.", max: 60 },
      { key: "err_network", label: "שגיאה: שליחה נכשלה", type: "text", default: "לא הצלחנו לשלוח. בדקו את החיבור ונסו שוב.", max: 80 },
      { key: "err_too_many", label: "שגיאה: יותר מדי ניסיונות", type: "text", default: "שלחתם כמה בקשות ברצף. נסו שוב מאוחר יותר.", max: 80 },
    ],
  },
  // ------------------------------------------------------------------------------------------ auth
  {
    id: "auth",
    page: "system",
    label: "כניסה והרשמה",
    anchor: "",
    help: "המסכים צבועים לפי סוג החשבון: עסק ורוד, יוצר/ת לימון. brand_* לעסק, creator_* ליוצר/ת.",
    fields: [
      { key: "brand_name", label: "שם המותג בשורה העליונה", type: "text", default: "משפיען אונליין", max: 30 },
      { key: "home_link", label: "קישור לדף הבית", type: "text", default: "דף הבית", max: 20 },
      { key: "choose_tag", label: "מי אתם, תגית קטנה מעל הכותרת (ריק = לא מוצג)", type: "text", default: "", max: 20, allowEmpty: true },
      { key: "choose_title", label: "מי אתם, כותרת", type: "text", default: "מי אתם?", max: 30 },
      { key: "choose_subtitle", label: "מי אתם, הסבר", type: "textarea", default: "הצבע של הכפתור ילווה אתכם בכל הדרך, כדי שתדעו תמיד באיזה חשבון אתם.", max: 140 },
      { key: "brand_card_title", label: "מי אתם, כרטיס עסק, כותרת", type: "text", default: "אני בעל/ת עסק", max: 30 },
      { key: "brand_card_desc", label: "מי אתם, כרטיס עסק, טקסט", type: "textarea", default: "רוצה סרטוני UGC אמיתיים למוצרים שלי, או נבחרת משפיענים לקמפיין.", max: 120 },
      { key: "brand_card_cta", label: "מי אתם, כרטיס עסק, כפתור", type: "text", default: "כניסה או הרשמה כעסק", max: 30 },
      { key: "creator_card_title", label: "מי אתם, כרטיס יוצר/ת, כותרת", type: "text", default: "אני יוצר/ת תוכן", max: 30 },
      { key: "creator_card_desc", label: "מי אתם, כרטיס יוצר/ת, טקסט", type: "textarea", default: "רוצה לקבל מוצרים, לצלם סרטונים קצרים ולבנות תיק עבודות עם מותגים.", max: 120 },
      { key: "creator_card_cta", label: "מי אתם, כרטיס יוצר/ת, כפתור", type: "text", default: "כניסה או הרשמה כיוצר/ת", max: 30 },
      { key: "both_note", label: "מי אתם, הערה בתחתית", type: "textarea", default: "יש לכם את שני החשבונות על אותו טלפון? בוחרים אחד, ומהפרופיל עוברים בין הממשקים.", max: 140 },
      { key: "brand_chip", label: "עסק, צ'יפ", type: "text", default: "חשבון עסק", max: 24 },
      { key: "brand_register_title", label: "עסק, הרשמה, כותרת", type: "text", default: "פותחים חשבון עסק", max: 30 },
      { key: "brand_register_sub", label: "עסק, הרשמה, הסבר", type: "textarea", default: "שני צעדים ואימות בקוד חד פעמי. אחרי זה מעלים מוצר ובוחרים יוצרים.", max: 120 },
      { key: "brand_register_steps", label: "עסק, הרשמה, שורת הצעדים", type: "text", default: "פרטי העסק, ואז סיכום ואימות", max: 60 },
      { key: "brand_login_title", label: "עסק, כניסה, כותרת", type: "text", default: "כניסה או הרשמה לחשבון העסקי", max: 30 },
      { key: "brand_login_sub", label: "עסק, כניסה, הסבר", type: "text", default: "מספר טלפון, קוד חד פעמי, ונכנסים.", max: 80 },
      { key: "brand_no_account_cta", label: "עסק, קישור הרשמה", type: "text", default: "הרשמה כעסק", max: 24 },
      { key: "brand_wrong_type_cta", label: "עסק, צ'יפ טעות (מעביר ליוצר/ת)", type: "text", default: "אני בעצם יוצר/ת תוכן", max: 30 },
      { key: "creator_chip", label: "יוצר/ת, צ'יפ", type: "text", default: "חשבון יוצר/ת תוכן", max: 24 },
      { key: "creator_register_title", label: "יוצר/ת, הרשמה, כותרת", type: "text", default: "פותחים חשבון יוצר/ת", max: 30 },
      { key: "creator_register_sub", label: "יוצר/ת, הרשמה, הסבר", type: "textarea", default: "ארבעה צעדים קצרים ואימות בקוד חד פעמי. בלי עוקבים, בלי התחייבות.", max: 120 },
      { key: "creator_register_steps", label: "יוצר/ת, הרשמה, שורת הצעדים", type: "text", default: "פרטים, רשתות, קטגוריות, סיכום ואימות", max: 60 },
      { key: "creator_login_title", label: "יוצר/ת, כניסה, כותרת", type: "text", default: "כניסה או הרשמה לחשבון היוצר/ת", max: 30 },
      { key: "creator_login_sub", label: "יוצר/ת, כניסה, הסבר", type: "text", default: "מספר טלפון, קוד חד פעמי, וחוזרים לפיד.", max: 80 },
      { key: "creator_no_account_cta", label: "יוצר/ת, קישור הרשמה", type: "text", default: "הרשמה כיוצר/ת", max: 24 },
      { key: "creator_wrong_type_cta", label: "יוצר/ת, צ'יפ טעות (מעביר לעסק)", type: "text", default: "אני בעצם בעל/ת עסק", max: 30 },
      { key: "phone_label", label: "שדה טלפון, תווית", type: "text", default: "מספר טלפון", max: 24 },
      { key: "phone_hint", label: "שדה טלפון, הסבר", type: "text", default: "נשלח לכם קוד אימות בוואטסאפ או ב-SMS", max: 60 },
      { key: "cta_send_code", label: "כפתור שליחת קוד", type: "text", default: "שליחת קוד", max: 20 },
      { key: "cta_sending", label: "כפתור שליחת קוד בזמן שליחה", type: "text", default: "שולחים...", max: 20 },
      { key: "otp_sent", label: "קוד נשלח (מופיע לפני הערוץ והמספר)", type: "text", default: "שלחנו קוד", max: 30 },
      { key: "otp_to", label: "מילת החיבור לפני המספר", type: "text", default: "ל-", max: 6 },
      { key: "cta_verify", label: "כפתור אישור הקוד", type: "text", default: "אישור", max: 20 },
      { key: "cta_verifying", label: "כפתור אישור בזמן בדיקה", type: "text", default: "בודקים...", max: 20 },
      { key: "change_phone", label: "קישור שינוי מספר", type: "text", default: "שנו מספר טלפון", max: 30 },
      { key: "not_received", label: "לא הגיע? (לפני הערוץ השני)", type: "text", default: "לא קיבלתם? שלחו לי את הקוד", max: 40 },
      { key: "have_account", label: "כבר רשומים?", type: "text", default: "כבר רשומים?", max: 24 },
      { key: "have_account_cta", label: "כבר רשומים, קישור", type: "text", default: "כניסה", max: 20 },
      { key: "no_account", label: "עדיין אין חשבון? (ריק = השורה לא מוצגת: כניסה והרשמה הן אותו מסלול)", type: "text", default: "", max: 24, allowEmpty: true },
      { key: "wrong_type", label: "טעות?", type: "text", default: "טעות?", max: 16 },
      { key: "cta_next", label: "כפתור המשך בהרשמה", type: "text", default: "המשך", max: 16 },
      { key: "legal_note", label: "הרשמה, שורת התנאים (עם [תנאי השימוש](/terms) ו-[מדיניות הפרטיות](/privacy))", type: "textarea", default: "בהרשמה אתם מאשרים את [תנאי השימוש](/terms) ואת [מדיניות הפרטיות](/privacy).", max: 160 },
      { key: "admin_prefix", label: "מנהלים: (לפני הקישור)", type: "text", default: "מנהלים:", max: 16 },
      { key: "admin_login", label: "קישור כניסת מנהל", type: "text", default: "כניסת מנהל", max: 20 },
      { key: "admin_title", label: "כניסת מנהל, כותרת", type: "text", default: "כניסת מנהל", max: 30 },
      { key: "admin_password_label", label: "כניסת מנהל, תווית סיסמה", type: "text", default: "סיסמה", max: 20 },
      { key: "admin_back", label: "כניסת מנהל, חזרה", type: "text", default: "חזרה להתחברות רגילה", max: 30 },
      { key: "roles_title", label: "בחירת ממשק, כותרת", type: "text", default: "אומתת בהצלחה", max: 30 },
      { key: "roles_sub", label: "בחירת ממשק, הסבר לחשבון עם כמה תפקידים", type: "text", default: "החשבון הזה רשום ביותר מתפקיד אחד. באיזה ממשק להיכנס?", max: 80 },
      { key: "roles_sub_admin", label: "בחירת ממשק, הסבר לכניסת מנהל", type: "text", default: "בחרו ממשק כניסה", max: 40 },
      { key: "register_add_title", label: "הוספת חשבון שני, כותרת", type: "text", default: "הוספת חשבון לחשבון הקיים", max: 40 },
      { key: "register_add_brand", label: "הוספת חשבון עסק, הסבר", type: "text", default: "פותחים חשבון עסק על אותו מספר טלפון. מהפרופיל עוברים בין שני הממשקים.", max: 120 },
      { key: "register_add_creator", label: "הוספת חשבון יוצר/ת, הסבר", type: "text", default: "פותחים חשבון יוצר/ת על אותו מספר טלפון. מהפרופיל עוברים בין שני הממשקים.", max: 120 },
      { key: "redirecting", label: "מעבר לאימות (מסך ביניים)", type: "text", default: "מעבירים לאימות הטלפון...", max: 40 },
      { key: "loading_account", label: "טעינת חשבון (מסך ביניים)", type: "text", default: "טוענים את פרטי החשבון...", max: 40 },
      { key: "reg_creator_step1", label: "הרשמת יוצר/ת, צעד 1, כותרת", type: "text", default: "פרטים אישיים", max: 30 },
      { key: "reg_creator_step2", label: "הרשמת יוצר/ת, צעד 2, כותרת", type: "text", default: "חיבור רשתות חברתיות", max: 30 },
      { key: "reg_creator_step2_hint", label: "הרשמת יוצר/ת, צעד 2, הסבר", type: "text", default: "הפרטים האלה עוזרים לנו להתאים לך מוצרים. לא מוצגים לעסקים.", max: 100 },
      { key: "reg_creator_step3", label: "הרשמת יוצר/ת, צעד 3, כותרת", type: "text", default: "בחרו קטגוריות", max: 30 },
      { key: "reg_creator_step3_hint", label: "הרשמת יוצר/ת, צעד 3, הסבר", type: "text", default: "באיזה סוגי מוצרים הייתם רוצים ליצור תוכן?", max: 100 },
      { key: "reg_creator_step4", label: "הרשמת יוצר/ת, צעד 4, כותרת", type: "text", default: "סיכום", max: 30 },
      { key: "reg_brand_step1", label: "הרשמת עסק, צעד 1, כותרת", type: "text", default: "פרטי העסק", max: 30 },
      { key: "reg_brand_step2", label: "הרשמת עסק, צעד 2, כותרת", type: "text", default: "סיכום", max: 30 },
      { key: "f_full_name", label: "שדה: שם מלא", type: "text", default: "שם מלא", max: 30 },
      { key: "f_full_name_ph", label: "שדה: שם מלא, placeholder", type: "text", default: "איך קוראים לך", max: 30 },
      { key: "f_contact_name", label: "שדה: שם איש הקשר (עסק)", type: "text", default: "שם מלא (איש קשר)", max: 30 },
      { key: "f_phone_ph", label: "שדה: טלפון, placeholder", type: "text", default: "05X-XXX-XXXX", max: 20 },
      { key: "f_city", label: "שדה: עיר", type: "text", default: "עיר מגורים", max: 30 },
      { key: "f_city_ph", label: "שדה: עיר, placeholder", type: "text", default: "לשם נשלח את המוצרים", max: 40 },
      { key: "f_age_confirm", label: "תיבת אישור גיל", type: "text", default: "אני מאשר/ת שגילי מעל 18", max: 60 },
      { key: "f_tiktok", label: "שדה: טיקטוק", type: "text", default: "TikTok", max: 20 },
      { key: "f_instagram", label: "שדה: אינסטגרם", type: "text", default: "Instagram", max: 20 },
      { key: "f_handle_ph", label: "שדה: שם משתמש, placeholder", type: "text", default: "@yourhandle", max: 20 },
      { key: "f_shop_name", label: "שדה: שם החנות", type: "text", default: "שם החנות או המותג", max: 30 },
      { key: "f_shop_name_ph", label: "שדה: שם החנות, placeholder", type: "text", default: "כמו שמופיע באינסטגרם", max: 40 },
      { key: "f_category", label: "שדה: קטגוריה", type: "text", default: "קטגוריה", max: 30 },
      { key: "f_custom_category_ph", label: "שדה: קטגוריה חופשית, placeholder", type: "text", default: "או הקלידו קטגוריה...", max: 40 },
      { key: "f_custom_category_add", label: "כפתור הוספת קטגוריה", type: "text", default: "הוסף", max: 16 },
      { key: "f_region", label: "שדה: אזור", type: "text", default: "אזור בארץ (אופציונלי, יוצרים מסננים לפי אזור)", max: 60 },
      { key: "f_website", label: "שדה: אתר", type: "text", default: "כתובת האתר", max: 30 },
      { key: "f_website_ph", label: "שדה: אתר, placeholder", type: "text", default: "https://", max: 30 },
      { key: "sum_name", label: "סיכום: שם", type: "text", default: "שם", max: 20 },
      { key: "sum_phone", label: "סיכום: טלפון", type: "text", default: "טלפון", max: 20 },
      { key: "sum_city", label: "סיכום: עיר", type: "text", default: "עיר", max: 20 },
      { key: "sum_tiktok", label: "סיכום: טיקטוק", type: "text", default: "TikTok", max: 20 },
      { key: "sum_categories", label: "סיכום: קטגוריות", type: "text", default: "קטגוריות", max: 20 },
      { key: "sum_brand", label: "סיכום: שם מותג", type: "text", default: "שם מותג", max: 20 },
      { key: "sum_contact", label: "סיכום: איש קשר", type: "text", default: "איש קשר", max: 20 },
      { key: "sum_category", label: "סיכום: קטגוריה", type: "text", default: "קטגוריה", max: 20 },
      { key: "sum_region", label: "סיכום: אזור", type: "text", default: "אזור", max: 20 },
      { key: "sum_website", label: "סיכום: אתר", type: "text", default: "אתר", max: 20 },
      { key: "cta_finish", label: "כפתור סיום הרשמה", type: "text", default: "סיום הרשמה", max: 24 },
      { key: "cta_verify_register", label: "כפתור אימות והרשמה", type: "text", default: "אימות והרשמה", max: 24 },
      { key: "cta_registering", label: "כפתור בזמן הרשמה", type: "text", default: "רושמים...", max: 24 },
      { key: "cta_verify_otp_register", label: "כפתור אישור קוד בהרשמה", type: "text", default: "אישור והרשמה", max: 24 },
      { key: "otp_back", label: "חזרה (מתחת לקוד)", type: "text", default: "חזרה", max: 16 },
      { key: "toast_registered", label: "הודעה: נרשמתם", type: "text", default: "נרשמתם בהצלחה!", max: 40 },
      { key: "toast_added_creator", label: "הודעה: חשבון יוצר/ת נוסף", type: "text", default: "חשבון היוצר/ת נוסף! מהפרופיל אפשר לעבור בין הממשקים", max: 80 },
      { key: "toast_added_brand", label: "הודעה: חשבון עסק נוסף", type: "text", default: "חשבון העסק נוסף! מהפרופיל אפשר לעבור בין הממשקים", max: 80 },
      { key: "toast_code_sent", label: "הודעה: קוד נשלח (לפני הערוץ)", type: "text", default: "קוד אימות נשלח", max: 40 },
      { key: "toast_login_ok", label: "הודעה: התחברתם", type: "text", default: "התחברתם בהצלחה!", max: 40 },
      { key: "toast_entered_as", label: "הודעה: נכנסתם כ (לפני שם התפקיד)", type: "text", default: "נכנסתם כ", max: 30 },
      { key: "err_generic", label: "שגיאה כללית", type: "text", default: "שגיאה", max: 40 },
      { key: "err_send_code", label: "שגיאה בשליחת קוד", type: "text", default: "שגיאה בשליחת הקוד", max: 40 },
      { key: "err_bad_code", label: "שגיאה: קוד שגוי", type: "text", default: "קוד שגוי", max: 40 },
      { key: "err_register", label: "שגיאה בהרשמה", type: "text", default: "שגיאה בהרשמה", max: 40 },
      { key: "err_choose_role", label: "שגיאה בבחירת ממשק", type: "text", default: "שגיאה בבחירת ממשק", max: 40 },
      { key: "roles_back", label: "חזרה מבחירת ממשק", type: "text", default: "חזרה להתחברות רגילה", max: 40 },
    ],
  },
  // ------------------------------------------------------------------------------------------ seo
  {
    id: "seo",
    page: "seo",
    label: "SEO ושיתוף",
    anchor: "",
    fields: [
      { key: "title", label: "כותרת הדף (title)", type: "text", default: "משפיען אונליין | סקירת וידאו מיוצרי תוכן אמיתיים", max: 70 },
      { key: "description", label: "תיאור (description)", type: "textarea", default: "מחברים בין עסקים ליוצרי תוכן ולמשפיענים בישראל. ביקורות וידאו אמיתיות על המוצר שלכם, תיק עבודות ליוצרים, ונבחרת משפיענים לקמפיין.", max: 170 },
      { key: "og_title", label: "כותרת לשיתוף (og:title)", type: "text", default: "משפיען אונליין: סקירת וידאו מיוצרי תוכן אמיתיים", max: 70 },
      { key: "og_description", label: "תיאור לשיתוף (og:description)", type: "textarea", default: "ביקורות וידאו מיוצרי תוכן ישראלים אמיתיים, שיוצרות אמון אצל לקוחות. במחיר של המוצר שלכם.", max: 170 },
      {
        key: "keywords",
        label: "מילות מפתח",
        type: "list",
        minItems: 1,
        maxItems: 15,
        item: [listItem("value", "מילה", "text", 30)],
        default: [
          { value: "יוצרי תוכן" },
          { value: "UGC" },
          { value: "משפיענים" },
          { value: "שיווק משפיענים" },
          { value: "מותגים" },
          { value: "תוכן אותנטי" },
          { value: "ישראל" },
          { value: "סרטונים" },
          { value: "שיתופי פעולה" },
          { value: "מוצרים חינם" },
        ],
      },
      { key: "og_image_text", label: "תמונת השיתוף, כותרת", type: "text", default: "התוכן הנכון. האנשים הנכונים.", max: 40 },
      { key: "og_image_sub", label: "תמונת השיתוף, שורה שנייה", type: "text", default: "עסקים, יוצרי תוכן ומשפיענים. משפיען אונליין", max: 60 },
    ],
  },
  // ------------------------------------------------------------------------------------------ errors
  {
    id: "errors",
    page: "system",
    label: "שגיאות (404, אופליין)",
    anchor: "",
    fields: [
      { key: "not_found_tag", label: "404, תגית מונו", type: "text", default: "404", max: 8 },
      { key: "not_found_title", label: "404, כותרת", type: "text", default: "הדף לא נמצא", max: 40 },
      { key: "not_found_body", label: "404, טקסט", type: "textarea", default: "הקישור שגוי או שהדף הוסר. אפשר לחזור למסך הבית ולהמשיך משם.", max: 140 },
      { key: "not_found_cta", label: "404, כפתור ראשי (למסך הבית באפליקציה)", type: "text", default: "למסך הבית", max: 24 },
      { key: "not_found_cta_home", label: "404, כפתור משני (לדף הפתיחה)", type: "text", default: "לדף הפתיחה", max: 24 },
      { key: "offline_title", label: "אופליין, כותרת", type: "text", default: "אין חיבור לאינטרנט", max: 40 },
      { key: "offline_body", label: "אופליין, טקסט", type: "textarea", default: "נראה שאתם לא מחוברים כרגע. בדקו את החיבור לאינטרנט ונסו שוב.", max: 140 },
      { key: "offline_cta", label: "אופליין, כפתור", type: "text", default: "נסו שוב", max: 20 },
    ],
  },
  // ------------------------------------------------------------------------------------------ legal
  {
    id: "legal_terms",
    page: "legal",
    label: "תנאי השירות",
    anchor: "",
    help: "שינוי מהותי (חובות חדשות) דורש אישור מחדש מכל המשתמשים: סמנו את התיבה בשמירה. שינוי ניסוח לא.",
    fields: [
      { key: "title", label: "כותרת", type: "text", default: TERMS.title, max: 40 },
      { key: "short_title", label: "כותרת קצרה (לשוניות)", type: "text", default: TERMS.shortTitle, max: 20 },
      { key: "updated_label", label: "שורת העדכון", type: "text", default: LEGAL_UPDATED_LABEL, max: 60 },
      { key: "version", label: "גרסה (תאריך, משתנה רק בשינוי מהותי)", type: "text", default: TERMS_VERSION, max: 10, readonly: true },
      { key: "body", label: "המסמך (Markdown: ## כותרת, - סעיף, [קישור](/privacy))", type: "markdown", default: legalDocToMarkdown(TERMS), max: 40000 },
    ],
  },
  {
    id: "legal_privacy",
    page: "legal",
    label: "מדיניות הפרטיות",
    anchor: "",
    fields: [
      { key: "title", label: "כותרת", type: "text", default: PRIVACY.title, max: 40 },
      { key: "short_title", label: "כותרת קצרה (לשוניות)", type: "text", default: PRIVACY.shortTitle, max: 20 },
      { key: "updated_label", label: "שורת העדכון", type: "text", default: LEGAL_UPDATED_LABEL, max: 60 },
      { key: "body", label: "המסמך (Markdown)", type: "markdown", default: legalDocToMarkdown(PRIVACY), max: 40000 },
    ],
  },
  {
    id: "legal_refunds",
    page: "legal",
    label: "מדיניות ביטולים והחזרים",
    anchor: "",
    fields: [
      { key: "title", label: "כותרת", type: "text", default: REFUNDS.title, max: 40 },
      { key: "short_title", label: "כותרת קצרה (לשוניות)", type: "text", default: REFUNDS.shortTitle, max: 20 },
      { key: "updated_label", label: "שורת העדכון", type: "text", default: LEGAL_UPDATED_LABEL, max: 60 },
      { key: "body", label: "המסמך (Markdown)", type: "markdown", default: legalDocToMarkdown(REFUNDS), max: 40000 },
    ],
  },
  {
    id: "legal_accessibility",
    page: "legal",
    label: "הצהרת נגישות",
    anchor: "",
    fields: [
      { key: "title", label: "כותרת", type: "text", default: ACCESSIBILITY.title, max: 40 },
      { key: "short_title", label: "כותרת קצרה (לשוניות)", type: "text", default: ACCESSIBILITY.shortTitle, max: 20 },
      { key: "updated_label", label: "שורת העדכון", type: "text", default: LEGAL_UPDATED_LABEL, max: 60 },
      { key: "body", label: "המסמך (Markdown)", type: "markdown", default: legalDocToMarkdown(ACCESSIBILITY), max: 40000 },
    ],
  },
  {
    id: "legal_common",
    page: "legal",
    label: "עמודי המשפט, טקסטים משותפים",
    anchor: "",
    fields: [
      { key: "back_home", label: "קישור חזרה לדף הבית", type: "text", default: "חזרה לדף הבית", max: 24 },
      { key: "more_docs", label: "מסמכים נוספים:", type: "text", default: "מסמכים נוספים:", max: 24 },
      { key: "contact_note", label: "שורת יצירת קשר בתחתית", type: "text", default: "לשאלות ובירורים ניתן לפנות אלינו דרך \"צור קשר\" באפליקציה.", max: 120 },
      { key: "open_full", label: "קישור פתיחה בדף מלא (מהחלון בתוך האפליקציה)", type: "text", default: "לפתיחת המסמך בדף מלא", max: 30 },
    ],
  },
  // ------------------------------------------------------------------------------------------ in-app (unchanged)
  {
    id: ONBOARDING_WELCOME_SECTION,
    page: "system",
    label: "הסבר ליוצר, כרטיסי פתיחה (כניסה ראשונה)",
    anchor: "",
    fields: [
      { key: "card_portfolio_title", label: "כרטיס תיק עבודות, כותרת (מוצג רק למי שאין לו 5 סרטונים)", type: "text", default: onboardingWelcome.card_portfolio_title, max: 60 },
      { key: "card_portfolio_body", label: "כרטיס תיק עבודות, טקסט", type: "textarea", default: onboardingWelcome.card_portfolio_body, max: 240 },
      { key: "card_heart_title", label: "כרטיס לב, כותרת", type: "text", default: onboardingWelcome.card_heart_title, max: 60 },
      { key: "card_heart_body", label: "כרטיס לב, טקסט", type: "textarea", default: onboardingWelcome.card_heart_body, max: 240 },
      { key: "card_match_title", label: "כרטיס מאטץ', כותרת", type: "text", default: onboardingWelcome.card_match_title, max: 60 },
      { key: "card_match_body", label: "כרטיס מאטץ', טקסט", type: "textarea", default: onboardingWelcome.card_match_body, max: 240 },
      { key: "card_deliver_title", label: "כרטיס בריף ומוצר, כותרת", type: "text", default: onboardingWelcome.card_deliver_title, max: 60 },
      { key: "card_deliver_body", label: "כרטיס בריף ומוצר, טקסט", type: "textarea", default: onboardingWelcome.card_deliver_body, max: 240 },
    ],
  },
  {
    id: ONBOARDING_MOMENTS_SECTION,
    page: "system",
    label: "הסבר ליוצר, הודעות (לב ראשון, מאטץ' ראשון)",
    anchor: "",
    fields: [
      { key: "heart_title", label: "אחרי הלב הראשון, כותרת", type: "text", default: onboardingMoments.heart_title, max: 60 },
      { key: "heart_body", label: "אחרי הלב הראשון, טקסט", type: "textarea", default: onboardingMoments.heart_body, max: 240 },
      { key: "heart_more", label: "אחרי הלב הראשון, שורת המשך", type: "textarea", default: onboardingMoments.heart_more, max: 160 },
      { key: "heart_primary", label: "אחרי הלב הראשון, כפתור ראשי", type: "text", default: onboardingMoments.heart_primary, max: 30 },
      { key: "heart_secondary", label: "אחרי הלב הראשון, כפתור משני", type: "text", default: onboardingMoments.heart_secondary, max: 30 },
      { key: "heart_mutual_title", label: "לב ראשון כשהעסק כבר שלח לב, כותרת", type: "text", default: onboardingMoments.heart_mutual_title, max: 60 },
      { key: "heart_mutual_body", label: "לב ראשון כשהעסק כבר שלח לב, טקסט", type: "textarea", default: onboardingMoments.heart_mutual_body, max: 240 },
      { key: "match_title", label: "המאטץ' הראשון, כותרת", type: "text", default: onboardingMoments.match_title, max: 60 },
      { key: "match_body", label: "המאטץ' הראשון, טקסט", type: "textarea", default: onboardingMoments.match_body, max: 240 },
      { key: "match_primary", label: "המאטץ' הראשון, כפתור ראשי", type: "text", default: onboardingMoments.match_primary, max: 30 },
      { key: "match_secondary", label: "המאטץ' הראשון, כפתור משני", type: "text", default: onboardingMoments.match_secondary, max: 30 },
    ],
  },
  {
    id: BILLING_CONTENT_SECTION,
    page: "system",
    label: "עסקים, עמוד \"סרטונים וחיוב\" (מחירים, מדיניות, שאלות ותשובות)",
    anchor: "",
    fields: BILLING_CONTENT_FIELDS.map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      default: BILLING_CONTENT_DEFAULTS[f.key] || "",
      max: f.type === "textarea" ? 4000 : 160,
      // The billing page fills its own placeholders (lib/billing-content.ts fillTemplate)
      variables: ["pct", "saving", "label", "price"],
      // The referral block may be blanked by the admin to hide it (lib/billing-content.ts)
      ...(f.key.startsWith("referral_") ? { allowEmpty: true } : {}),
    })),
  },
] as const satisfies readonly ContentSection[];

// ---------------------------------------------------------------------------------------------------------------
// Types derived from the schema
// ---------------------------------------------------------------------------------------------------------------
type Schema = typeof SITE_CONTENT_SCHEMA;
export type SectionId = Schema[number]["id"];
type ItemValue<I> = I extends readonly (infer E)[] ? { [K in Extract<E, { key: string }>["key"]]: string } : Record<string, string>;
type FieldValue<F> = F extends { type: "list"; item: infer I }
  ? ItemValue<I>[]
  : F extends { type: "toggle" }
    ? boolean
    : F extends { type: "number" }
      ? number
      : string;
type SectionValue<S> = S extends { fields: readonly (infer F)[] } ? { [X in Extract<F, { key: string }> as X["key"]]: FieldValue<X> } : never;
export type SiteContent = { [S in Schema[number] as S["id"]]: SectionValue<S> };
export type SectionContent<Id extends SectionId> = SiteContent[Id];

export type ListItemRecord = Record<string, string>;
export type FieldValueAny = string | number | boolean | ListItemRecord[];
export type SectionRecord = Record<string, FieldValueAny>;
export type ContentRecord = Record<string, SectionRecord>;

// ---------------------------------------------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------------------------------------------
export const SECTIONS: readonly ContentSection[] = SITE_CONTENT_SCHEMA;

export function getSection(id: string): ContentSection | undefined {
  return SECTIONS.find((s) => s.id === id);
}

export function sectionsForPage(page: ContentPage): ContentSection[] {
  return SECTIONS.filter((s) => s.page === page);
}

export function pagePath(page: ContentPage): string {
  return CONTENT_PAGES.find((p) => p.id === page)?.path || "/";
}

// Where "view page" goes for a section (anchor on the public page)
export function sectionViewHref(section: ContentSection): string {
  if (section.page === "home") return section.anchor ? `/#${section.anchor}` : "/";
  if (section.page === "quiz") return "/#inf";
  if (section.page === "legal") {
    const slug = section.id.replace(/^legal_/, "");
    return ["terms", "privacy", "refunds", "accessibility"].includes(slug) ? `/${slug}` : "/terms";
  }
  if (section.id === "auth") return "/login";
  if (section.id === "errors") return "/404-preview";
  if (section.id === BILLING_CONTENT_SECTION) return "/brand/billing";
  if (section.id.startsWith("onboarding_")) return "/feed";
  return "/";
}

// ---------------------------------------------------------------------------------------------------------------
// Defaults and merging
// ---------------------------------------------------------------------------------------------------------------
function cloneValue(v: unknown): FieldValueAny {
  if (Array.isArray(v)) return v.map((item) => ({ ...(item as ListItemRecord) }));
  return v as FieldValueAny;
}

export function defaultsFromSchema(): ContentRecord {
  const out: ContentRecord = {};
  for (const section of SECTIONS) {
    const rec: SectionRecord = {};
    for (const field of section.fields) rec[field.key] = cloneValue(field.default);
    out[section.id] = rec;
  }
  return out;
}

export const SITE_CONTENT_DEFAULTS: SiteContent = defaultsFromSchema() as unknown as SiteContent;

function coerceList(field: ContentField, raw: unknown): ListItemRecord[] | null {
  if (!Array.isArray(raw)) return null;
  const items: ListItemRecord[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const item: ListItemRecord = {};
    for (const sub of field.item || []) {
      const v = (entry as Record<string, unknown>)[sub.key];
      item[sub.key] = typeof v === "string" ? v : v === undefined || v === null ? "" : String(v);
    }
    items.push(item);
  }
  const max = field.maxItems ?? 50;
  const min = field.minItems ?? 0;
  if (items.length < min) return null;
  return items.slice(0, max);
}

// One field: the stored override if it is usable, else the default
export function coerceFieldValue(field: ContentField, raw: unknown): FieldValueAny {
  const dflt = cloneValue(field.default);
  if (raw === undefined || raw === null) return dflt;
  switch (field.type) {
    case "toggle":
      if (typeof raw === "boolean") return raw;
      if (raw === "true" || raw === "1" || raw === 1) return true;
      if (raw === "false" || raw === "0" || raw === 0) return false;
      return dflt;
    case "number": {
      const n = typeof raw === "number" ? raw : Number(String(raw).trim());
      return Number.isFinite(n) ? n : dflt;
    }
    case "list":
      return coerceList(field, raw) ?? dflt;
    case "select": {
      const s = String(raw);
      return field.options?.some((o) => o.value === s) ? s : dflt;
    }
    default: {
      if (typeof raw !== "string") return dflt;
      if (raw.trim() === "" && !field.allowEmpty) return dflt;
      return raw;
    }
  }
}

// Merges the stored rows (section id → key → value) over the defaults. Unknown sections and keys are ignored.
export function mergeSiteContent(rows: unknown): SiteContent {
  const byId = rows && typeof rows === "object" && !Array.isArray(rows) ? (rows as Record<string, unknown>) : {};
  const out: ContentRecord = {};
  for (const section of SECTIONS) {
    const stored = byId[section.id];
    const storedRec = stored && typeof stored === "object" && !Array.isArray(stored) ? (stored as Record<string, unknown>) : {};
    const rec: SectionRecord = {};
    for (const field of section.fields) rec[field.key] = coerceFieldValue(field, storedRec[field.key]);
    out[section.id] = rec;
  }
  return out as unknown as SiteContent;
}

// Only the keys of a section the schema knows, coerced (what PUT stores)
export function sanitizeSectionInput(section: ContentSection, input: unknown): SectionRecord {
  const rec = input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const out: SectionRecord = {};
  for (const field of section.fields) {
    if (field.readonly) continue;
    if (!(field.key in rec)) continue;
    const raw = rec[field.key];
    if (field.type === "list") {
      const list = coerceList(field, raw);
      if (list) out[field.key] = list;
      continue;
    }
    if (field.type === "toggle" || field.type === "number") {
      out[field.key] = coerceFieldValue(field, raw);
      continue;
    }
    if (typeof raw === "string") out[field.key] = raw;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Variables and the *marker*
// ---------------------------------------------------------------------------------------------------------------
const VAR_RE = /\{([a-z_]+)\}/g;

export function findVariables(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(VAR_RE)) if (!out.includes(m[1])) out.push(m[1]);
  return out;
}

export function unknownVariables(text: string): string[] {
  return findVariables(text).filter((v) => !(CONTENT_VARIABLES as readonly string[]).includes(v));
}

export function resolveVariables(text: string, vars: Partial<ContentVars>): string {
  return text.replace(VAR_RE, (m, k: string) => (k in vars && vars[k as ContentVariable] !== undefined ? String(vars[k as ContentVariable]) : m));
}

// Every string in the content, lists included, with the variables filled in
export function resolveSiteContent(content: SiteContent, vars: Partial<ContentVars>): SiteContent {
  const out: ContentRecord = {};
  for (const [sectionId, rec] of Object.entries(content as unknown as ContentRecord)) {
    const next: SectionRecord = {};
    for (const [key, value] of Object.entries(rec)) {
      if (typeof value === "string") next[key] = resolveVariables(value, vars);
      else if (Array.isArray(value)) next[key] = value.map((item) => Object.fromEntries(Object.entries(item).map(([k, v]) => [k, resolveVariables(v, vars)])));
      else next[key] = value;
    }
    out[sectionId] = next;
  }
  return out as unknown as SiteContent;
}

export interface MarkedText {
  before: string;
  marked: string;
  after: string;
}

// "התוכן הנכון. *האנשים הנכונים.*" → { before: "התוכן הנכון. ", marked: "האנשים הנכונים.", after: "" }
export function splitMarker(text: string): MarkedText {
  const m = /\*([^*]+)\*/.exec(text);
  if (!m) return { before: text, marked: "", after: "" };
  return { before: text.slice(0, m.index), marked: m[1], after: text.slice(m.index + m[0].length) };
}

export function stripMarker(text: string): string {
  const { before, marked, after } = splitMarker(text);
  return `${before}${marked}${after}`;
}

// The variables the pages substitute: counts from the stats section, prices and timelines from site_settings
export function contentVars(content: SiteContent, settings: { priceMin?: number | null; discount?: number | null; days?: number | null }): ContentVars {
  return {
    creators: content.home_stats.stat1_value,
    videos: content.home_stats.stat2_value,
    price_min: settings.priceMin ?? "",
    discount: settings.discount ?? "",
    days: settings.days ?? "",
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Validation (admin form + unit test)
// ---------------------------------------------------------------------------------------------------------------
export function isValidContentUrl(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  return /^(https:\/\/[^\s]+|\/[^\s]*|#[^\s]*|mailto:[^\s]+|tel:[^\s]+)$/.test(v);
}

// Warnings for one value (the field still saves; the admin sees them next to the field)
export function validateFieldValue(field: ContentField, value: unknown): string[] {
  const warnings: string[] = [];
  const check = (text: string, label: string, max?: number, type?: string) => {
    if (max && text.length > max) warnings.push(`${label}: ${text.length} תווים, המקסימום ${max}`);
    const unknown = unknownVariables(text).filter((v) => !(field.variables || []).includes(v));
    if (unknown.length) warnings.push(`${label}: משתנה לא מוכר ${unknown.map((u) => `{${u}}`).join(" ")}`);
    if (type === "url" && !isValidContentUrl(text)) warnings.push(`${label}: כתובת חייבת להיות יחסית (/, #) או https`);
    if (type === "markdown" && containsHtml(text)) warnings.push(`${label}: HTML גולמי לא מוצג, רק Markdown`);
  };
  if (field.type === "list") {
    const items = Array.isArray(value) ? (value as ListItemRecord[]) : [];
    if (field.minItems && items.length < field.minItems) warnings.push(`${field.label}: לפחות ${field.minItems} פריטים`);
    if (field.maxItems && items.length > field.maxItems) warnings.push(`${field.label}: לכל היותר ${field.maxItems} פריטים`);
    items.forEach((item, i) => {
      for (const sub of field.item || []) check(String(item[sub.key] ?? ""), `${field.label} ${i + 1}, ${sub.label}`, sub.max, sub.type);
    });
    return warnings;
  }
  if (typeof value === "string") check(value, field.label, field.max, field.type);
  return warnings;
}

// The schema itself: unique ids and keys, defaults within limits, known variables, lists within min/max
export function validateSchema(): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const section of SECTIONS) {
    if (ids.has(section.id)) errors.push(`duplicate section id ${section.id}`);
    ids.add(section.id);
    if (!/^[a-z][a-z0-9_]*$/.test(section.id)) errors.push(`bad section id ${section.id}`);
    const keys = new Set<string>();
    for (const field of section.fields) {
      if (keys.has(field.key)) errors.push(`${section.id}: duplicate key ${field.key}`);
      keys.add(field.key);
      if (!/^[a-z][a-z0-9_]*$/.test(field.key)) errors.push(`${section.id}.${field.key}: bad key`);
      if (!field.label) errors.push(`${section.id}.${field.key}: missing label`);
      if (field.type === "list") {
        if (!field.item?.length) errors.push(`${section.id}.${field.key}: list without item fields`);
        if (!Array.isArray(field.default)) errors.push(`${section.id}.${field.key}: list default is not an array`);
        const subKeys = new Set<string>();
        for (const sub of field.item || []) {
          if (subKeys.has(sub.key)) errors.push(`${section.id}.${field.key}: duplicate item key ${sub.key}`);
          subKeys.add(sub.key);
        }
      } else if (field.type === "toggle") {
        if (typeof field.default !== "boolean") errors.push(`${section.id}.${field.key}: toggle default must be boolean`);
      } else if (field.type === "number") {
        if (typeof field.default !== "number") errors.push(`${section.id}.${field.key}: number default must be a number`);
      } else if (typeof field.default !== "string") {
        errors.push(`${section.id}.${field.key}: default must be a string`);
      }
      if (field.type === "select" && !field.options?.some((o) => o.value === field.default)) errors.push(`${section.id}.${field.key}: default not among options`);
      for (const w of validateFieldValue(field, field.default)) errors.push(`${section.id}.${field.key}: ${w}`);
    }
  }
  return errors;
}

// Hebrew characters (U+0590 to U+05FF) anywhere in a string (the acceptance check of the public pages)
export function hasHebrew(text: string): boolean {
  return /[֐-׿]/.test(text);
}
