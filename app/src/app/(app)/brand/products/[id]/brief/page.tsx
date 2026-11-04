"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button, Card, Textarea, useToast } from "@/components/ui";
import { BriefFull } from "@/components/features/brief-view";
import { fetchJson } from "@/lib/client-cache";
import { BRIEF_SECTIONS, BRIEF_MORE_TITLE, BRIEF_TEXT_MAX, hasBriefContent, sanitizeBriefData, type BriefData } from "@/lib/brief";

interface ProductRow {
  id: string;
  name: string;
  brief?: string | null;
  brief_data?: BriefData | null;
  brand_user_id?: string | null;
}

export default function ProductBriefPage() {
  return (
    <Suspense>
      <ProductBriefPageInner />
    </Suspense>
  );
}

// The brief template per product (מה רואים · מה היא תגיד · אורך · שוטים · כתוביות · כללי צילום · מה אסור · עוד משהו).
// Saved on the product; with `?connection=<id>` the saved brief is also posted into that chat as a card.
function ProductBriefPageInner() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const searchParams = useSearchParams();
  const connectionId = searchParams.get("connection");
  const router = useRouter();
  const { toast } = useToast();

  const [product, setProduct] = useState<ProductRow | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [picks, setPicks] = useState<Record<string, string[]>>({});
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);

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
    const chips: Record<string, string[]> = {};
    const strings: Record<string, string> = {};
    for (const section of BRIEF_SECTIONS) {
      const v = existing[section.key];
      if (section.type === "chips" && Array.isArray(v)) chips[section.key] = v;
      if (section.type === "text" && typeof v === "string") strings[section.key] = v;
    }
    setPicks(chips);
    setTexts(strings);
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

  const data = sanitizeBriefData({ ...picks, ...texts });
  const filledCount = BRIEF_SECTIONS.filter((s) => (s.type === "chips" ? (picks[s.key] || []).length > 0 : !!texts[s.key]?.trim())).length;
  const backHref = connectionId ? `/messages?connection=${connectionId}` : "/brand/products";

  async function save() {
    if (!id) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief_data: data, brief: notes.trim() || null }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast((d as { error?: string }).error || "שגיאה בשמירה", "error");
        return;
      }
      setDirty(false);
      if (connectionId) {
        // Into the chat: the creator gets the card (and the earlier approval, if any, is reset)
        const post = await fetch(`/api/connections/${connectionId}/brief`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "post" }),
        });
        if (post.ok) {
          toast("הבריף נשלח לצ'אט — היוצר/ת תאשר אותו", "success");
          router.push(`/messages?connection=${connectionId}`);
          return;
        }
        const d = await post.json().catch(() => ({}));
        toast((d as { error?: string }).error || "הבריף נשמר אבל לא נשלח לצ'אט", "error");
        return;
      }
      toast("הבריף נשמר — היוצרים יראו אותו בדף המוצר ובצ'אט", "success");
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
            onClick={() => router.push(backHref)}
            className="p-2 -mr-2 rounded-lg hover:bg-neutral-100 transition-colors"
            aria-label="חזרה"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold truncate">בריף לסרטון</h1>
            <p className="text-xs text-neutral-500 truncate">{product?.name || "..."}</p>
          </div>
          <Button size="sm" loading={saving} onClick={save} disabled={!product}>
            {connectionId ? "שמירה ושליחה לצ'אט" : "שמירה"}
          </Button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        <p className="text-sm text-neutral-600 bg-pink-50 rounded-2xl px-4 py-3">
          {connectionId
            ? "הבריף יישלח לצ'אט כקלף שהיוצר/ת מאשר/ת. אפשר לעדכן אותו בכל שלב — כל עדכון מחייב אישור מחדש."
            : "סמנו מה חשוב לכם בסרטון — כל סעיף אופציונלי. היוצר/ת רואה את הבריף בדף המוצר, ומאשר/ת אותו בצ'אט אחרי המאטץ'."}
        </p>

        {BRIEF_SECTIONS.map((section) => {
          if (section.type === "text") {
            return (
              <Card key={section.key} padding="sm">
                <label className="block text-sm font-bold text-neutral-900 mb-1">{section.title}</label>
                <Textarea
                  placeholder={section.placeholder}
                  value={texts[section.key] || ""}
                  maxLength={BRIEF_TEXT_MAX}
                  rows={3}
                  onChange={(e) => { setDirty(true); setTexts((prev) => ({ ...prev, [section.key]: e.target.value })); }}
                />
              </Card>
            );
          }
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
          <label className="block text-sm font-bold text-neutral-900 mb-1">{BRIEF_MORE_TITLE}</label>
          <p className="text-[11px] text-neutral-400 mb-2">כל דבר אחר שחשוב שיידעו — טון, דוגמאות, מה חובה להגיד</p>
          <Textarea
            placeholder="טקסט חופשי..."
            value={notes}
            maxLength={BRIEF_TEXT_MAX}
            rows={4}
            onChange={(e) => { setDirty(true); setNotes(e.target.value); }}
          />
        </Card>

        <Card padding="sm" className="bg-neutral-50">
          <button type="button" onClick={() => setPreview((p) => !p)} className="w-full flex items-center justify-between text-sm font-bold text-neutral-900">
            <span>כך היוצר/ת רואה את הבריף</span>
            <span className="text-pink-500 text-xs font-medium">{preview ? "הסתרה" : "תצוגה מקדימה"}</span>
          </button>
          {preview && (
            <div className="mt-3 bg-white rounded-xl p-3">
              {hasBriefContent(data, notes) ? (
                <BriefFull data={data} notes={notes} productName={product?.name} />
              ) : (
                <p className="text-sm text-neutral-400">עדיין לא סומן כלום — היוצר/ת תקבל בריף ריק לאישור.</p>
              )}
            </div>
          )}
        </Card>

        <div className="flex items-center justify-between text-xs text-neutral-400">
          <span>{filledCount > 0 ? `${filledCount} סעיפים מולאו` : "ללא סימונים"}{dirty ? " · יש שינויים שלא נשמרו" : ""}</span>
          <Button size="sm" loading={saving} onClick={save} disabled={!product}>
            {connectionId ? "שמירה ושליחה לצ'אט" : "שמירת הבריף"}
          </Button>
        </div>
      </div>
    </main>
  );
}
