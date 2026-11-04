"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, Card, Textarea, useToast } from "@/components/ui";
import { fetchJson } from "@/lib/client-cache";
import { BRIEF_SECTIONS, BRIEF_TEXT_MAX, briefDataLines, hasBriefContent, sanitizeBriefData, definesFormat, FORMAT_LINES, type BriefData } from "@/lib/brief";

interface ProductRow {
  id: string;
  name: string;
  brief?: string | null;
  brief_data?: BriefData | null;
  brand_user_id?: string | null;
}

// Structured brief per product: every section is optional and multi-select; the creator sees the result on
// the product page and in the chat when the brand confirms a match.
export default function ProductBriefPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const { toast } = useToast();

  const [product, setProduct] = useState<ProductRow | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [picks, setPicks] = useState<Record<string, string[]>>({});
  const [messages, setMessages] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const data = await fetchJson<{ product?: ProductRow; error?: string }>(`/api/products/${id}`);
    if (!data?.product) {
      setNotFound(true);
      return;
    }
    const p = data.product;
    setProduct(p);
    const existing = sanitizeBriefData(p.brief_data) || {};
    const { messages: m, ...sections } = existing;
    setPicks(sections as Record<string, string[]>);
    setMessages(m || "");
    setNotes(p.brief || "");
  }, [id]);

  useEffect(() => {
    const t = setTimeout(() => {
      load();
    }, 0);
    return () => clearTimeout(t);
  }, [load]);

  function toggle(section: string, option: string) {
    setDirty(true);
    setPicks((prev) => {
      const current = prev[section] || [];
      const next = current.includes(option) ? current.filter((o) => o !== option) : [...current, option];
      return { ...prev, [section]: next };
    });
  }

  const data = sanitizeBriefData({ ...picks, messages });
  const previewLines = briefDataLines(data);
  const pickedCount = Object.values(picks).reduce((n, arr) => n + arr.length, 0);

  async function save() {
    if (!id) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief_data: data, brief: notes.trim() || null }),
      });
      if (res.ok) {
        toast("הבריף נשמר — היוצרים יראו אותו בדף המוצר ובצ'אט", "success");
        setDirty(false);
      } else {
        const d = await res.json().catch(() => ({}));
        toast((d as { error?: string }).error || "שגיאה בשמירה", "error");
      }
    } catch {
      toast("שגיאה בשמירה", "error");
    } finally {
      setSaving(false);
    }
  }

  if (notFound) {
    return (
      <main className="min-h-screen bg-background pb-24">
        <div className="max-w-2xl mx-auto px-4 py-20 text-center text-neutral-400">
          <span className="text-4xl block mb-4">📦</span>
          <p>המוצר לא נמצא</p>
          <Button className="mt-6" variant="secondary" onClick={() => router.push("/brand/products")}>למוצרים</Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-neutral-100">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/brand/products")}
            className="p-2 -mr-2 rounded-lg hover:bg-neutral-100 transition-colors"
            aria-label="חזרה למוצרים"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold truncate">בריף ליוצר/ת</h1>
            <p className="text-xs text-neutral-500 truncate">{product?.name || "..."}</p>
          </div>
          <Button size="sm" loading={saving} onClick={save} disabled={!product}>
            שמירה
          </Button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        <p className="text-sm text-neutral-600 bg-pink-50 rounded-2xl px-4 py-3">
          סמנו מה חשוב לכם בסרטון — כל סעיף אופציונלי ואפשר לבחור כמה אפשרויות. היוצר/ת רואה את הבריף בדף המוצר לפני ששולח/ת לב, ושוב בצ&apos;אט כשהחיבור מאושר.
        </p>

        {BRIEF_SECTIONS.map((section) => {
          const chosen = picks[section.key] || [];
          return (
            <Card key={section.key} padding="sm">
              <div className="flex items-baseline justify-between mb-2">
                <h2 className="text-sm font-bold text-neutral-900">{section.title}</h2>
                {section.hint && <span className="text-[11px] text-neutral-400">{section.hint}</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                {section.options.map((option) => {
                  const active = chosen.includes(option);
                  return (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggle(section.key, option)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        active ? "bg-pink-500 border-pink-500 text-white" : "bg-neutral-50 border-neutral-200 text-neutral-600 hover:border-pink-300"
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </Card>
          );
        })}

        <Card padding="sm">
          <label className="block text-sm font-bold text-neutral-900 mb-1">מסרים מרכזיים</label>
          <p className="text-[11px] text-neutral-400 mb-2">מה חובה להגיד על המוצר (עד 3 נקודות עובד הכי טוב)</p>
          <Textarea
            placeholder="למשל: 1. ללא סוכר 2. מתאים לטבעונים 3. משלוח חינם עד הבית"
            value={messages}
            maxLength={BRIEF_TEXT_MAX}
            rows={4}
            onChange={(e) => { setDirty(true); setMessages(e.target.value); }}
          />
        </Card>

        <Card padding="sm">
          <label className="block text-sm font-bold text-neutral-900 mb-1">הערות נוספות ליוצר/ת</label>
          <p className="text-[11px] text-neutral-400 mb-2">כל דבר אחר שחשוב שיידעו — טון, דוגמאות, מה להימנע ממנו</p>
          <Textarea
            placeholder="טקסט חופשי..."
            value={notes}
            maxLength={BRIEF_TEXT_MAX}
            rows={4}
            onChange={(e) => { setDirty(true); setNotes(e.target.value); }}
          />
        </Card>

        <Card padding="sm" className="bg-neutral-50">
          <h2 className="text-sm font-bold text-neutral-900 mb-2">כך היוצר/ת יראה/תראה את הבריף</h2>
          {hasBriefContent(data, notes) ? (
            <div className="text-sm text-neutral-700 space-y-1">
              {previewLines.map((line, i) => (
                <p key={i} className={line.endsWith(":") ? "font-medium text-neutral-900 mt-1" : "whitespace-pre-line"}>{line}</p>
              ))}
              {notes.trim() && (
                <>
                  <p className="font-medium text-neutral-900 mt-1">הערות מהעסק:</p>
                  <p className="whitespace-pre-line">{notes.trim()}</p>
                </>
              )}
              <ul className="text-xs text-neutral-500 space-y-1 border-t border-neutral-200 pt-2 mt-2">
                {FORMAT_LINES.slice(definesFormat(data) ? 1 : 0).map((line) => (
                  <li key={line}>• {line}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-neutral-400">עדיין לא סומן כלום — היוצר/ת יקבל/תקבל תבנית למילוי בצ&apos;אט.</p>
          )}
        </Card>

        <div className="flex items-center justify-between text-xs text-neutral-400">
          <span>{pickedCount > 0 ? `${pickedCount} סימונים` : "ללא סימונים"}{dirty ? " · יש שינויים שלא נשמרו" : ""}</span>
          <Button size="sm" loading={saving} onClick={save} disabled={!product}>
            שמירת הבריף
          </Button>
        </div>
      </div>
    </main>
  );
}
