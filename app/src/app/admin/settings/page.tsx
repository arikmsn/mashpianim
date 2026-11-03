"use client";

import { useState, useEffect } from "react";
import { Card, CardTitle, Button, Input, useToast } from "@/components/ui";

const defaultSettings = {
  general: { platformName: "Mashpian", supportEmail: "support@mashpian.online", supportPhone: "" },
  credits: { single: "100", pack5: "450", pack10: "800", pack20: "1400" },
  moderation: { ocrCheck: true, chatFilter: true, speechDetection: true, contentFilter: true },
  timelines: { shipDays: "7", filmDays: "10", reviewDays: "7", maxRevisions: "2" },
};

type Settings = typeof defaultSettings;
type ApiSettings = Record<string, Record<string, unknown>>;

const str = (v: unknown, fallback: string) => (v === undefined || v === null ? fallback : String(v));
const bool = (v: unknown, fallback: boolean) =>
  typeof v === "boolean" ? v : v === "true" ? true : v === "false" ? false : fallback;
const num = (v: string, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

// Form state ⇄ site_settings rows (keys exactly as stored in the database; `timelines` drives the
// connection deadlines and the revision limit on the server)
function fromApi(api: ApiSettings): Settings {
  const g = api.general || {};
  const c = api.credits || {};
  const m = api.moderation || {};
  const t = api.timelines || {};
  return {
    general: {
      platformName: str(g.platform_name, defaultSettings.general.platformName),
      supportEmail: str(g.support_email, defaultSettings.general.supportEmail),
      supportPhone: str(g.support_phone, ""),
    },
    credits: {
      single: str(c.single_price, "100"),
      pack5: str(c.pack_5_price, "450"),
      pack10: str(c.pack_10_price, "800"),
      pack20: str(c.pack_20_price, "1400"),
    },
    moderation: {
      ocrCheck: bool(m.auto_ocr, true),
      chatFilter: bool(m.chat_filter, true),
      speechDetection: bool(m.speech_detection, true),
      contentFilter: bool(m.nsfw_filter, true),
    },
    timelines: {
      shipDays: str(t.shipping_days, "7"),
      filmDays: str(t.filming_days, "10"),
      reviewDays: str(t.review_days, "7"),
      maxRevisions: str(t.max_revisions, "2"),
    },
  };
}

function toApi(s: Settings): ApiSettings {
  return {
    general: { platform_name: s.general.platformName, support_email: s.general.supportEmail, support_phone: s.general.supportPhone },
    credits: {
      single_price: num(s.credits.single, 100),
      pack_5_price: num(s.credits.pack5, 450),
      pack_10_price: num(s.credits.pack10, 800),
      pack_20_price: num(s.credits.pack20, 1400),
    },
    moderation: {
      auto_ocr: s.moderation.ocrCheck,
      chat_filter: s.moderation.chatFilter,
      speech_detection: s.moderation.speechDetection,
      nsfw_filter: s.moderation.contentFilter,
    },
    timelines: {
      shipping_days: num(s.timelines.shipDays, 7),
      filming_days: num(s.timelines.filmDays, 10),
      review_days: num(s.timelines.reviewDays, 7),
      max_revisions: num(s.timelines.maxRevisions, 2),
    },
  };
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.settings) setSettings(fromApi(d.settings as ApiSettings));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
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

  async function handleSave() {
    setSaving(true);
    try {
      const payload = toApi(settings);
      for (const section of Object.keys(payload)) {
        const res = await fetch("/api/admin/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ section, data: payload[section] }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error || "שגיאה בשמירה");
        }
      }
      setSaved(true);
      toast("ההגדרות נשמרו בהצלחה!", "success");
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      toast(err instanceof Error ? err.message : "שגיאה בשמירת ההגדרות", "error");
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
          <Button size="lg" onClick={handleSave} loading={saving || loading}>
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
          <CardTitle className="mb-4">הגדרות פניות</CardTitle>
          <div className="grid grid-cols-2 gap-4">
            <Input label="מחיר פנייה בודדת (₪)" value={settings.credits.single} onChange={(e) => updateCredits("single", e.target.value)} type="number" dir="ltr" />
            <Input label="חבילת 5 פניות (₪)" value={settings.credits.pack5} onChange={(e) => updateCredits("pack5", e.target.value)} type="number" dir="ltr" />
            <Input label="חבילת 10 פניות (₪)" value={settings.credits.pack10} onChange={(e) => updateCredits("pack10", e.target.value)} type="number" dir="ltr" />
            <Input label="חבילת 20 פניות (₪)" value={settings.credits.pack20} onChange={(e) => updateCredits("pack20", e.target.value)} type="number" dir="ltr" />
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
