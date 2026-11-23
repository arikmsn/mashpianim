# משפיען אונליין, חבילת מימוש: מערכת עיצוב ודף בית חדש

תאריך: 2026-11-23, גרסה 3 "פופ חם": Rubik 900 לכותרות, ורוד לוהט (pink-600 #DC1363) לפעולה, גרדיאנט pink→tangerine למילה אחת ולוגו, lemon לחתימה הקטנה, מונו למספרים, הירו כהה עם מניפת סרטונים וסטיקרים. הסריף והאדום של הגרסאות הקודמות בוטלו. מקורות האמת:
- מערכת העיצוב (טוקנים, רכיבים, לוגו): https://claude.ai/artifact/Moxzh7ybWjbA3psD77qiGR
- מוקאפ דף הבית (דסקטופ, מובייל, שאלון אינטראקטיבי): https://claude.ai/artifact/JaCGE2cUwcCAqyP13wAqXp

החבילה הזאת מכילה קבצים מוכנים להחלפה, ומפרט למה שצריך לכתוב. סדר העבודה: שלב א (טוקנים ופונטים) נפרס לבד ונבדק בכל המערכת לפני שלב ב (דף הבית). שלב ג (שאלון ולידים) דורש migration ולכן אישור של אריק לפני הפריסה.

## מה בחבילה

| קובץ | מה הוא | פעולה |
| --- | --- | --- |
| `app/src/app/globals.css` | טוקנים חדשים: pink-* מקבל ערכים חדשים באותם שמות, tangerine, lemon, aliases ל-ig-*, מחלקות signature / sticker / bento-glow / font-mono, משתני `--persona-*` עם `[data-persona="creator"]`, reduced motion, פוקוס אחיד | החלפה מלאה |
| `app/src/components/ui/button.tsx` | primary במילוי pink-600, וריאנטים חדשים `creator` (לימון, טקסט כהה) ו-`persona` (הצבע מהמכל), outline ניטרלי, פוקוס | החלפה מלאה |
| `app/src/components/ui/card.tsx` | גבול border, hover pink-200 | החלפה מלאה |
| `app/src/components/ui/badge.tsx` | pink בערכים החדשים, וריאנטים ugc / influencer (lemon) / business / demo | החלפה מלאה |
| `app/src/components/ui/input.tsx` | פוקוס כהה, שגיאה danger | החלפה מלאה |
| `app/supabase/migrations/026_influencer_leads.sql` | טבלת לידים לשאלון | להריץ אחרי אישור |
| מסמך זה | מפרט דף הבית, שאלון, אדמין, ופרומפט ל-Claude Code | |

## שלב א: טוקנים ופונטים (חצי יום, ללא שינוי מסכים)

1. **globals.css**: להחליף בקובץ מהחבילה. `pink-*` שומר על שמו ומקבל את ערכי הוורוד הלוהט, `ig-*` הם aliases. התוצאה המיידית: כל המערכת עוברת מורוד אינסטגרם לוורוד לוהט, הגרדיאנטים הופכים ל-pink→tangerine, אנימציית הרקע נעצרת.
2. **layout.tsx**: להחליף את Heebo ב-Rubik ולהוסיף Plex Mono:
   ```tsx
   import { Rubik, IBM_Plex_Mono } from "next/font/google";
   const rubik = Rubik({ variable: "--font-rubik", subsets: ["latin", "hebrew"], weight: ["400", "500", "700", "900"] });
   const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"] });
   // <html className={`${rubik.variable} ${plexMono.variable} h-full antialiased`}>
   ```
   `body` נשאר `font-sans` (זה Rubik עכשיו). כותרות במערכת ממשיכות עם `font-bold` (700). `font-display` (900, צפוף) לכותרות דף הבית בלבד. Rubik רחב מעט מ-Heebo: לבדוק כפתורים עם טקסט ארוך במובייל (bottom-nav, כפתורי הרשמה).
3. **ארבעת קבצי ui/**: להחליף. הם שומרים על אותו API (props, variants), כך ששום מסך לא נשבר. הווריאנט `outline` משנה מראה: היה pink, עכשיו ניטרלי. לעבור על המקומות שבהם outline שימש כפעולה ראשית חלופית (למשל "אני מפרסם" בדף הבית הישן) ולהחליט אם זה בסדר.
4. **בדיקה**: `tsc`, build, ואז מעבר ידני על feed, brand, products/[id], connections, messages, profile, admin. מה לחפש: `text-pink-500` על לבן בגודל קטן מ-18px (הערך החדש #FF2E7E הוא 3.5:1, לא מספיק לטקסט קטן). להחליף ל-`text-pink-600` או `text-pink-700`. 164 מופעים של pink-500, רובם רקעים ואייקונים, לא טקסט.
5. **אופציונלי, אחרי שהכל ירוק**: חיפוש והחלפה `ig-pink` → `primary`, `ig-orange` → `tangerine-500`, `ig-yellow` → `lemon-400`, ומחיקת ה-aliases מ-globals.css. לא חובה בשלב הזה.

**לוגו**: לא משתנה בשלב הזה. ההצעה המעודכנת נמצאת במערכת העיצוב (assets/Logo). כשאריק מאשר: לייצר מחדש את כל הקבצים ב-public/ (icon-192, icon-512, maskable, apple-icon, favicon, opengraph-image) מהסימן החדש, לפי HANDOFF §4.

## שלב ב: דף הבית החדש (יום וחצי עד יומיים)

גרסה 3 של המוקאפ ("פופ חם"): הירו כהה (surface-ink) עם מניפה של 7 סרטוני יוצרים נטויים, כותרת Rubik 900 72px לבנה עם המשפט השני בגרדיאנט pink→tangerine, שני סטיקרים מונו נטויים (lemon ו-pink) סביב הכותרת, eyebrow lemon, ניווט שקוף על הכהה; שלושת כרטיסי המסלול יושבים על התפר ויוצאים מהמקטע הכהה (margin-top שלילי של 160px): לבן, pink-100, lemon-100; אריחי הבנטו לבנים עם גבול 1px וזוהר pink רדיאלי רך (`.bento-glow`); כותרות מקטעים דו גוניות (המשפט השני ב-neutral-500); מספרים ב-Rubik 900 60px עם שורת מקור במונו (`SRC: SYSTEM · ADMIN`), האריח השלישי כהה עם מספר lemon; מספרי שלבים במונו (01, 02, 03 · 10D); כפתורי pill בגובה 48 ב-pink-600; מקטע הסגירה כהה עם המילה בלימון והפוטר בתוכו.

הקובץ: `app/src/app/page.tsx`. מבנה חדש, אותו מנגנון תוכן (`useSiteContent` ו-`/api/admin/content`), עם מקטעים חדשים ב-defaults ובאדמין. המוקאפ בקנבס הוא המפרט הוויזואלי, המסמך הזה הוא מפרט ההתנהגות.

### סדר המקטעים

ניווט (כניסה, ליוצרי תוכן בלימון, לעסקים בוורוד), הירו כהה עם מניפה, סטיקרים ושני כפתורי הזהות ("אני בעל/ת עסק" ורוד, "אני יוצר/ת תוכן" לימון) וקישור טקסט "איך זה עובד" מתחתיהם, שלושת כרטיסי המסלול על התפר (ורוד, לימון, לבן עם סטיקר NEW), לעסקים (בנטו ומספרים), איך זה עובד, ליוצרי תוכן (זוהר לימון, כפתור לימון), משפיענים (השאלון, הדגשות ורודות), סגירה כהה עם שני כפתורי הזהות ופוטר. כל טקסט בכל מקטע נערך מהאדמין: המפתחות המלאים בפרק "ניהול תוכן מהאדמין" למטה.

### התנהגות

- מובייל קודם. breakpoints: עד 768 טור אחד, כרטיסי מסלול בטור, בנטו בטור, מספרים 2 בשורה, כפתור דביק בתחתית ("לעסקים" primary, "ליוצרים" outline). מ-1024: כמו המוקאפ הדסקטופי. רוחב תוכן 1200px.
- ניווט: pill צף, נצמד למעלה בגלילה (sticky עם top 12px), ב-md ומטה המבורגר וגיליון מלא.
- תנועה: Framer Motion קיים. `whileInView` פעם אחת (`viewport={{ once: true }}`), y מ-16 ל-0, opacity, 0.5s, ease `[0.16, 1, 0.3, 1]`. כרטיסי המסלול במדורג 0.08s. hover על כרטיס מסלול: y מינוס 4. זהו. אין parallax, אין float, אין גרדיאנט נע. `useReducedMotion` מכבה את הכל.
- מניפת היוצרים בהירו: 7 פוסטרים 9:16 (168px רוחב בדסקטופ, 120 במובייל עם 4), `transform: rotate()` מ-מינוס 7 עד 7 מעלות, צל כבד, האמצעי ללא סיבוב ועם צל גדול יותר. פוסטר בלבד (`thumbnail_url`), לעולם לא `<video>` ברשימה (כלל קיים ב-CLAUDE.md). לחיצה פותחת ProfileModal הקיים עם הסרטון. תגית מונו UGC או POST לפי `products.deal_type` כשיהיה, עד אז UGC. ב-`whileInView` המניפה נפתחת מסיבוב 0 לסיבוב הסופי, פעם אחת, 0.6s.
  - נתונים: route חדש `GET /api/landing/creators` (service role, cache 10 דקות) שמחזיר עד 8 יוצרים עם `allow_on_landing = true` ולפחות סרטון אחד: שם פרטי, קטגוריה, פוסטר, מזהה. מגרילים סדר לפי seed יומי.
  - `users.allow_on_landing boolean default false`: היוצר מסמן בפרופיל "מותר להציג אותי בדף הבית". זה ההסכמה. מנהל יכול לכבות מהאדמין. אם אין 4 יוצרים שהסכימו, הרצועה מציגה משטחי צבע עם תווית demo. זה migration נוסף (027) ודורש אישור.
- מספרים: Rubik 900, tabular-nums, `direction: ltr`, הפלוס ב-pink-500, שורת מקור במונו.
- קישורים: כפתורי המסלול מובילים ל-`/register?type=brand`, `/register?type=creator`, ולעוגן `#influencers`. הניווט לעוגנים.
- SEO: metadata קיים ב-layout.tsx נשאר. לעדכן title ו-description לכותרת החדשה ("התוכן הנכון. האנשים הנכונים."). opengraph-image.tsx מקבל את הצבעים החדשים.
- נגישות: heading order (h1 אחד), landmarks (nav, main, footer), כל כרטיס מסלול הוא `<a>` אחד עם כל התוכן בפנים, אייקונים `aria-hidden`, כפתור המבורגר עם `aria-label` ו-`aria-expanded`, קונטרסט לפי הטבלה במערכת העיצוב.

## שלב ג: שאלון המשפיענים (יום)

מפרט מלא ברכיב Quiz במערכת העיצוב. אב-טיפוס עובד בקנבס (Play על הארטבורד השלישי). כאן רק מה שהקוד צריך.

- קומפוננטה: `components/features/influencer-quiz.tsx`, client. state: step 0..6, answers. חמש שאלות עם מפתחות יציבים (ראו הערות ב-migration), טופס פרטים, אישור.
- בחירה יחידה עוברת לבד אחרי 320ms. בחירה מרובה דורשת "המשך". "חזרה" מהשאלה השנייה.
- עיצוב (גרסה 3): המקטע הוא כרטיס לבן עם גבול 1px וזוהר lemon רדיאלי, לא רצועה צהבהבה. הטקסט מימין עם שלוש שורות מונו (90S, 0 ₪, 1:1). כרטיס השאלון משמאל, כהה: surface-ink עם זוהר lemon בפינה, radius-xl, רוחב עד 640px. מונה מונו lemon ("01 / 05"), eyebrow "בונים נבחרת", מד 3px lemon על מסילה לבנה 12%, שאלה ב-Rubik 900 28px לבן. כרטיס אפשרות: רקע לבן 5%, גבול לבן 12%, תגית מונו lemon (<10K, IG, UGC), כותרת Rubik 700, תת כותרת לבן 60%; נבחר: גבול lemon-400 ורקע lemon 12%. "המשך" primary pink pill, 35% אטימות לפני בחירה. "חזרה" ghost בהיר. שדות על כהה: רקע לבן 5%, גבול לבן 20%, פוקוס lemon. אישור: עיגול lemon, תגית מונו REQUEST RECEIVED, כותרת Rubik 900 לבנה. הכל כפי שמופיע ברכיב Quiz במערכת העיצוב ובארטבורד השלישי בקנבס.
- מעבר בין שאלות: `AnimatePresence` עם x של 24 בכיוון הקריאה, 0.5s. reduced motion: fade בלבד.
- טופס: שם מלא וטלפון חובה, אימייל ושם עסק רשות, הערה רשות. ולידציה בצד הלקוח (טלפון ישראלי 9 עד 10 ספרות), שגיאות ב-caption danger.
- שליחה: `POST /api/influencer-leads` עם `{ answers, full_name, business_name, phone, email, note, utm }`.
  - ה-route: `checkRateLimit('influencer_lead', ip)` (5 לשעה ל-IP), ולידציה בצד השרת, כתיבה עם service role ל-`influencer_leads`, `logActivity`, ואז התראה: מייל ל-info@mashpian.online (אם יש ספק מייל) או לפחות התראת אדמין בפעמון (`notifications` לכל `is_admin`). להחזיר `{ ok: true }` בלבד, בלי המזהה.
  - שגיאה: הודעה מתחת לכפתור, הטופס לא מתאפס.
- אישור: "הבקשה עברה למערכת. ניצור איתכם קשר בימים הקרובים." וכפתור חזרה לראש הדף. אין מחיר, אין הבטחת זמינות, אין מספר משפיענים.
- אדמין: `/admin/leads`, טבלה ממוינת לפי תאריך, עמודות: תאריך, שם, עסק, טלפון, תשובות (תגיות), סטטוס (select), הערת אדמין. סינון לפי סטטוס. זה הכל לגרסה הראשונה.
- UTM: לקרוא מה-URL בטעינה ולשמור ב-`utm` (source, medium, campaign). מתחבר לתוכנית השיווק הקיימת.

## צבעי זהות ומסכי כניסה והרשמה

**הכלל**: עסקים = ורוד (pink-600, טקסט לבן). יוצרי תוכן = לימון (lemon-400, טקסט ink-900). הצבע שנלחץ בדף הבית ממשיך לכרטיס המסלול, למסך ההרשמה ולמסך הכניסה, כדי שבעל עסק לא יירשם בטעות כיוצר ולהפך. משפיענים הם מסלול לעסקים: השאלון ורוד, וכרטיס המסלול שלו ניטרלי עם סטיקר NEW תפוז. המוקאפים: חמשת הארטבורדים "כניסה והרשמה" בקנבס, ורכיב AuthScreen במערכת העיצוב.

### דף הבית
- ניווט: "כניסה" (ghost), "ליוצרי תוכן" (creator pill), "לעסקים" (primary pill). במובייל: לוגו, "כניסה", המבורגר; שני הכפתורים בסרגל הדביק.
- הירו: שני כפתורים בגובה 52, "אני בעל/ת עסק" primary עם אייקון תיק, "אני יוצר/ת תוכן" creator עם אייקון משתמש. מתחתיהם קישור טקסט "איך זה עובד" עם חץ למטה לעוגן `#how`. "איך זה עובד" נשאר גם בתפריט. אין כפתור שלישי בהירו.
- קישורים: עסק → `/register?type=brand`, יוצר → `/register?type=creator`, כניסה → `/login` (בלי סוג: מסך "מי אתם?"), הסגירה והסרגל הדביק אותו דבר.
- כרטיסי מסלול: עסק pink-100 עם כפתור primary "הרשמה כעסק" ותגית BRANDS; יוצר lemon-100 עם כפתור ink וטקסט lemon-400 "הרשמה כיוצר/ת" ותגית CREATORS; משפיענים לבן עם גבול, כפתור dark "בונים נבחרת" וסטיקר NEW.
- מקטע היוצרים: זוהר לימון, מספרי שלבים lemon-700, כפתור creator. מקטע העסקים והשאלון: ורוד.

### מסכי הכניסה וההרשמה (`/login`, `/register`)
זה עור, לא זרימה: הלוגיקה של OTP, הצעדים, השדות וה-API לא משתנים.
- `data-persona="brand|creator"` על ה-`<main>` של שני העמודים קובע את `--persona`, `--persona-fg`, `--persona-soft`, `--persona-ink`, `--persona-page` (מוגדרים ב-globals.css). כל הצבעים במסכים האלה משתמשים במשתנים, לא ב-pink ישיר. ברירת המחדל brand.
- הסוג נקבע מ-`?type=` ונשמר ב-`sessionStorage("mashpian.persona")`, כך שמעבר מ-`/register?type=brand` ל-`/login` (בלי פרמטר) נשאר ורוד. ה-redirect הקיים מ-login ל-register מעביר את הסוג כמו היום.
- בלי סוג (הגעה מ"כניסה" בניווט או קישור ישיר): מסך "מי אתם?" עם שני כרטיסים צבועים (pink-100 "אני בעל/ת עסק", lemon-100 "אני יוצר/ת תוכן"), כל אחד עם כפתור בצבעו, שמובילים ל-`/login?type=`. זה מחליף את בחירת הסוג הקיימת ב-register (שני כרטיסים לבנים עם אימוג׳י).
- מבנה כל מסך (390px, בדסקטופ כרטיס ממורכז ברוחב 440 על אותו רקע): שורה עליונה עם "דף הבית" ולוגו; צ׳יפ הזהות ("חשבון עסק" / "חשבון יוצר/ת תוכן") בצבע הזהות; כותרת Rubik 900 32px ("פותחים חשבון עסק", "פותחים חשבון יוצר/ת", "כניסה לחשבון העסק", "כניסה לחשבון היוצר/ת"); שורת הסבר; מד התקדמות עם מונה מונו ("01 / 02" לעסק, "01 / 04" ליוצר) ומקטעים בצבע הזהות; כרטיס לבן עם השדות והכפתור `persona` ברוחב מלא; "כבר רשומים? כניסה" (שומר סוג); "טעות?" עם צ׳יפ בצבע של הצד השני שמחליף סוג. בכניסה: שדה טלפון ממורכז, תאי OTP במונו `direction: ltr`, "שליחה חוזרת" ו"קוד ב-SMS במקום" כמו היום, "כניסת מנהל" בתחתית.
- רקע העמוד: `--persona-page` (pink-50 / lemon-50) עם זוהר רדיאלי של `--persona-soft` בראש. הלוגו: הסימן החדש אם אושר, אחרת icon-192 הקיים.
- הכפתור הראשי במסכי היוצר הוא לימון עם טקסט כהה. לעולם לא טקסט לבן על לימון.
- נגישות: הצבע הוא לא הסימן היחיד. הצ׳יפ והכותרת אומרים במילים באיזה חשבון אנחנו, והמחלף "טעות?" קיים בכל מסך.
- טקסטים: כל המחרוזות של המסכים האלה (כותרות, צ׳יפים, הסברים, תוויות שדות, "טעות?", הודעות שגיאה) נכנסות למרשם התוכן תחת מקטע `auth` עם תת מפתחות `brand.*` ו-`creator.*`, כמו שאר האתר.

## ניהול תוכן מהאדמין: כל טקסט באתר הציבורי נערך ב-/admin/content

**העיקרון**: אין מחרוזת עברית קשיחה באף עמוד ציבורי. כל מה שמבקר רואה לפני כניסה למערכת (דף הבית, השאלון, עמודי המשפט, 404, SEO) מגיע ממרשם תוכן אחד, עם ברירות מחדל בקוד ודריסות באדמין. המנגנון הקיים (`site_content`, `GET/PUT /api/admin/content`, הטופס ב-`/admin/content`) נשאר; מרחיבים אותו ומסדרים אותו.

### 1. מקור אמת אחד: `lib/site-content.ts`

היום ברירות המחדל מופיעות שלוש פעמים (page.tsx, api/admin/content/route.ts, admin/content/page.tsx) ויוצאות מסנכרון. במקום זה קובץ אחד שמייצא `SITE_CONTENT_SCHEMA`:

```ts
export const SITE_CONTENT_SCHEMA: ContentSection[] = [
  { id: "hero", page: "home", label: "הירו", fields: [
    { key: "eyebrow", label: "תגית מעל הכותרת", type: "text", default: "תוכן אמיתי. אנשים אמיתיים", max: 40 },
    { key: "title", label: "כותרת (החלק בין * * מקבל את הגרדיאנט)", type: "text", default: "התוכן הנכון. *האנשים הנכונים.*", max: 60 },
    ...
  ]},
  ...
];
```

סוגי שדות: `text` (שורה אחת), `textarea`, `list` (פריטים חוזרים עם תת שדות, מינימום ומקסימום), `select` (ערכים מוגדרים), `toggle`, `number`, `url`, `markdown` (לעמודי המשפט). לכל שדה: `label`, `help` (רשות), `default`, `max` (אורך). ממנו נגזרים: ברירות המחדל ב-route.ts, הטופס באדמין (נבנה אוטומטית מהסכמה, אין יותר רשימת שדות ידנית ב-page.tsx של האדמין), וה-types של התוכן בעמודים. פונקציה `getSiteContent()` בצד השרת ממזגת ברירות מחדל עם הדריסות ומחזירה אובייקט מוקלד.

### 2. משתנים בטקסט

מחרוזת יכולה להכיל `{creators}`, `{videos}`, `{price_min}`, `{discount}`, `{days}`. ההחלפה בזמן רינדור מתוך `stats` ומתוך `site_settings` (credits, timelines). כך "125 יוצרים כבר כאן" בסגירה מתעדכן כש-stat1 משתנה. סימון `*מילה*` בכותרת = החלק שמקבל גרדיאנט או צבע שני (בהירו: גרדיאנט, בכותרות מקטע: neutral-500). זה ההסבר שמופיע ב-help של השדה.

### 3. המרשם המלא (מה נערך איפה)

| עמוד | מקטע (id) | שדות |
| --- | --- | --- |
| דף הבית | `nav` | link1..4 (טקסט + עוגן), login, cta |
| דף הבית | `hero` | eyebrow, title (עם `*`), subtitle, cta_primary, cta_secondary, sticker1, sticker2 (מונו, לטינית וספרות; ריק = לא מוצג), counter_line (`{videos} VIDEOS · {creators} CREATORS`), demo_note |
| דף הבית | `tracks` | שלושה פריטים קבועים: title, desc, cta, badge (רק למשפיענים) |
| דף הבית | `brands` | eyebrow, title (עם `*`), subtitle, bento1..4 title + desc, screenshot_caption, cta_primary, cta_secondary, price_note (`חבילות מ-{price_min} ₪ לסרטון. {discount}% הנחה ברכישה הראשונה`) |
| דף הבית | `stats` | stat1..3: value, label, source (מונו), dark (toggle, ברירת מחדל: השלישי). כפתור "עדכן מהמערכת" שממלא value של 1 ו-2 מספירה אמיתית ושומר. התצוגה תמיד מהערך השמור |
| דף הבית | `how` | eyebrow, title (עם `*`), steps: list של 4, כל אחד tag (מונו: 01, 03 · 10D), title, desc |
| דף הבית | `creators` | eyebrow, title (עם `*`), subtitle, steps: list של 3 (tag, title, desc), cta_primary, cta_secondary |
| דף הבית | `influencers` | eyebrow, title (עם `*`), subtitle, bullets: list של 3 (tag מונו, text), card_eyebrow ("בונים נבחרת"), privacy_note, cta_next, cta_back |
| דף הבית | `cta_final` | eyebrow, title (עם `*`), subtitle (עם `{creators}`), cta_primary, cta_secondary |
| דף הבית | `footer` | links: list (label, href) מתוך העמודים המשפטיים, copyright (מונו), logo_tagline |
| דף הבית | `mobile` | sticky_primary, sticky_secondary, menu_login, menu_close |
| שאלון | `quiz` | questions: list של 5, כל אחת: question, hint, multi (toggle), options: list (tag מונו, title, sub, key יציב לשמירה). form: title, hint, labels של 5 השדות, placeholders, submit, legal_note. done: tag (מונו), title, body, cta_home, cta_again. errors: required_name, required_phone, bad_phone, bad_email, network |
| כניסה והרשמה | `auth` | choose: title, subtitle, brand_card (title, desc, cta), creator_card (title, desc, cta), both_note. brand ו-creator, כל אחד: chip, register_title, register_sub, login_title, login_sub, step_labels, cta_next, cta_send_code, otp_sent, resend, sms_instead, have_account, no_account, wrong_type, legal_note, admin_login |
| SEO | `seo` | title, description, og_title, og_description, keywords (list), og_image_text (הטקסט שמצויר ב-opengraph-image.tsx) |
| שגיאות | `errors` | not_found_title, not_found_body, not_found_cta, offline_title, offline_body (public/offline.html נבנה ב-build מהשדות האלה) |
| משפטי | `legal_terms`, `legal_privacy`, `legal_refunds`, `legal_accessibility` | title, updated_label, body (markdown), ולתנאים גם version. ראו 5 |
| קיים | `onboarding_*`, `billing` | ללא שינוי, רק עוברים לאותה סכמה ולאותו טופס |

### 4. הטופס באדמין

- `/admin/content` נבנה מהסכמה: טאבים לפי עמוד (דף הבית, שאלון, משפטי, SEO, מערכת), ובכל טאב מקטעים מתקפלים. חיפוש חופשי בשמות השדות ובערכים.
- לכל שדה: תווית, help, מונה תווים מול `max` (אדום מעל המקסימום, הדף עדיין נשמר), כפתור "שחזר ברירת מחדל" לשדה ולמקטע. שדות list: הוספה, מחיקה, גרירה לסידור, מינימום ומקסימום מהסכמה.
- שמירה לכל מקטע (כמו היום), עם "נשמר על ידי X ב-Y" מתוך `updated_by` ו-`updated_at`. אחרי שמירה: `revalidatePath('/')` ולעמוד הרלוונטי, כדי שהתוכן החדש יופיע מיד.
- קישור "צפייה בדף" מכל מקטע, שנפתח בטאב חדש על העוגן של המקטע.
- ולידציה: `url` חייב להיות יחסי או https; `markdown` נבדק שאין בו HTML גולמי; שדה עם `{משתנה}` לא מוכר מסומן באזהרה.
- הרשאות ולוג: כמו היום, `verifyAdmin` ו-`logActivity` עם רשימת המפתחות ששונו.

### 5. עמודי המשפט

היום הטקסטים קשיחים ב-`lib/legal.ts` עם `TERMS_VERSION` ושער אישור מחדש. מעבירים את גוף המסמכים ל-`site_content` כ-markdown (ברירת המחדל: הטקסט הקיים, מועבר אוטומטית פעם אחת), ומשאירים את הלוגיקה ב-lib/legal.ts. עריכת תנאי השימוש באדמין מציגה תיבת סימון "זה שינוי מהותי, לדרוש אישור מחדש מכל המשתמשים": אם מסומנת, השמירה מעדכנת `version` לתאריך של היום וכל משתמש יראה את השער בכניסה הבאה (`needsTermsAcceptance` כבר יודע לעשות את זה). אם לא, רק הטקסט ו-`updated_label` משתנים. זו החלטה משפטית של אריק בכל שינוי, לכן תיבת הסימון מוסברת היטב ולא מסומנת כברירת מחדל.

### 6. רינדור

היום דף הבית הוא client component שמביא את התוכן אחרי הטעינה, ולכן ברירת המחדל מהבהבת לפני הטקסט האמיתי וגוגל רואה את ברירת המחדל. דף הבית החדש הוא server component: `getSiteContent()` בשרת, ISR עם `revalidate = 60` ו-`revalidatePath` מהאדמין. הרכיבים האינטראקטיביים (שאלון, ניווט במובייל, מניפה עם Framer Motion) הם client components קטנים שמקבלים את הטקסטים כ-props. `generateMetadata` קורא את מקטע `seo`.

### 7. בדיקת קבלה

`grep -nP '[\u0590-\u05FF]' app/src/app/page.tsx` מחזיר אפס שורות (וכך גם לקומפוננטות של דף הבית והשאלון). כל שדה בסכמה מופיע בטופס. שינוי טקסט באדמין נראה בדף תוך דקה בלי deploy. `npm test` כולל בדיקה שהסכמה וברירות המחדל תקינות (אין מפתח כפול, אין משתנה לא מוכר, אורכים).

## מה לא לעשות

- לא להציג חיפוש משפיענים חי, פרופילים, עוקבים או מחירים. המסלול הזה הוא שאלון וליד עד להחלטה אחרת.
- לא להמציא מספרים. stat3 ("10 ימים") הוא מדיניות, לא נתון, ושורת המקור אומרת את זה.
- כותרות דף הבית ב-Rubik 900 עם ריווח שלילי. במערכת 700. לעולם לא סריף ולא אדום.
- לא לכתוב עברית ב-Plex Mono. המונו הוא לספרות ולטינית בלבד.
- לא להחזיר את הגרדיאנט לכפתורים או לרקעים. `.ig-gradient-bg` נשאר רק במקומות שהוא כבר קיים במערכת, ושם הוא עכשיו pink→lemon.
- לא לשנות מסכים בתוך המערכת מעבר לארבעת קבצי ui/. אם מסך נראה לא טוב אחרי שלב א, לרשום אותו ולהביא לאריק, לא לתקן במקום.
- לא לגעת ב-routing, auth, RLS, או ב-API קיים. שני ה-routes החדשים (landing/creators, influencer-leads) הם תוספת.
- לא להשאיר אף מחרוזת עברית קשיחה בעמודים ציבוריים. כל טקסט מגיע מ-`lib/site-content.ts`, כולל כפתורים, תגיות, הודעות שגיאה ו-SEO.

## פרומפט ל-Claude Code

להדביק כהודעה ראשונה בסשן חדש בתיקיית הפרויקט, אחרי שהקבצים מהחבילה הועתקו ל-`docs/design-package/`:

```text
We are rolling out a new design system and a new homepage for Mashpian (mashpian.online). Read CLAUDE.md, docs/STATUS.md and docs/design-package/DESIGN-IMPLEMENTATION.md first. The design system (tokens, components, rules) is at https://claude.ai/artifact/Moxzh7ybWjbA3psD77qiGR and the homepage mockup (desktop, mobile, interactive quiz) is at https://claude.ai/artifact/JaCGE2cUwcCAqyP13wAqXp. If you can read artifacts, read the design system's project/README.md and project/tokens.json; if not, the package has everything you need.

Work in three phases. Stop after each phase, run tsc, build and the test suite, and report in 5 lines: what changed, what I can see, the exact URL, anything mocked, anything you were unsure about. Do not start the next phase until I say so.

Phase A, tokens and fonts, no screen changes:
1. Replace app/src/app/globals.css with docs/design-package/app/src/app/globals.css.
2. In app/src/app/layout.tsx replace Heebo with Rubik (400, 500, 700, 900, variable --font-rubik, latin + hebrew) and add IBM_Plex_Mono (400, 500, variable --font-plex-mono, latin) from next/font/google; put both variables on <html>. Rubik is slightly wider than Heebo: check buttons with long labels on mobile (bottom-nav, register buttons) and report any that wrap.
3. Replace app/src/components/ui/button.tsx, card.tsx, badge.tsx and input.tsx with the package versions. Keep their public API identical.
4. Run the app and open: /, /login, /feed, /brand, /brand/products, /connections, /messages, /profile, /admin. List every place where pink text smaller than 18px sits on white (it was pink-500) and change it to text-pink-600. List, do not fix, anything else that looks wrong after the token change.
Do not rename pink-* or ig-* classes in this phase; they are aliased.

Phase B, the homepage and the content registry:
1. Create lib/site-content.ts: one SITE_CONTENT_SCHEMA (sections, fields with key, label, help, type text | textarea | list | select | toggle | number | url | markdown, default, max) covering every visible string of the public site exactly as listed in the "ניהול תוכן מהאדמין" chapter of DESIGN-IMPLEMENTATION.md: nav, hero (including the two mono stickers and the counter line), tracks, brands, stats, how, creators, influencers, cta_final, footer, mobile, quiz (questions, options with stable keys, form labels, confirmation, errors), seo, errors, and the legal documents as markdown. Derive from this one file the defaults in api/admin/content/route.ts, the admin form, and a typed getSiteContent() server helper that merges defaults with site_content overrides and resolves {creators}, {videos}, {price_min}, {discount}, {days} and the *word* marker for the gradient or two-tone part of a headline. Keep the existing onboarding_* and billing sections working on the same schema.
2. Rebuild /admin/content from the schema: tabs per page (דף הבית, שאלון, משפטי, SEO, מערכת), collapsible sections, search, per-field label, help, character counter against max, "restore default" per field and per section, list fields with add, remove and drag to reorder within min and max, save per section with updated_by / updated_at shown, a "view page" link to the section anchor, validation for url, markdown and unknown variables, verifyAdmin and logActivity as today, and revalidatePath after save. For the terms document add the "material change, require re-acceptance" checkbox described in the chapter, unchecked by default, which bumps the version only when checked. Move the existing legal texts from lib/legal.ts into the defaults once, without changing needsTermsAcceptance.
3. Rebuild app/src/app/page.tsx as a server component that reads getSiteContent() with revalidate = 60, to match the mockup (version 3 "Pop warm": dark hero with a fan of seven tilted 9:16 creator posters, Rubik 900 headline with the second sentence in the pink-to-tangerine gradient, two tilted mono stickers, lemon eyebrow, track cards riding the seam in white / pink-100 / lemon-100, white bordered bento tiles with a soft pink radial glow, two-tone section headlines, Rubik 900 stats with a mono source line and a dark third tile with a lemon number, mono step numbers, pink-600 pill buttons 48px tall, dark closing section with the footer inside it) and the section order in DESIGN-IMPLEMENTATION.md. Interactive parts (mobile menu, fan animation, quiz) are small client components that receive their texts as props. generateMetadata reads the seo section. Stats stay manual values from the admin, plus the "update from system" button that fills creators and videos from real counts and saves.
4. Mobile first, breakpoints as specified, Framer Motion with once-only whileInView and useReducedMotion. Creator fan: build the UI with colored placeholder tiles labelled from the demo_note field and a clearly separated data hook, but do NOT add the allow_on_landing column or the /api/landing/creators route yet; that needs a migration and the owner's approval. Update the opengraph image colors and text from the seo section. Check heading order, landmarks, focus states and keyboard navigation.
5. Persona colors: businesses are pink (variant primary), creators are lemon (variant creator, dark text). The hero has exactly two buttons, "אני בעל/ת עסק" and "אני יוצר/ת תוכן", with a small "איך זה עובד" text link under them (no third button); the nav has כניסה, ליוצרי תוכן (creator) and לעסקים (primary); the track cards are pink-100 / lemon-100 / white with the BRANDS / CREATORS / NEW mono tags; the creators section uses the lemon glow and the creator button; the quiz keeps pink accents. All sign-up links carry ?type=brand or ?type=creator.
6. Acceptance: grep for Hebrew characters in app/src/app/page.tsx and in the homepage and quiz components returns nothing; every schema field appears in the admin form; a text changed in the admin shows on the page within a minute without a deploy; a unit test validates the schema (no duplicate keys, no unknown variables, lengths).

Phase B2, persona-colored login and register screens (skin only, no flow changes):
Read the "צבעי זהות ומסכי כניסה והרשמה" chapter and the five Auth artboards in the mockup. Add data-persona="brand|creator" on the <main> of /login and /register, resolved from ?type= and remembered in sessionStorage("mashpian.persona") so /login without a parameter keeps the color after /register?type=...; the --persona-* variables and the [data-persona="creator"] override already exist in the new globals.css, and button.tsx has the persona and creator variants. Restyle both pages to the artboards: persona page background with a soft radial glow, the "דף הבית" link and the logo in the top row, the persona chip ("חשבון עסק" / "חשבון יוצר/ת תוכן"), the Rubik 900 title, the mono step counter and persona-colored progress segments, the white card with the existing fields and a full-width persona button, the "כבר רשומים? כניסה" link that keeps the type, and the "טעות?" switch chip in the other side's color on every screen. Replace the current type-selection cards in /register with the "מי אתם?" screen (two colored cards leading to /login?type=brand and /login?type=creator), and show it on /login too when no type is known. Keep the OTP flow, the steps, the fields, the validation, the admin login and every API call exactly as they are; keep the OTP input mono with direction ltr. All strings of these screens come from the auth section of the content registry. Report screenshots of the four screens on a phone-width viewport.

Phase C, the influencer quiz (after the owner approves migration 026):
Build components/features/influencer-quiz.tsx (all of its texts, questions and options from the quiz section of the content registry, with stable option keys saved to the lead) and POST /api/influencer-leads exactly as specified, with rate limiting, server-side validation, service-role write, logActivity and an admin bell notification. Build /admin/leads with the status select and admin note. Never show prices, availability, influencer counts or profiles. Update docs/STATUS.md and docs/HANDOFF.md at the end.

Rules for all phases: businesses are always pink and creators are always lemon with dark text (never white text on lemon), every sign-up entry carries ?type=, no hardcoded Hebrew strings in public pages (everything comes from lib/site-content.ts), Hebrew UI, RTL, logical margins (ms-/me-/ps-/pe-), homepage display headings Rubik 900 with negative tracking and in-app headings Rubik 700, IBM Plex Mono only for digits and Latin tags (never Hebrew), never red and never a serif, no new ESLint errors, no changes to routing, auth, RLS or existing API routes, no em dashes in any Hebrew copy (use commas and periods), and never report something as done before you have opened it in the browser.
```
