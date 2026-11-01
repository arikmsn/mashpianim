import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-pink-500 hover:underline mb-8"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
          חזרה לדף הבית
        </Link>

        <h1 className="text-3xl font-bold mb-2">תנאי שימוש</h1>
        <p className="text-neutral-400 text-sm mb-10">עודכן לאחרונה: אוקטובר 2026</p>

        <div className="prose prose-neutral max-w-none space-y-8 text-neutral-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-3">1. הגדרות</h2>
            <p>
              &quot;הפלטפורמה&quot; — אתר ואפליקציית Mashpian, המופעלים על ידי החברה.
              &quot;יוצר/ת תוכן&quot; — משתמש/ת הנרשם/ת לפלטפורמה לצורך יצירת תוכן וידאו UGC.
              &quot;עסק/מותג&quot; — משתמש/ת הנרשם/ת לפלטפורמה לצורך קבלת תוכן UGC עבור מוצריהם.
              &quot;חיבור&quot; — תהליך שיתוף פעולה בין יוצר/ת תוכן לבין עסק/מותג דרך הפלטפורמה.
              &quot;קרדיט&quot; — יחידת תשלום בפלטפורמה המאפשרת לעסקים לרכוש תוכן.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-3">2. תנאים כלליים</h2>
            <p>
              השימוש בפלטפורמה מהווה הסכמה לתנאים אלו. הפלטפורמה שומרת לעצמה את הזכות לעדכן תנאים אלו בכל עת.
              שימוש בפלטפורמה מותר מגיל 18 ומעלה בלבד.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-3">3. מודל הפעולה</h2>
            <p>
              הפלטפורמה מפעילה מודל בארטר: עסקים מספקים מוצרים ליוצרי תוכן בתמורה לסרטוני UGC.
              אין תשלום כספי ישיר ליוצרי תוכן. עסקים רוכשים קרדיטים לשימוש בפלטפורמה.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-3">4. כללי תוכן ומודרציה</h2>
            <p>כל התוכן העולה לפלטפורמה עובר בדיקה אוטומטית וידנית. חל איסור מוחלט על:</p>
            <ul className="list-disc list-inside space-y-1 mt-2 mr-4">
              <li>שיתוף פרטי קשר (טלפון, אימייל, כתובת, שם משתמש ברשתות חברתיות)</li>
              <li>הפניה לפלטפורמות חיצוניות (טיקטוק, אינסטגרם, פייסבוק, יוטיוב וכו&apos;)</li>
              <li>תוכן אלים, מיני, או פוגעני</li>
              <li>תוכן מטעה או שקרי לגבי המוצר</li>
              <li>הפרת זכויות יוצרים</li>
              <li>ניסיון ליצור קשר ישיר עם הצד השני מחוץ לפלטפורמה</li>
            </ul>
            <p className="mt-3">
              הפרת כללים אלו עלולה להוביל להסרת תוכן, השעיה זמנית, או חסימה לצמיתות.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-3">5. תהליך החיבור</h2>
            <p>
              כל חיבור עובר את השלבים הבאים: בקשת חיבור → אישור → משלוח מוצר (עד 7 ימים) →
              צילום סרטון (עד 10 ימים) → בדיקה (עד 7 ימים) → תיקון אחד (אם נדרש) → אישור סופי.
            </p>
            <p className="mt-2">
              אי עמידה בלוחות הזמנים עלולה להשפיע על הדירוג והרמה של היוצר/ת בפלטפורמה.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-3">6. קניין רוחני</h2>
            <p>
              הסרטונים שנוצרים במסגרת חיבור שייכים לעסק/מותג לאחר אישורם.
              העסק רשאי להשתמש בסרטונים לצורכי שיווק ופרסום.
              ליוצר/ת יש זכות לשימוש בסרטון בפורטפוליו האישי בפלטפורמה בלבד.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-3">7. תקשורת</h2>
            <p>
              כל התקשורת בין יוצרי תוכן לעסקים מתבצעת אך ורק דרך מערכת ההודעות של הפלטפורמה.
              חל איסור מוחלט על שיתוף פרטי קשר או ניסיון ליצירת קשר מחוץ לפלטפורמה.
              הפלטפורמה מנטרת ומסננת הודעות באופן אוטומטי למניעת שיתוף פרטי קשר.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-3">8. תשלומים וקרדיטים</h2>
            <p>
              עסקים רוכשים קרדיטים מראש. הקרדיטים אינם ניתנים להחזר לאחר שימוש.
              המחירים עשויים להשתנות. קרדיטים שלא נוצלו תקפים למשך 12 חודשים ממועד הרכישה.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-3">9. פרטיות</h2>
            <p>
              הפלטפורמה אוספת מידע אישי לצורך תפעול השירות בלבד.
              מספר הטלפון של יוצרי תוכן נאסף לצורכי תקשורת פנימית ולא ישותף עם עסקים.
              חיבור לרשתות חברתיות משמש לאנליטיקה פנימית בלבד (מספר עוקבים, מדד השפעה).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-3">10. הגבלת אחריות</h2>
            <p>
              הפלטפורמה אינה אחראית לאיכות המוצרים הנשלחים על ידי העסקים.
              הפלטפורמה אינה אחראית לאיכות הסרטונים שנוצרים על ידי יוצרי התוכן.
              הפלטפורמה פועלת כמתווכת בלבד בין הצדדים.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-3">11. סמכות שיפוט</h2>
            <p>
              תנאים אלו כפופים לחוקי מדינת ישראל. כל מחלוקת תידון בבתי המשפט המוסמכים בתל אביב-יפו.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-neutral-200 text-center text-sm text-neutral-400">
          <p>לשאלות ובירורים ניתן לפנות אלינו דרך הפלטפורמה.</p>
        </div>
      </div>
    </main>
  );
}
