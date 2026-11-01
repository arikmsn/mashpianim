"use client";

import { useState, useEffect } from "react";
import { Card, CardTitle, Button, Input, useToast } from "@/components/ui";

const defaultSettings = {
  general: { platformName: "Mashpian", supportEmail: "support@mashpian.online", supportPhone: "" },
  credits: { single: "100", pack5: "450", pack10: "800", pack20: "1400" },
  moderation: { ocrCheck: true, chatFilter: true, speechDetection: true, contentFilter: true },
  timelines: { shipDays: "7", filmDays: "10", reviewDays: "7", maxRevisions: "1" },
};

type Settings = typeof defaultSettings;

const STORAGE_KEY = "mashpian_settings";

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings((prev) => ({
          general: { ...prev.general, ...parsed.general },
          credits: { ...prev.credits, ...parsed.credits },
          moderation: { ...prev.moderation, ...parsed.moderation },
          timelines: { ...prev.timelines, ...parsed.timelines },
        }));
      }
    } catch {}
  }, []);

  function updateGeneral(field: keyof Settings["general"], value: string) {
    setSettings((prev) => ({ ...prev, general: { ...prev.general, [field]: value } }));
    setSaved(false);
  }

  function updateCredits(field: keyof Settings["credits"], value: string) {
    setSettings((prev) => ({ ...prev, credits: { ...prev.credits, [field]: value } }));
    setSaved(false);
  }

  function updateModeration(field: keyof Settings["moderation"], value: boolean) {
    setSettings((prev) => ({ ...prev, moderation: { ...prev.moderation, [field]: value } }));
    setSaved(false);
  }

  function updateTimelines(field: keyof Settings["timelines"], value: string) {
    setSettings((prev) => ({ ...prev, timelines: { ...prev.timelines, [field]: value } }));
    setSaved(false);
  }

  function handleSave() {
    setSaving(true);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      setSaved(true);
      toast("ההגדרות נשמרו בהצלחה!", "success");
      setTimeout(() => setSaved(false), 3000);
    } catch {
      toast("שגיאה בשמירת ההגדרות", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">הגדרות</h1>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="text-sm text-emerald-600 font-medium">נשמר בהצלחה</span>
          )}
          <Button size="lg" onClick={handleSave} loading={saving}>
            שמירת שינויים
          </Button>
        </div>
      </div>

      <div className="space-y-6 max-w-2xl">
        <Card padding="lg">
          <CardTitle className="mb-4">הגדרות כלליות</CardTitle>
          <div className="space-y-4">
            <Input label="שם הפלטפורמה" value={settings.general.platformName} onChange={(e) => updateGeneral("platformName", e.target.value)} />
            <Input label="אימייל תמיכה" value={settings.general.supportEmail} onChange={(e) => updateGeneral("supportEmail", e.target.value)} type="email" dir="ltr" />
            <Input label="טלפון תמיכה" value={settings.general.supportPhone} onChange={(e) => updateGeneral("supportPhone", e.target.value)} type="tel" dir="ltr" />
          </div>
        </Card>

        <Card padding="lg">
          <CardTitle className="mb-4">הגדרות קרדיטים</CardTitle>
          <div className="grid grid-cols-2 gap-4">
            <Input label="מחיר קרדיט בודד (₪)" value={settings.credits.single} onChange={(e) => updateCredits("single", e.target.value)} type="number" dir="ltr" />
            <Input label="חבילת 5 קרדיטים (₪)" value={settings.credits.pack5} onChange={(e) => updateCredits("pack5", e.target.value)} type="number" dir="ltr" />
            <Input label="חבילת 10 קרדיטים (₪)" value={settings.credits.pack10} onChange={(e) => updateCredits("pack10", e.target.value)} type="number" dir="ltr" />
            <Input label="חבילת 20 קרדיטים (₪)" value={settings.credits.pack20} onChange={(e) => updateCredits("pack20", e.target.value)} type="number" dir="ltr" />
          </div>
        </Card>

        <Card padding="lg">
          <CardTitle className="mb-4">הגדרות מודרציה</CardTitle>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">בדיקת OCR אוטומטית</p>
                <p className="text-xs text-neutral-400">סריקה אוטומטית של טקסט בסרטונים</p>
              </div>
              <ToggleSwitch checked={settings.moderation.ocrCheck} onChange={(v) => updateModeration("ocrCheck", v)} />
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">סינון הודעות</p>
                <p className="text-xs text-neutral-400">חסימת פרטי קשר בצ&apos;אט</p>
              </div>
              <ToggleSwitch checked={settings.moderation.chatFilter} onChange={(v) => updateModeration("chatFilter", v)} />
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">זיהוי דיבור</p>
                <p className="text-xs text-neutral-400">תמלול אוטומטי וסינון תוכן קולי</p>
              </div>
              <ToggleSwitch checked={settings.moderation.speechDetection} onChange={(v) => updateModeration("speechDetection", v)} />
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">סינון תוכן לא הולם</p>
                <p className="text-xs text-neutral-400">זיהוי אוטומטי של אלימות ותוכן מיני</p>
              </div>
              <ToggleSwitch checked={settings.moderation.contentFilter} onChange={(v) => updateModeration("contentFilter", v)} />
            </div>
          </div>
        </Card>

        <Card padding="lg">
          <CardTitle className="mb-4">לוחות זמנים</CardTitle>
          <div className="grid grid-cols-2 gap-4">
            <Input label="זמן משלוח מוצר (ימים)" value={settings.timelines.shipDays} onChange={(e) => updateTimelines("shipDays", e.target.value)} type="number" dir="ltr" />
            <Input label="זמן צילום סרטון (ימים)" value={settings.timelines.filmDays} onChange={(e) => updateTimelines("filmDays", e.target.value)} type="number" dir="ltr" />
            <Input label="זמן בדיקה (ימים)" value={settings.timelines.reviewDays} onChange={(e) => updateTimelines("reviewDays", e.target.value)} type="number" dir="ltr" />
            <Input label="תיקונים מותרים" value={settings.timelines.maxRevisions} onChange={(e) => updateTimelines("maxRevisions", e.target.value)} type="number" dir="ltr" />
          </div>
        </Card>

        <Card padding="lg">
          <CardTitle className="mb-4">חיבורים חיצוניים</CardTitle>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-3 border-b border-neutral-50">
              <div className="flex items-center gap-3">
                <span className="text-lg">💳</span>
                <div>
                  <p className="text-sm font-medium">Cardcom — תשלומים</p>
                  <p className="text-xs text-neutral-400">טרם חובר</p>
                </div>
              </div>
              <Button size="sm" variant="outline">חיבור</Button>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-neutral-50">
              <div className="flex items-center gap-3">
                <span className="text-lg">📧</span>
                <div>
                  <p className="text-sm font-medium">Email — הודעות</p>
                  <p className="text-xs text-neutral-400">טרם חובר</p>
                </div>
              </div>
              <Button size="sm" variant="outline">חיבור</Button>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-neutral-50">
              <div className="flex items-center gap-3">
                <span className="text-lg">📱</span>
                <div>
                  <p className="text-sm font-medium">WhatsApp — הודעות</p>
                  <p className="text-xs text-neutral-400">טרם חובר</p>
                </div>
              </div>
              <Button size="sm" variant="outline">חיבור</Button>
            </div>
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <span className="text-lg">🧾</span>
                <div>
                  <p className="text-sm font-medium">חשבוניות</p>
                  <p className="text-xs text-neutral-400">טרם חובר</p>
                </div>
              </div>
              <Button size="sm" variant="outline">חיבור</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only peer"
      />
      <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-500" />
    </label>
  );
}
