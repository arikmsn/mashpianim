"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, useToast } from "@/components/ui";
import {
  CONTENT_PAGES,
  SECTIONS,
  defaultsFromSchema,
  mergeSiteContent,
  sectionViewHref,
  sectionsForPage,
  validateFieldValue,
  type ContentField,
  type ContentPage,
  type ContentRecord,
  type ContentSection,
  type FieldValueAny,
  type ListItemRecord,
  type SectionRecord,
} from "@/lib/site-content";

// /admin/content, built from the schema in lib/site-content.ts (design package v3, "ניהול תוכן מהאדמין" §4):
// tabs per page, collapsible sections, search, label + help + character counter per field, restore default per
// field and per section, lists with add / remove / drag, save per section with "saved by X at Y", a "view page"
// link to the section's anchor, warnings for urls, markdown and unknown variables.

type Meta = Record<string, { updated_at: string | null; updated_by: string | null; updated_by_name: string | null }>;

const DEFAULTS = defaultsFromSchema();

function valueOf(values: ContentRecord, sectionId: string, key: string): FieldValueAny {
  return values[sectionId]?.[key] ?? DEFAULTS[sectionId][key];
}

function isDefault(value: FieldValueAny, dflt: FieldValueAny): boolean {
  return JSON.stringify(value) === JSON.stringify(dflt);
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Jerusalem" });
  } catch {
    return iso;
  }
}

function fieldMatches(field: ContentField, value: FieldValueAny, q: string): boolean {
  if (field.label.toLowerCase().includes(q) || field.key.includes(q)) return true;
  if (typeof value === "string") return value.toLowerCase().includes(q);
  if (Array.isArray(value)) return value.some((item) => Object.values(item).some((v) => String(v).toLowerCase().includes(q)));
  return false;
}

export default function AdminContentPage() {
  const [values, setValues] = useState<ContentRecord | null>(null);
  const [saved, setSaved] = useState<ContentRecord>({});
  const [meta, setMeta] = useState<Meta>({});
  const [tab, setTab] = useState<ContentPage>("home");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(["home_hero"]));
  const [saving, setSaving] = useState<string | null>(null);
  const [materialChange, setMaterialChange] = useState(false);
  const [updatingStats, setUpdatingStats] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/content", { cache: "no-store" });
        const data = res.ok ? await res.json() : null;
        if (cancelled) return;
        const merged = mergeSiteContent(data?.content) as unknown as ContentRecord;
        setValues(merged);
        setSaved(JSON.parse(JSON.stringify(merged)));
        setMeta(data?.meta || {});
      } catch {
        if (!cancelled) {
          const merged = mergeSiteContent(null) as unknown as ContentRecord;
          setValues(merged);
          setSaved(JSON.parse(JSON.stringify(merged)));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const q = query.trim().toLowerCase();
  const visibleSections = useMemo(() => {
    const list = q ? SECTIONS : sectionsForPage(tab);
    if (!q || !values) return list;
    return list.filter((s) => s.label.toLowerCase().includes(q) || s.fields.some((f) => fieldMatches(f, valueOf(values, s.id, f.key), q)));
  }, [q, tab, values]);

  function setField(sectionId: string, key: string, value: FieldValueAny) {
    setValues((prev) => (prev ? { ...prev, [sectionId]: { ...prev[sectionId], [key]: value } } : prev));
  }

  function restoreSection(section: ContentSection) {
    setValues((prev) => (prev ? { ...prev, [section.id]: JSON.parse(JSON.stringify(DEFAULTS[section.id])) } : prev));
  }

  function isDirty(sectionId: string): boolean {
    return !!values && JSON.stringify(values[sectionId]) !== JSON.stringify(saved[sectionId]);
  }

  async function saveSection(section: ContentSection) {
    if (!values) return;
    setSaving(section.id);
    try {
      const res = await fetch("/api/admin/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: section.id, data: values[section.id], materialChange: section.id === "legal_terms" ? materialChange : undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; data?: SectionRecord; version?: string; warnings?: string[] };
      if (!res.ok) {
        toast(`שגיאה בשמירה: ${data.error || res.status}`, "error");
        return;
      }
      const next = { ...values[section.id], ...(data.data || {}) };
      setValues((prev) => (prev ? { ...prev, [section.id]: next } : prev));
      setSaved((prev) => ({ ...prev, [section.id]: JSON.parse(JSON.stringify(next)) }));
      setMeta((prev) => ({ ...prev, [section.id]: { updated_at: new Date().toISOString(), updated_by: null, updated_by_name: "אני" } }));
      setMaterialChange(false);
      toast(data.version && section.id === "legal_terms" && materialChange ? `נשמר. גרסת התנאים עודכנה ל-${data.version}, כל המשתמשים יתבקשו לאשר מחדש` : "המקטע נשמר", "success");
      if (data.warnings?.length) toast(`שימו לב: ${data.warnings[0]}`, "error");
    } catch {
      toast("אין חיבור לשרת", "error");
    } finally {
      setSaving(null);
    }
  }

  async function updateStatsFromSystem() {
    setUpdatingStats(true);
    try {
      const res = await fetch("/api/admin/content/stats", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string; stat1_value?: string; stat2_value?: string };
      if (!res.ok) {
        toast(data.error || "שגיאה בעדכון", "error");
        return;
      }
      setValues((prev) => (prev ? { ...prev, home_stats: { ...prev.home_stats, stat1_value: data.stat1_value || "", stat2_value: data.stat2_value || "" } } : prev));
      setSaved((prev) => ({ ...prev, home_stats: { ...(prev.home_stats || {}), stat1_value: data.stat1_value || "", stat2_value: data.stat2_value || "" } }));
      toast(`עודכן מהמערכת: ${data.stat1_value} יוצרים, ${data.stat2_value} סרטונים`, "success");
    } catch {
      toast("אין חיבור לשרת", "error");
    } finally {
      setUpdatingStats(false);
    }
  }

  if (!values) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 mb-8">תוכן האתר</h1>
        <div className="space-y-3 max-w-4xl animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 bg-neutral-100 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">תוכן האתר</h1>
          <p className="text-neutral-500 text-sm mt-1">כל טקסט בדף הבית, בשאלון, במסכי הכניסה, בעמודי המשפט וב-SEO. שמירה לכל מקטע, השינוי מופיע באתר תוך דקה.</p>
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש בשמות השדות ובטקסטים..."
          className="w-full sm:w-72 px-4 py-2.5 rounded-xl border border-border-strong bg-white text-sm outline-none focus:border-ink-900 focus:ring-2 focus:ring-focus-ring/15"
        />
      </div>

      {!q && (
        <div className="flex flex-wrap gap-1 mb-6 bg-neutral-100 p-1 rounded-xl w-fit">
          {CONTENT_PAGES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setTab(p.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === p.id ? "bg-white shadow-sm text-pink-700" : "text-neutral-600 hover:text-neutral-900"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3 max-w-4xl">
        {visibleSections.length === 0 && <p className="text-sm text-neutral-500">לא נמצא כלום.</p>}
        {visibleSections.map((section) => {
          const open = !!q || expanded.has(section.id);
          const m = meta[section.id];
          const dirty = isDirty(section.id);
          const href = sectionViewHref(section);
          return (
            <div key={section.id} className="bg-white rounded-2xl border border-border shadow-sm">
              <div className="flex items-center gap-3 px-5 py-3.5">
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => { const next = new Set(prev); if (next.has(section.id)) next.delete(section.id); else next.add(section.id); return next; })}
                  className="flex-1 flex items-center gap-3 text-right"
                  aria-expanded={open}
                >
                  <svg className={`w-4 h-4 text-neutral-400 transition-transform shrink-0 ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                  <span className="font-semibold text-neutral-900">{section.label}</span>
                  {dirty && <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">לא נשמר</span>}
                </button>
                {m?.updated_at && (
                  <span className="hidden sm:block text-[11px] text-neutral-400">
                    נשמר על ידי {m.updated_by_name || "מנהל/ת"} ב-{formatWhen(m.updated_at)}
                  </span>
                )}
                {href !== "/404-preview" && (
                  <a href={href} target="_blank" rel="noreferrer" className="text-xs text-pink-700 hover:underline whitespace-nowrap">
                    צפייה בדף ↗
                  </a>
                )}
              </div>

              {open && (
                <div className="px-5 pb-5 border-t border-border pt-4 space-y-5">
                  {section.help && <p className="text-xs text-neutral-500 bg-neutral-50 rounded-lg px-3 py-2">{section.help}</p>}
                  {section.id === "home_stats" && (
                    <div className="flex items-center gap-3">
                      <Button size="sm" variant="secondary" onClick={updateStatsFromSystem} loading={updatingStats}>
                        עדכון מהמערכת
                      </Button>
                      <span className="text-xs text-neutral-500">סופר יוצרים פעילים וסרטוני תיק עבודות, שומר ומרענן את דף הבית.</span>
                    </div>
                  )}
                  {section.fields.map((field) => (
                    <FieldEditor
                      key={field.key}
                      field={field}
                      value={valueOf(values, section.id, field.key)}
                      dflt={DEFAULTS[section.id][field.key]}
                      onChange={(v) => setField(section.id, field.key, v)}
                    />
                  ))}
                  {section.id === "legal_terms" && (
                    <label className="flex items-start gap-3 text-sm bg-amber-50 border border-amber-100 rounded-xl p-3 cursor-pointer">
                      <input type="checkbox" checked={materialChange} onChange={(e) => setMaterialChange(e.target.checked)} className="mt-0.5 w-4 h-4 accent-pink-600" />
                      <span>
                        <b>זה שינוי מהותי, לדרוש אישור מחדש מכל המשתמשים.</b>
                        <span className="block text-xs text-neutral-600 mt-1">
                          מסומן: גרסת התנאים תתעדכן לתאריך של היום וכל משתמש יראה את שער האישור בכניסה הבאה. לא מסומן: רק הטקסט ושורת העדכון משתנים. החלטה משפטית, לכן לא מסומן כברירת מחדל.
                        </span>
                      </span>
                    </label>
                  )}
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <Button size="sm" onClick={() => saveSection(section)} loading={saving === section.id} disabled={!dirty && section.id !== "legal_terms"}>
                      שמירת המקטע
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => restoreSection(section)}>
                      שחזור ברירת המחדל של המקטע
                    </Button>
                    {dirty && <span className="text-xs text-neutral-500">יש שינויים שלא נשמרו</span>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// One field
// ---------------------------------------------------------------------------------------------------------------
const inputCls = "w-full px-3.5 py-2.5 rounded-xl border border-border-strong bg-white text-sm outline-none transition-colors focus:border-ink-900 focus:ring-2 focus:ring-focus-ring/15 disabled:bg-neutral-50 disabled:text-neutral-500";

function Counter({ length, max }: { length: number; max?: number }) {
  if (!max) return null;
  return <span className={`font-mono text-[11px] ${length > max ? "text-danger font-semibold" : "text-neutral-400"}`}>{length}/{max}</span>;
}

function FieldEditor({ field, value, dflt, onChange }: { field: ContentField; value: FieldValueAny; dflt: FieldValueAny; onChange: (v: FieldValueAny) => void }) {
  const warnings = validateFieldValue(field, value);
  const changed = !isDefault(value, dflt);
  const head = (
    <div className="flex items-start justify-between gap-3 mb-1.5">
      <div>
        <label className="block text-sm font-medium text-neutral-800">
          {field.label}
          {field.readonly && <span className="ms-2 text-[11px] text-neutral-400">(לקריאה בלבד)</span>}
        </label>
        {field.help && <p className="text-xs text-neutral-500 mt-0.5">{field.help}</p>}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {typeof value === "string" && <Counter length={value.length} max={field.max} />}
        {changed && !field.readonly && (
          <button type="button" onClick={() => onChange(JSON.parse(JSON.stringify(dflt)))} className="text-[11px] text-pink-700 hover:underline whitespace-nowrap">
            שחזור ברירת מחדל
          </button>
        )}
      </div>
    </div>
  );
  const warn = warnings.length > 0 && (
    <ul className="mt-1 space-y-0.5">
      {warnings.map((w, i) => (
        <li key={i} className="text-[11px] text-amber-700">⚠ {w}</li>
      ))}
    </ul>
  );

  switch (field.type) {
    case "toggle":
      return (
        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 accent-pink-600" />
            <span className="text-sm font-medium text-neutral-800">{field.label}</span>
            {changed && (
              <button type="button" onClick={() => onChange(dflt)} className="text-[11px] text-pink-700 hover:underline">
                שחזור ברירת מחדל
              </button>
            )}
          </label>
          {field.help && <p className="text-xs text-neutral-500 mt-0.5 ms-7">{field.help}</p>}
        </div>
      );
    case "number":
      return (
        <div>
          {head}
          <input type="number" value={typeof value === "number" ? value : ""} onChange={(e) => onChange(Number(e.target.value))} className={`${inputCls} w-40`} dir="ltr" disabled={field.readonly} />
          {warn}
        </div>
      );
    case "select":
      return (
        <div>
          {head}
          <select value={String(value)} onChange={(e) => onChange(e.target.value)} className={`${inputCls} w-64`} disabled={field.readonly}>
            {field.options?.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {warn}
        </div>
      );
    case "textarea":
      return (
        <div>
          {head}
          <textarea value={String(value)} onChange={(e) => onChange(e.target.value)} rows={3} className={`${inputCls} resize-y`} disabled={field.readonly} />
          {warn}
        </div>
      );
    case "markdown":
      return (
        <div>
          {head}
          <textarea value={String(value)} onChange={(e) => onChange(e.target.value)} rows={16} className={`${inputCls} resize-y leading-relaxed`} disabled={field.readonly} />
          {warn}
        </div>
      );
    case "list":
      return (
        <div>
          {head}
          <ListEditor field={field} items={Array.isArray(value) ? value : []} onChange={onChange} />
          {warn}
        </div>
      );
    default:
      return (
        <div>
          {head}
          <input type="text" value={String(value)} onChange={(e) => onChange(e.target.value)} className={inputCls} dir={field.type === "url" ? "ltr" : undefined} disabled={field.readonly} />
          {warn}
        </div>
      );
  }
}

function ListEditor({ field, items, onChange }: { field: ContentField; items: ListItemRecord[]; onChange: (v: ListItemRecord[]) => void }) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const min = field.minItems ?? 0;
  const max = field.maxItems ?? 50;
  const subs = field.item || [];

  function update(i: number, key: string, v: string) {
    onChange(items.map((item, j) => (j === i ? { ...item, [key]: v } : item)));
  }
  function remove(i: number) {
    onChange(items.filter((_, j) => j !== i));
  }
  function add() {
    onChange([...items, Object.fromEntries(subs.map((s) => [s.key, ""]))]);
  }
  function move(from: number, to: number) {
    if (from === to || to < 0 || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  }

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div
          key={i}
          draggable
          onDragStart={() => setDragIndex(i)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (dragIndex !== null) move(dragIndex, i);
            setDragIndex(null);
          }}
          onDragEnd={() => setDragIndex(null)}
          className={`rounded-xl border bg-neutral-50/60 p-3 ${dragIndex === i ? "border-pink-300 opacity-70" : "border-border"}`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[11px] text-neutral-400 cursor-grab select-none" title="גרירה לסידור">⋮⋮ {String(i + 1).padStart(2, "0")}</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} className="px-1.5 py-0.5 rounded text-xs text-neutral-500 hover:bg-neutral-200 disabled:opacity-30" aria-label="up">↑</button>
              <button type="button" onClick={() => move(i, i + 1)} disabled={i === items.length - 1} className="px-1.5 py-0.5 rounded text-xs text-neutral-500 hover:bg-neutral-200 disabled:opacity-30" aria-label="down">↓</button>
              <button type="button" onClick={() => remove(i)} disabled={items.length <= min} className="px-1.5 py-0.5 rounded text-xs text-danger hover:bg-danger-soft disabled:opacity-30">
                הסרה
              </button>
            </div>
          </div>
          <div className={`grid gap-2 ${subs.length > 2 ? "sm:grid-cols-2" : ""}`}>
            {subs.map((s) => (
              <div key={s.key}>
                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-neutral-500">{s.label}</label>
                  <Counter length={String(item[s.key] ?? "").length} max={s.max} />
                </div>
                {s.type === "textarea" ? (
                  <textarea value={item[s.key] ?? ""} onChange={(e) => update(i, s.key, e.target.value)} rows={2} className={`${inputCls} resize-y mt-0.5`} />
                ) : (
                  <input
                    type="text"
                    value={item[s.key] ?? ""}
                    onChange={(e) => update(i, s.key, e.target.value)}
                    className={`${inputCls} mt-0.5 ${s.stable ? "font-mono" : ""}`}
                    dir={s.type === "url" || s.stable ? "ltr" : undefined}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="flex items-center gap-3">
        <button type="button" onClick={add} disabled={items.length >= max} className="text-sm font-medium text-pink-700 hover:underline disabled:opacity-40">
          + הוספת פריט
        </button>
        <span className="text-[11px] text-neutral-400">
          {min} עד {max} פריטים
        </span>
      </div>
    </div>
  );
}
