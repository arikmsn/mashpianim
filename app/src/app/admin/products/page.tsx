"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Badge, Button, Card, Input, Modal, Textarea, useToast } from "@/components/ui";
import { isAdminProductFilter, productStatusLabel, productTypeLabel, type AdminProductFilter } from "@/lib/admin-products";
import { connectionStatusLabel } from "@/lib/admin-connections";
import { PRODUCT_CATEGORIES } from "@/lib/categories";
import { formatDateTimeHe } from "@/lib/dates";

// The products on the site (owner, 2026-11-24): every product with its business, status, price and the hearts on
// it; a detail view with who hearted it and what came of it; an editor for the fields (a bad picture, a wrong
// price), pause / re-activate, and removal (closes the waiting hearts like the business's own delete).

type Row = {
  id: string;
  name: string;
  status: string;
  price: number;
  category: string | null;
  category_custom: string | null;
  product_type: string;
  image_url: string | null;
  max_creators: number | null;
  created_at: string;
  brand: { id: string; user_id: string | null; name: string; contact: string; phone: string; is_active: boolean; logo_url: string | null };
  connections: { waiting: number; matched: number; completed: number; closed: number };
};

type Payload = {
  products: Row[];
  total: number;
  page: number;
  per: number;
  counts: { active: number; paused: number; deleted: number; all: number } | null;
};

type Detail = {
  product: Record<string, unknown> & { brief_lines?: string[]; image_preview?: string | null };
  brand: { id: string; user_id: string | null; name: string; contact: string; phone: string; is_active: boolean; region: string | null; logo_url: string | null };
  connections: {
    id: string;
    status: string | null;
    initiated_by: string | null;
    mutual_at: string | null;
    created_at: string;
    approved_at: string | null;
    completed_at: string | null;
    rejection_reason: string | null;
    creator: { user_id: string | null; name: string; phone: string };
  }[];
};

type EditForm = {
  name: string;
  description: string;
  price: string;
  category: string;
  category_custom: string;
  product_type: string;
  image_url: string;
  max_creators: string;
  brief: string;
  status: string;
};

const PER = 50;
const FILTERS: { key: AdminProductFilter; label: string }[] = [
  { key: "active", label: "פעילים" },
  { key: "paused", label: "מושהים" },
  { key: "deleted", label: "הוסרו" },
  { key: "all", label: "הכל" },
];

function statusVariant(status: string | null | undefined): "success" | "warning" | "default" {
  return status === "active" ? "success" : status === "paused" ? "warning" : "default";
}

function str(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}

export default function AdminProductsPage() {
  return (
    <Suspense>
      <ProductsContent />
    </Suspense>
  );
}

function ProductsContent() {
  const searchParams = useSearchParams();
  const initial = searchParams.get("filter");
  const [filter, setFilter] = useState<AdminProductFilter>(isAdminProductFilter(initial) ? initial : "active");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [data, setData] = useState<Payload | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditForm | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const requestKey = `${filter}|${page}|${q}|${reloadTick}`;
  const loading = loadedKey !== requestKey;

  // The typed search applies after a short pause, from page 1
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const params = new URLSearchParams({ filter, page: String(page), per: String(PER) });
    if (q) params.set("q", q);
    const key = `${filter}|${page}|${q}|${reloadTick}`;
    let cancelled = false;
    fetch(`/api/admin/products?${params}`)
      .then((res) => (res.ok ? (res.json() as Promise<Payload>) : Promise.reject(new Error("API error"))))
      .then((payload) => {
        if (cancelled) return;
        setData(payload);
        setLoadedKey(key);
      })
      .catch(() => {
        if (cancelled) return;
        toast("שגיאה בטעינת המוצרים", "error");
        setLoadedKey(key);
      });
    return () => {
      cancelled = true;
    };
  }, [filter, page, q, reloadTick, toast]);

  const loadDetail = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/admin/products/${id}`);
        if (!res.ok) throw new Error("API error");
        const d = (await res.json()) as Detail;
        setDetail(d);
        const p = d.product;
        setForm({
          name: str(p.name),
          description: str(p.description),
          price: str(p.price),
          category: str(p.category) || "כללי",
          category_custom: str(p.category_custom),
          product_type: str(p.product_type) || "physical",
          image_url: str(p.image_url),
          max_creators: p.max_creators === null || p.max_creators === undefined ? "" : str(p.max_creators),
          brief: str(p.brief),
          status: str(p.status) || "active",
        });
      } catch {
        toast("שגיאה בטעינת המוצר", "error");
      }
    },
    [toast]
  );

  // Opening a product loads its detail; nothing runs from an effect
  function openDetail(id: string) {
    setSelectedId(id);
    setEditing(false);
    loadDetail(id);
  }

  function closeDetail() {
    setSelectedId(null);
    setDetail(null);
    setForm(null);
    setEditing(false);
  }

  const refresh = () => setReloadTick((t) => t + 1);

  async function patchProduct(id: string, body: Record<string, unknown>, okMessage: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/products/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "שגיאה בעדכון");
      toast(okMessage, "success");
      refresh();
      if (selectedId === id) await loadDetail(id);
      return true;
    } catch (err) {
      toast(err instanceof Error ? err.message : "שגיאה בעדכון", "error");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function removeProduct(row: { id: string; name: string; connections?: Row["connections"] }) {
    const waiting = row.connections?.waiting || 0;
    const ok = window.confirm(`להסיר את "${row.name}" מהאתר?${waiting ? ` ${waiting} לבבות שממתינים עליו ייסגרו והיוצרים יקבלו הודעה.` : ""}`);
    if (!ok) return;
    setBusy(row.id);
    try {
      const res = await fetch(`/api/admin/products/${row.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "שגיאה בהסרה");
      toast(`המוצר הוסר${json.hearts_closed ? `, ${json.hearts_closed} לבבות נסגרו` : ""}`, "success");
      refresh();
      if (selectedId === row.id) await loadDetail(row.id);
    } catch (err) {
      toast(err instanceof Error ? err.message : "שגיאה בהסרה", "error");
    } finally {
      setBusy(null);
    }
  }

  async function saveForm() {
    if (!selectedId || !form) return;
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      description: form.description.trim(),
      price: form.price,
      category: form.category,
      category_custom: form.category_custom.trim() || null,
      product_type: form.product_type,
      image_url: form.image_url.trim(),
      max_creators: form.max_creators.trim() === "" ? null : form.max_creators,
      brief: form.brief.trim(),
    };
    if (form.status === "active" || form.status === "paused") body.status = form.status;
    if (!body.name) {
      toast("שם המוצר הוא שדה חובה", "error");
      return;
    }
    const ok = await patchProduct(selectedId, body, "המוצר עודכן");
    if (ok) setEditing(false);
  }

  async function uploadImage(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/products/upload-image", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.url) throw new Error(json.error || "שגיאה בהעלאת התמונה");
      setForm((f) => (f ? { ...f, image_url: json.url as string } : f));
      toast("התמונה הועלתה, לא לשכוח לשמור", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "שגיאה בהעלאת התמונה", "error");
    } finally {
      setUploading(false);
    }
  }

  const rows = data?.products || [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.per)) : 1;
  const detailProduct = detail?.product;
  const detailStatus = str(detailProduct?.status);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold">מוצרים</h1>
          <p className="text-sm text-neutral-500">כל המוצרים שהעסקים העלו, מי אהב אותם, עריכה והסרה</p>
        </div>
        <Input placeholder="חיפוש לפי מוצר, עסק או טלפון..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-72" />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => {
              setFilter(f.key);
              setPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-full text-sm transition-colors ${filter === f.key ? "bg-surface-ink text-on-ink" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}
          >
            {f.label}
            {data?.counts ? <span className="ms-1.5 text-xs opacity-70">{data.counts[f.key]}</span> : null}
          </button>
        ))}
      </div>

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="border-b border-neutral-100">
                <th className="px-4 py-3 text-xs font-medium text-neutral-400">מוצר</th>
                <th className="px-4 py-3 text-xs font-medium text-neutral-400">עסק</th>
                <th className="px-4 py-3 text-xs font-medium text-neutral-400">שווי</th>
                <th className="px-4 py-3 text-xs font-medium text-neutral-400">סטטוס</th>
                <th className="px-4 py-3 text-xs font-medium text-neutral-400">לבבות ממתינים</th>
                <th className="px-4 py-3 text-xs font-medium text-neutral-400">מאטצ&apos;ים</th>
                <th className="px-4 py-3 text-xs font-medium text-neutral-400">נוצר</th>
                <th className="px-4 py-3 text-xs font-medium text-neutral-400">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-neutral-400">טוען...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-neutral-400">אין מוצרים בסינון הזה</td>
                </tr>
              ) : (
                rows.map((p) => (
                  <tr key={p.id} className="border-b border-neutral-50 hover:bg-pink-50/30 transition-colors">
                    <td className="px-4 py-3">
                      <button onClick={() => openDetail(p.id)} className="flex items-center gap-3 text-right">
                        <span className="w-11 h-11 rounded-lg bg-neutral-100 overflow-hidden shrink-0 flex items-center justify-center text-lg">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" loading="lazy" /> : p.product_type === "digital" ? "📱" : "📦"}
                        </span>
                        <span>
                          <span className="block text-sm font-medium">{p.name}</span>
                          <span className="block text-xs text-neutral-400">
                            {p.category_custom || p.category || "כללי"} · {productTypeLabel(p.product_type)}
                            {p.max_creators ? ` · עד ${p.max_creators} יוצרים` : ""}
                          </span>
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="block">{p.brand.name}</span>
                      <span className="block text-xs text-neutral-400" dir="ltr">{p.brand.phone}</span>
                      {!p.brand.is_active && <span className="text-[11px] text-amber-600">העסק מושבת</span>}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">{p.price} ₪</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(p.status)} size="sm" dot>
                        {productStatusLabel(p.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm">💗 {p.connections.waiting}</td>
                    <td className="px-4 py-3 text-sm">
                      🤝 {p.connections.matched}
                      {p.connections.completed > 0 && <span className="text-xs text-neutral-400"> ({p.connections.completed} הושלמו)</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-500 whitespace-nowrap">{formatDateTimeHe(p.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        <button onClick={() => openDetail(p.id)} className="px-2.5 py-1 rounded-lg text-xs bg-neutral-50 hover:bg-neutral-100 transition-colors">
                          פרטים
                        </button>
                        {p.status !== "deleted" && (
                          <button
                            onClick={() => patchProduct(p.id, { status: p.status === "active" ? "paused" : "active" }, p.status === "active" ? "המוצר הושהה" : "המוצר הופעל")}
                            disabled={busy === p.id}
                            className="px-2.5 py-1 rounded-lg text-xs bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
                          >
                            {p.status === "active" ? "השהיה" : "הפעלה"}
                          </button>
                        )}
                        {p.status === "deleted" ? (
                          <button onClick={() => patchProduct(p.id, { status: "active" }, "המוצר חזר לאתר")} disabled={busy === p.id} className="px-2.5 py-1 rounded-lg text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50">
                            החזרה לאתר
                          </button>
                        ) : (
                          <button onClick={() => removeProduct(p)} disabled={busy === p.id} className="px-2.5 py-1 rounded-lg text-xs bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50">
                            הסרה
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {data && data.total > PER && (
          <div className="flex items-center justify-between px-4 py-3 text-sm text-neutral-500 border-t border-neutral-100">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 rounded-lg bg-neutral-50 hover:bg-neutral-100 disabled:opacity-40">
              הקודם
            </button>
            <span>
              עמוד {page} מתוך {totalPages} · {data.total} מוצרים
            </span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1 rounded-lg bg-neutral-50 hover:bg-neutral-100 disabled:opacity-40">
              הבא
            </button>
          </div>
        )}
      </Card>

      <Modal open={!!selectedId} onClose={closeDetail} title={str(detailProduct?.name) || "פרטי מוצר"} size="lg">
        {!detail || !form ? (
          <p className="text-sm text-neutral-400 py-6 text-center">טוען...</p>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start gap-4">
              <div className="w-36 h-36 rounded-xl bg-neutral-100 overflow-hidden shrink-0 flex items-center justify-center text-3xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {detail.product.image_preview ? <img src={detail.product.image_preview} alt="" className="w-full h-full object-cover" /> : "📦"}
              </div>
              <div className="flex-1 min-w-[220px] text-sm space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariant(detailStatus)} size="sm" dot>
                    {productStatusLabel(detailStatus)}
                  </Badge>
                  <span className="text-neutral-400 text-xs">נוצר {formatDateTimeHe(str(detailProduct?.created_at))}</span>
                </div>
                <p>
                  <span className="text-neutral-400 text-xs block">עסק</span>
                  {detail.brand.name}
                  {detail.brand.contact ? ` · ${detail.brand.contact}` : ""} · <span dir="ltr">{detail.brand.phone}</span>
                  {detail.brand.region ? ` · ${detail.brand.region}` : ""}
                  {!detail.brand.is_active && <span className="text-amber-600"> · העסק מושבת</span>}
                </p>
                <p>
                  <span className="text-neutral-400 text-xs block">שווי · קטגוריה · סוג</span>
                  {str(detailProduct?.price)} ₪ · {str(detailProduct?.category_custom) || str(detailProduct?.category) || "כללי"} · {productTypeLabel(str(detailProduct?.product_type))}
                  {detailProduct?.max_creators ? ` · עד ${str(detailProduct.max_creators)} יוצרים` : " · ללא הגבלת יוצרים"}
                </p>
                {str(detailProduct?.description) && (
                  <p>
                    <span className="text-neutral-400 text-xs block">תיאור</span>
                    <span className="whitespace-pre-line">{str(detailProduct?.description)}</span>
                  </p>
                )}
                {detail.product.brief_lines && detail.product.brief_lines.length > 0 && (
                  <p>
                    <span className="text-neutral-400 text-xs block">בריף</span>
                    <span className="whitespace-pre-line text-xs">{detail.product.brief_lines.join("\n")}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {detailStatus !== "deleted" && (
                <Button size="sm" variant={editing ? "ghost" : "secondary"} onClick={() => setEditing((e) => !e)}>
                  {editing ? "ביטול העריכה" : "עריכת המוצר"}
                </Button>
              )}
              {detailStatus !== "deleted" && (
                <Button size="sm" variant="outline" disabled={busy === selectedId} onClick={() => selectedId && patchProduct(selectedId, { status: detailStatus === "active" ? "paused" : "active" }, detailStatus === "active" ? "המוצר הושהה" : "המוצר הופעל")}>
                  {detailStatus === "active" ? "השהיה" : "הפעלה"}
                </Button>
              )}
              {detailStatus === "deleted" ? (
                <Button size="sm" variant="outline" disabled={busy === selectedId} onClick={() => selectedId && patchProduct(selectedId, { status: "active" }, "המוצר חזר לאתר")}>
                  החזרה לאתר
                </Button>
              ) : (
                <Button size="sm" variant="danger" disabled={busy === selectedId} onClick={() => selectedId && removeProduct({ id: selectedId, name: str(detailProduct?.name), connections: { waiting: detail.connections.filter((c) => c.status === "pending").length, matched: 0, completed: 0, closed: 0 } })}>
                  הסרה מהאתר
                </Button>
              )}
            </div>

            {editing && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-neutral-50 rounded-xl p-4">
                <Input label="שם המוצר" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <Input label="שווי המוצר (₪)" type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                <label className="text-sm">
                  <span className="block text-xs text-neutral-500 mb-1">קטגוריה</span>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm">
                    {PRODUCT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <Input label="תווית קטגוריה מותאמת (לא חובה)" value={form.category_custom} onChange={(e) => setForm({ ...form, category_custom: e.target.value })} maxLength={40} />
                <label className="text-sm">
                  <span className="block text-xs text-neutral-500 mb-1">סוג המוצר</span>
                  <select value={form.product_type} onChange={(e) => setForm({ ...form, product_type: e.target.value })} className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm">
                    <option value="physical">פיזי (נשלח ליוצר/ת)</option>
                    <option value="digital">דיגיטלי</option>
                  </select>
                </label>
                <Input label="מספר יוצרים מקסימלי (ריק = ללא הגבלה)" type="number" min={1} max={50} value={form.max_creators} onChange={(e) => setForm({ ...form, max_creators: e.target.value })} />
                <label className="text-sm">
                  <span className="block text-xs text-neutral-500 mb-1">סטטוס</span>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm">
                    <option value="active">פעיל</option>
                    <option value="paused">מושהה</option>
                  </select>
                </label>
                <div className="sm:col-span-2">
                  <Input label="כתובת התמונה" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} dir="ltr" />
                  <label className="inline-flex items-center gap-2 mt-2 text-xs text-neutral-600 cursor-pointer">
                    <span className="px-3 py-1.5 rounded-lg bg-white border border-border hover:border-ink-900">{uploading ? "מעלה..." : "העלאת תמונה חדשה"}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadImage(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
                <div className="sm:col-span-2">
                  <Textarea label="תיאור" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <Textarea label="בריף, עוד משהו (טקסט חופשי)" rows={3} value={form.brief} onChange={(e) => setForm({ ...form, brief: e.target.value })} />
                </div>
                <div className="sm:col-span-2 flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>ביטול</Button>
                  <Button size="sm" disabled={busy === selectedId} onClick={saveForm}>שמירה</Button>
                </div>
              </div>
            )}

            <div className="bg-neutral-50 rounded-xl p-3">
              <p className="text-xs font-bold text-neutral-700 mb-2">💗 מי אהב ומה יצא מזה ({detail.connections.length})</p>
              {detail.connections.length === 0 ? (
                <p className="text-xs text-neutral-400">עדיין אין לבבות על המוצר הזה</p>
              ) : (
                <ul className="text-xs text-neutral-700 space-y-1 max-h-64 overflow-y-auto">
                  {detail.connections.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2">
                      <span className="truncate">
                        {c.creator.user_id ? (
                          <Link href={`/admin/creators/${c.creator.user_id}`} className="underline decoration-dotted">{c.creator.name}</Link>
                        ) : (
                          c.creator.name
                        )}
                        <span className="text-neutral-400"> · {formatDateTimeHe(c.created_at)}</span>
                      </span>
                      <span className="text-neutral-500 shrink-0">
                        {connectionStatusLabel(c.status, c.initiated_by, c.mutual_at)}
                        {c.rejection_reason === "product_removed" ? " (המוצר הוסר)" : c.rejection_reason === "expired" ? " (פג)" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
