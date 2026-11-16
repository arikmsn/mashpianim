"use client";

import { useEffect, useState } from "react";
import { Badge, Card, useToast } from "@/components/ui";
import type { DailyPoint, MessageCounts } from "@/lib/messaging-stats";

type Recent = {
  id: string;
  channel: "sms" | "whatsapp";
  kind: string;
  phone: string;
  status: "sent" | "failed" | "dry";
  provider_ref: string | null;
  created_at: string;
  user_name: string | null;
  user_type: string | null;
  text: string | null;
};

type Payload = {
  available: boolean;
  counts: MessageCounts | null;
  daily: DailyPoint[];
  recent: Recent[];
  digests?: "off" | "dry" | "on";
};

const kindLabel: Record<string, string> = {
  otp: "קוד כניסה",
  welcome: "ברוכים הבאים",
  heart: "לב",
  match: "מאטץ'",
  digest_creator: "סיכום יומי ליוצר/ת",
  digest_brand: "סיכום שבועי לעסק",
  other: "אחר",
};

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function dayLabel(key: string): string {
  const [y, m, d] = key.split("-");
  return `${d}.${m}.${y.slice(2)}`;
}

// Every SMS / WhatsApp the platform sent (owner, 2026-11-16): the counts the owner follows, a day-by-day table,
// and the latest sends — including the WhatsApp digests' texts (dry runs too).
export default function AdminMessagesPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [days, setDays] = useState(30);
  const [open, setOpen] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetch(`/api/admin/messages?days=${days}`)
      .then((res) => (res.ok ? (res.json() as Promise<Payload>) : Promise.reject(new Error("API error"))))
      .then((payload) => setData(payload))
      .catch(() => toast("שגיאה בטעינת יומן ההודעות", "error"));
  }, [days, toast]);

  if (!data) return <p className="text-sm text-neutral-400 p-8">טוען...</p>;

  const c = data.counts;
  const digestLabel = data.digests === "on" ? "פעילים" : data.digests === "dry" ? "מצב ניסוי (נרשמים, לא נשלחים)" : "כבויים";

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">הודעות שנשלחו</h1>
          <p className="text-neutral-500 text-sm mt-1">
            SMS (Twilio) ו-WhatsApp (GreenAPI) שהמערכת שלחה · סיכומי WhatsApp: {digestLabel}
          </p>
        </div>
        <div className="flex gap-1 bg-neutral-50 rounded-lg p-0.5">
          {[7, 30, 90].map((d) => (
            <button key={d} onClick={() => setDays(d)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${days === d ? "bg-white shadow-sm text-pink-500" : "text-neutral-500"}`}>
              {d} ימים
            </button>
          ))}
        </div>
      </div>

      {!data.available && (
        <div className="mb-6 rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-800">
          יומן ההודעות יתחיל להיספר אחרי הפעלת מיגרציה 023 (<code>message_log</code>).
        </div>
      )}

      {c && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {(
            [
              ["📱 SMS היום", c.sms.today, `${c.sms.week} ב-7 ימים · ${c.sms.month} ב-30 ימים`],
              ["📱 SMS נכשלו (30 ימים)", c.sms.failed_month, "שליחות שטוויליו דחה"],
              ["💬 WhatsApp היום", c.whatsapp.today, `${c.whatsapp.week} ב-7 ימים · ${c.whatsapp.month} ב-30 ימים`],
              ["💬 WhatsApp נכשלו (30 ימים)", c.whatsapp.failed_month, "שליחות ש-GreenAPI דחה"],
            ] as [string, number, string][]
          ).map(([label, value, sub]) => (
            <Card key={label} padding="md">
              <p className="text-xs text-neutral-500">{label}</p>
              <p className="text-2xl font-bold mt-1">{value}</p>
              <p className="text-[11px] text-neutral-400 mt-1">{sub}</p>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card padding="md">
          <h2 className="font-bold mb-3">לפי יום</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-right text-xs text-neutral-400 border-b border-neutral-100">
                  <th className="py-2 px-2">תאריך</th>
                  <th className="py-2 px-2">SMS</th>
                  <th className="py-2 px-2">WhatsApp</th>
                  <th className="py-2 px-2">נכשלו</th>
                  <th className="py-2 px-2">ניסוי</th>
                </tr>
              </thead>
              <tbody>
                {data.daily.map((d) => (
                  <tr key={d.date} className="border-b border-neutral-50">
                    <td className="py-1.5 px-2 text-neutral-600" dir="ltr">{dayLabel(d.date)}</td>
                    <td className="py-1.5 px-2 font-medium">{d.sms || ""}</td>
                    <td className="py-1.5 px-2 font-medium">{d.whatsapp || ""}</td>
                    <td className="py-1.5 px-2 text-red-600">{d.failed || ""}</td>
                    <td className="py-1.5 px-2 text-neutral-400">{d.dry || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card padding="md">
          <h2 className="font-bold mb-3">אחרונות ({data.recent.length})</h2>
          {data.recent.length === 0 ? (
            <p className="text-sm text-neutral-400">עדיין לא נרשמו הודעות.</p>
          ) : (
            <div className="space-y-1.5 max-h-[640px] overflow-y-auto">
              {data.recent.map((r) => (
                <div key={r.id} className="rounded-xl border border-neutral-100 px-3 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span>{r.channel === "sms" ? "📱" : "💬"}</span>
                      <span className="font-medium">{kindLabel[r.kind] || r.kind}</span>
                      <span className="text-neutral-500" dir="ltr">{r.phone}</span>
                      {r.user_name && <span className="text-neutral-400">· {r.user_name}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={r.status === "sent" ? "success" : r.status === "dry" ? "info" : "danger"} size="sm">
                        {r.status === "sent" ? "נשלח" : r.status === "dry" ? "ניסוי" : "נכשל"}
                      </Badge>
                      <span className="text-neutral-400" dir="ltr">{when(r.created_at)}</span>
                    </div>
                  </div>
                  {r.text && (
                    <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} className="mt-1 text-pink-600 hover:underline">
                      {open === r.id ? "הסתרת הטקסט" : "הצגת הטקסט"}
                    </button>
                  )}
                  {r.text && open === r.id && <pre className="mt-1 whitespace-pre-wrap font-sans text-neutral-700 bg-neutral-50 rounded-lg p-2">{r.text}</pre>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
