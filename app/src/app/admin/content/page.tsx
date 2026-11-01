"use client";

import { useState } from "react";
import { Card, CardTitle, Button } from "@/components/ui";

type ContentSection = {
  id: string;
  label: string;
  fields: { key: string; label: string; type: "text" | "textarea"; value: string }[];
};

const defaultContent: ContentSection[] = [
  {
    id: "hero",
    label: "Hero — כותרת ראשית",
    fields: [
      { key: "badge", label: "תגית עליונה", type: "text", value: "הפלטפורמה ליוצרי תוכן ומותגים בישראל" },
      { key: "title_line1", label: "כותרת שורה 1", type: "text", value: "יוצרים תוכן." },
      { key: "title_line2", label: "כותרת שורה 2 (צבעונית)", type: "text", value: "מחברים מותגים." },
      { key: "subtitle", label: "תיאור", type: "textarea", value: "קבלו מוצרים חינם, צלמו סרטונים אותנטיים, וצמחו כיוצרי תוכן. עסקים — קבלו תוכן UGC איכותי במחיר שפוי." },
      { key: "cta_creator", label: "כפתור יוצרים", type: "text", value: "אני יוצר/ת תוכן" },
      { key: "cta_brand", label: "כפתור מפרסמים", type: "text", value: "אני בעל/ת עסק" },
    ],
  },
  {
    id: "how_it_works",
    label: "איך זה עובד",
    fields: [
      { key: "section_title", label: "כותרת הסקשן", type: "text", value: "שלושה צעדים פשוטים" },
      { key: "step1_title", label: "צעד 1 — כותרת", type: "text", value: "בחרו מוצר" },
      { key: "step1_desc", label: "צעד 1 — תיאור", type: "textarea", value: "גלו מוצרים מעניינים מעסקים מובילים ושלחו בקשת חיבור" },
      { key: "step2_title", label: "צעד 2 — כותרת", type: "text", value: "צלמו סרטון" },
      { key: "step2_desc", label: "צעד 2 — תיאור", type: "textarea", value: "קבלו את המוצר חינם וצלמו סרטון UGC אותנטי תוך 10 ימים" },
      { key: "step3_title", label: "צעד 3 — כותרת", type: "text", value: "צמחו" },
      { key: "step3_desc", label: "צעד 3 — תיאור", type: "textarea", value: "צברו ניסיון, עלו ברמות, והפכו ליוצרי תוכן מבוקשים" },
    ],
  },
  {
    id: "creators",
    label: "סקשן יוצרי תוכן",
    fields: [
      { key: "title_line1", label: "כותרת שורה 1", type: "text", value: "הפכו את" },
      { key: "title_line2", label: "כותרת שורה 2 (צבעונית)", type: "text", value: "התשוקה למקצוע" },
      { key: "benefit1", label: "יתרון 1", type: "text", value: "קבלו מוצרים חינם מהמותגים המובילים" },
      { key: "benefit2", label: "יתרון 2", type: "text", value: "צלמו תוכן בסגנון שלכם, בקצב שלכם" },
      { key: "benefit3", label: "יתרון 3", type: "text", value: "צמחו עם מערכת דירוגים ייחודית" },
      { key: "benefit4", label: "יתרון 4", type: "text", value: "בנו פורטפוליו מקצועי מרשים" },
      { key: "cta", label: "כפתור CTA", type: "text", value: "הצטרפו כיוצרי תוכן" },
    ],
  },
  {
    id: "stats",
    label: "סטטיסטיקות",
    fields: [
      { key: "stat1_value", label: "מספר 1", type: "text", value: "500+" },
      { key: "stat1_label", label: "תיאור 1", type: "text", value: "יוצרי תוכן פעילים" },
      { key: "stat2_value", label: "מספר 2", type: "text", value: "200+" },
      { key: "stat2_label", label: "תיאור 2", type: "text", value: "מותגים ועסקים" },
      { key: "stat3_value", label: "מספר 3", type: "text", value: "2,000+" },
      { key: "stat3_label", label: "תיאור 3", type: "text", value: "סרטונים שנוצרו" },
    ],
  },
  {
    id: "brands",
    label: "סקשן מותגים ועסקים",
    fields: [
      { key: "title_line1", label: "כותרת שורה 1", type: "text", value: "תוכן שעובד" },
      { key: "title_line2", label: "כותרת שורה 2 (צבעונית)", type: "text", value: "בלי הפקות יקרות" },
      { key: "benefit1", label: "יתרון 1", type: "text", value: "תוכן UGC אותנטי שמביא תוצאות" },
      { key: "benefit2", label: "יתרון 2", type: "text", value: "מחירים שפויים — קרדיט אחד = סרטון אחד" },
      { key: "benefit3", label: "יתרון 3", type: "text", value: "יוצרים מאומתים ומדורגים" },
      { key: "benefit4", label: "יתרון 4", type: "text", value: "ניהול קל דרך לוח בקרה חכם" },
      { key: "cta", label: "כפתור CTA", type: "text", value: "הצטרפו כמפרסמים" },
    ],
  },
  {
    id: "cta_final",
    label: "CTA סופי",
    fields: [
      { key: "title_line1", label: "כותרת שורה 1", type: "text", value: "מוכנים" },
      { key: "title_line2", label: "כותרת שורה 2 (צבעונית)", type: "text", value: "להתחיל?" },
      { key: "subtitle", label: "תיאור", type: "textarea", value: "הצטרפו לקהילת היוצרים והמותגים הגדלה. חינם לגמרי ליוצרי תוכן." },
      { key: "cta_primary", label: "כפתור ראשי", type: "text", value: "הרשמה חינם" },
      { key: "cta_secondary", label: "כפתור משני", type: "text", value: "אני מפרסם" },
    ],
  },
  {
    id: "footer",
    label: "פוטר",
    fields: [
      { key: "tagline", label: "תיאור קצר", type: "text", value: "הפלטפורמה ליוצרי תוכן ומותגים" },
      { key: "copyright", label: "זכויות יוצרים", type: "text", value: "Mashpianim. כל הזכויות שמורות." },
    ],
  },
];

export default function AdminContentPage() {
  const [sections, setSections] = useState<ContentSection[]>(defaultContent);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>("hero");

  function updateField(sectionId: string, fieldKey: string, newValue: string) {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              fields: s.fields.map((f) =>
                f.key === fieldKey ? { ...f, value: newValue } : f
              ),
            }
          : s
      )
    );
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload: Record<string, Record<string, string>> = {};
      for (const section of sections) {
        payload[section.id] = {};
        for (const field of section.fields) {
          payload[section.id][field.key] = field.value;
        }
      }
      localStorage.setItem("mashpianim_site_content", JSON.stringify(payload));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">ניהול תוכן האתר</h1>
          <p className="text-neutral-500 text-sm mt-1">ערכו את כל הטקסטים בדף הבית</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="text-sm text-emerald-600 font-medium">נשמר בהצלחה</span>
          )}
          <Button size="lg" onClick={handleSave} disabled={saving}>
            {saving ? "שומר..." : "שמירת שינויים"}
          </Button>
        </div>
      </div>

      <div className="space-y-3 max-w-3xl">
        {sections.map((section) => {
          const isExpanded = expandedSection === section.id;
          return (
            <Card key={section.id} padding="none">
              <button
                onClick={() => setExpandedSection(isExpanded ? null : section.id)}
                className="w-full flex items-center justify-between px-6 py-4 text-right hover:bg-neutral-50 transition-colors"
              >
                <span className="font-semibold text-neutral-900">{section.label}</span>
                <svg
                  className={`w-5 h-5 text-neutral-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {isExpanded && (
                <div className="px-6 pb-6 space-y-4 border-t border-neutral-100 pt-4">
                  {section.fields.map((field) => (
                    <div key={field.key}>
                      <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                        {field.label}
                      </label>
                      {field.type === "textarea" ? (
                        <textarea
                          value={field.value}
                          onChange={(e) => updateField(section.id, field.key, e.target.value)}
                          rows={3}
                          className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none transition-all text-sm resize-none"
                        />
                      ) : (
                        <input
                          type="text"
                          value={field.value}
                          onChange={(e) => updateField(section.id, field.key, e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none transition-all text-sm"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
