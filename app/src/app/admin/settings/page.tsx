"use client";

import { Card, CardTitle, Button, Input } from "@/components/ui";

export default function AdminSettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">הגדרות</h1>

      <div className="space-y-6 max-w-2xl">
        <Card padding="lg">
          <CardTitle className="mb-4">הגדרות כלליות</CardTitle>
          <div className="space-y-4">
            <Input label="שם הפלטפורמה" defaultValue="Mashpianim" />
            <Input label="אימייל תמיכה" defaultValue="support@mashpianim.co.il" type="email" dir="ltr" />
            <Input label="טלפון תמיכה" defaultValue="03-1234567" type="tel" dir="ltr" />
          </div>
        </Card>

        <Card padding="lg">
          <CardTitle className="mb-4">הגדרות קרדיטים</CardTitle>
          <div className="grid grid-cols-2 gap-4">
            <Input label="מחיר קרדיט בודד (₪)" defaultValue="100" type="number" dir="ltr" />
            <Input label="חבילת 5 קרדיטים (₪)" defaultValue="450" type="number" dir="ltr" />
            <Input label="חבילת 10 קרדיטים (₪)" defaultValue="800" type="number" dir="ltr" />
            <Input label="חבילת 20 קרדיטים (₪)" defaultValue="1400" type="number" dir="ltr" />
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
              <ToggleSwitch defaultChecked />
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">סינון הודעות</p>
                <p className="text-xs text-neutral-400">חסימת פרטי קשר בצ&apos;אט</p>
              </div>
              <ToggleSwitch defaultChecked />
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">זיהוי דיבור</p>
                <p className="text-xs text-neutral-400">תמלול אוטומטי וסינון תוכן קולי</p>
              </div>
              <ToggleSwitch defaultChecked />
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">סינון תוכן לא הולם</p>
                <p className="text-xs text-neutral-400">זיהוי אוטומטי של אלימות ותוכן מיני</p>
              </div>
              <ToggleSwitch defaultChecked />
            </div>
          </div>
        </Card>

        <Card padding="lg">
          <CardTitle className="mb-4">לוחות זמנים</CardTitle>
          <div className="grid grid-cols-2 gap-4">
            <Input label="זמן משלוח מוצר (ימים)" defaultValue="7" type="number" dir="ltr" />
            <Input label="זמן צילום סרטון (ימים)" defaultValue="10" type="number" dir="ltr" />
            <Input label="זמן בדיקה (ימים)" defaultValue="7" type="number" dir="ltr" />
            <Input label="תיקונים מותרים" defaultValue="1" type="number" dir="ltr" />
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

        <div className="flex justify-end">
          <Button size="lg">שמירת שינויים</Button>
        </div>
      </div>
    </div>
  );
}

function ToggleSwitch({ defaultChecked = false }: { defaultChecked?: boolean }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        defaultChecked={defaultChecked}
        className="sr-only peer"
      />
      <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-500" />
    </label>
  );
}
