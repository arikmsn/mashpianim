"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Card, Badge, Button, Modal, Input, Textarea, FilePicker, useToast } from "@/components/ui";
import { PRODUCT_CATEGORIES, CUSTOM_CATEGORY_MAX, displayCategory } from "@/lib/categories";
import { BRIEF_SECTIONS, hasBriefContent, type BriefData } from "@/lib/brief";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string | null;
  status: "active" | "paused";
  category: string;
  categoryCustom: string | null;
  brief: string;
  briefData: BriefData | null;
  shippingPolicy: string;
  applicantsCount: number;
  createdAt: string;
  productType: "physical" | "digital";
  digitalAccessType: string | null;
  digitalAccessInstructions: string | null;
  digitalAccessDurationDays: number | null;
}

const shippingLabels: Record<string, string> = {
  free: "משלוח חינם",
  pickup: "איסוף עצמי",
};

const OTHER = "אחר";
// The product form asks only for the general brief direction; the full brief has its own screen
const briefTypes = BRIEF_SECTIONS[0];

const emptyForm = {
  name: "",
  description: "",
  price: "",
  brief: "",
  briefTypes: [] as string[],
  imageUrl: "",
  shippingPolicy: "free",
  category: "",
  categoryCustom: "",
  productType: "physical" as "physical" | "digital",
  digitalAccessType: "",
  digitalAccessInstructions: "",
  digitalAccessDurationDays: "",
};

function ProductsSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-2xl p-4 border border-neutral-100">
          <div className="flex gap-3">
            <div className="w-20 h-20 bg-pink-100 rounded-xl animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-neutral-200 rounded-lg w-3/4 animate-pulse" />
              <div className="h-3 bg-neutral-100 rounded-lg w-1/2 animate-pulse" />
              <div className="h-3 bg-neutral-100 rounded-lg w-1/3 animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function mapProduct(p: Record<string, unknown>): Product {
  return {
    id: p.id as string,
    name: p.name as string,
    description: (p.description as string) || "",
    price: Number(p.price) || 0,
    imageUrl: (p.image_url as string) || null,
    status: ((p.status as string) || "active") as "active" | "paused",
    brief: (p.brief as string) || "",
    briefData: (p.brief_data as BriefData) || null,
    shippingPolicy: (p.shipping_policy as string) || "free",
    category: (p.category as string) || "",
    categoryCustom: (p.category_custom as string) || null,
    applicantsCount: (p.matched_count as number) || 0,
    createdAt: (p.created_at as string) || "",
    productType: ((p.product_type as string) || "physical") as "physical" | "digital",
    digitalAccessType: (p.digital_access_type as string) || null,
    digitalAccessInstructions: (p.digital_access_instructions as string) || null,
    digitalAccessDurationDays: (p.digital_access_duration_days as number) || null,
  };
}

export default function BrandProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  // Product awaiting the "really delete?" confirmation
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  // After a new product is saved: offer the full brief screen
  const [briefPromptFor, setBriefPromptFor] = useState<Product | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({ ...emptyForm });
  const [imageFile, setImageFile] = useState<File | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    try {
      const res = await fetch("/api/products?brand=me");
      if (res.ok) {
        const data = await res.json();
        if (data.products && data.products.length > 0) {
          setProducts(data.products.map((p: Record<string, unknown>) => mapProduct(p)));
          setLoading(false);
          return;
        }
      }
    } catch {
      // API unavailable
    }
    setProducts([]);
    setLoading(false);
  }

  function resetForm() {
    setFormData({ ...emptyForm, briefTypes: [] });
    setImageFile(null);
    setEditingProduct(null);
  }

  function openAddModal() {
    resetForm();
    setShowAddModal(true);
  }

  function openEditModal(product: Product) {
    setFormData({
      name: product.name,
      description: product.description,
      price: String(product.price),
      brief: product.brief || "",
      briefTypes: Array.isArray(product.briefData?.see) ? product.briefData.see : [],
      imageUrl: product.imageUrl || "",
      shippingPolicy: product.shippingPolicy,
      category: product.categoryCustom ? OTHER : product.category || "",
      categoryCustom: product.categoryCustom || "",
      productType: product.productType || "physical",
      digitalAccessType: product.digitalAccessType || "",
      digitalAccessInstructions: product.digitalAccessInstructions || "",
      digitalAccessDurationDays: product.digitalAccessDurationDays ? String(product.digitalAccessDurationDays) : "",
    });
    setImageFile(null);
    setEditingProduct(product);
    setShowAddModal(true);
  }

  async function handleSubmit() {
    if (!formData.name.trim() || !formData.price) {
      toast("שם ושווי מוצר חובה", "error");
      return;
    }
    if (formData.category === OTHER && !formData.categoryCustom.trim()) {
      toast("כתבו את הקטגוריה האחרת או בחרו מהרשימה", "error");
      return;
    }

    setSaving(true);
    try {
      let imageUrl = formData.imageUrl.trim() || null;

      // Upload image file if selected
      if (imageFile) {
        const imgFormData = new FormData();
        imgFormData.append("image", imageFile);
        const uploadRes = await fetch("/api/products/upload-image", { method: "POST", body: imgFormData });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          imageUrl = uploadData.url;
        } else {
          toast("שגיאה בהעלאת התמונה", "error");
          setSaving(false);
          return;
        }
      }

      const isOther = formData.category === OTHER;
      // Only "מה רואים" is edited here; the other brief sections live on the brief screen and are kept
      const existingData: BriefData = editingProduct?.briefData ? { ...editingProduct.briefData } : {};
      const briefData: BriefData = { ...existingData, see: formData.briefTypes };
      if (formData.briefTypes.length === 0) delete briefData.see;
      const body: Record<string, unknown> = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        price: Number(formData.price),
        brief: formData.brief.trim() || null,
        brief_data: Object.keys(briefData).length > 0 ? briefData : null,
        image_url: imageUrl,
        shipping_policy: formData.shippingPolicy,
        // "אחר" = the general feed bucket plus the brand's own label; empty = the server picks the brand's category
        ...(isOther ? { category: "כללי", category_custom: formData.categoryCustom.trim() } : formData.category ? { category: formData.category, category_custom: null } : { category_custom: null }),
        product_type: formData.productType,
        digital_access_type: formData.productType === "digital" ? formData.digitalAccessType || null : null,
        digital_access_instructions: formData.productType === "digital" ? formData.digitalAccessInstructions.trim() || null : null,
        digital_access_duration_days: formData.productType === "digital" && formData.digitalAccessDurationDays ? Number(formData.digitalAccessDurationDays) : null,
      };

      if (editingProduct) {
        const res = await fetch(`/api/products/${editingProduct.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          toast("המוצר עודכן בהצלחה", "success");
          setProducts((prev) =>
            prev.map((p) =>
              p.id === editingProduct.id
                ? {
                    ...p,
                    name: body.name as string,
                    description: body.description as string,
                    price: body.price as number,
                    brief: (body.brief as string) || "",
                    briefData: (body.brief_data as BriefData) || null,
                    imageUrl: (body.image_url as string) || null,
                    shippingPolicy: body.shipping_policy as string,
                    category: (body.category as string) || p.category,
                    categoryCustom: (body.category_custom as string) || null,
                    productType: (body.product_type as "physical" | "digital") || "physical",
                    digitalAccessType: (body.digital_access_type as string) || null,
                    digitalAccessInstructions: (body.digital_access_instructions as string) || null,
                    digitalAccessDurationDays: (body.digital_access_duration_days as number) || null,
                  }
                : p
            )
          );
        } else {
          toast("שגיאה בעדכון המוצר", "error");
        }
      } else {
        const res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const data = await res.json();
          const created: Product = {
            id: data.product?.id || `local-${Date.now()}`,
            name: body.name as string,
            description: body.description as string,
            price: body.price as number,
            imageUrl: body.image_url as string | null,
            status: "active",
            brief: (body.brief as string) || "",
            briefData: (body.brief_data as BriefData) || null,
            shippingPolicy: body.shipping_policy as string,
            category: (data.product?.category as string) || (body.category as string) || "",
            categoryCustom: (data.product?.category_custom as string) || (body.category_custom as string) || null,
            applicantsCount: 0,
            createdAt: new Date().toISOString(),
            productType: (body.product_type as "physical" | "digital") || "physical",
            digitalAccessType: (body.digital_access_type as string) || null,
            digitalAccessInstructions: (body.digital_access_instructions as string) || null,
            digitalAccessDurationDays: (body.digital_access_duration_days as number) || null,
          };
          toast("המוצר נוסף בהצלחה!", "success");
          setProducts((prev) => [created, ...prev]);
          if (data.product?.id) setBriefPromptFor(created);
        } else {
          const errData = await res.json().catch(() => ({}));
          toast((errData as any).error || "שגיאה בהוספת המוצר", "error");
        }
      }
    } catch {
      toast("שגיאה בשמירה", "error");
    } finally {
      setSaving(false);
      setShowAddModal(false);
      resetForm();
    }
  }

  async function toggleStatus(product: Product) {
    const newStatus = product.status === "active" ? "paused" : "active";
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setProducts((prev) =>
          prev.map((p) => (p.id === product.id ? { ...p, status: newStatus } : p))
        );
        toast(newStatus === "active" ? "המוצר הופעל — מופיע שוב ליוצרים" : "המוצר הושהה — לא מוצג ליוצרים עד להפעלה", "success");
      } else {
        const data = await res.json().catch(() => ({}));
        toast((data as any).error || "שגיאה בעדכון הסטטוס", "error");
      }
    } catch {
      toast("שגיאה בעדכון הסטטוס", "error");
    }
  }

  async function deleteProduct(product: Product) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/products/${product.id}`, { method: "DELETE" });
      if (res.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== product.id));
        toast("המוצר נמחק", "success");
        setDeleteTarget(null);
      } else {
        const data = await res.json().catch(() => ({}));
        toast((data as any).error || "שגיאה במחיקה", "error");
      }
    } catch {
      toast("שגיאה במחיקה", "error");
    } finally {
      setDeleting(false);
    }
  }

  const placeholderColors = [
    "from-pink-200 to-rose-300",
    "from-purple-200 to-indigo-300",
    "from-amber-200 to-orange-300",
    "from-emerald-200 to-teal-300",
    "from-blue-200 to-cyan-300",
  ];

  return (
    <main className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-neutral-100">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">המוצרים שלי</h1>
          <Button size="sm" onClick={openAddModal}>
            + הוספת מוצר
          </Button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4">
        {loading ? (
          <ProductsSkeleton />
        ) : products.length === 0 ? (
          <div className="text-center py-16 text-neutral-400">
            <span className="text-5xl block mb-4">📦</span>
            <p className="text-lg font-medium mb-2">אין מוצרים עדיין</p>
            <p className="text-sm mb-6">הוסיפו את המוצר הראשון שלכם ויוצרי תוכן ישלחו בקשות</p>
            <Button onClick={openAddModal}>+ הוספת מוצר ראשון</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {products.map((product, i) => {
                const colorIdx = i % placeholderColors.length;
                const hasBrief = hasBriefContent(product.briefData, product.brief);
                return (
                  <motion.div
                    key={product.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card padding="none" className="overflow-hidden">
                      <div className="flex">
                        {product.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-24 h-24 object-cover"
                          />
                        ) : (
                          <div className={`w-24 h-24 bg-gradient-to-br ${placeholderColors[colorIdx]} flex items-center justify-center shrink-0`}>
                            <span className="text-3xl opacity-50">📦</span>
                          </div>
                        )}
                        <div className="flex-1 p-3 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h3 className="font-bold text-sm truncate">{product.name}</h3>
                            <Badge
                              variant={product.status === "active" ? "success" : "default"}
                              size="sm"
                            >
                              {product.status === "active" ? "פעיל" : "מושהה"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-neutral-400 mb-2 flex-wrap">
                            <span>שווי ₪{product.price}</span>
                            {product.applicantsCount > 0 && <span>🎬 {product.applicantsCount} {product.applicantsCount === 1 ? "חיבור" : "חיבורים"}</span>}
                            <span>{product.productType === "digital" ? "📱 דיגיטלי" : shippingLabels[product.shippingPolicy] || product.shippingPolicy}</span>
                            {displayCategory(product.category, product.categoryCustom) && <span>🏷️ {displayCategory(product.category, product.categoryCustom)}</span>}
                          </div>
                          {/* Everyday actions on the right; pause / delete far left so a thumb never hits them by accident */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex gap-3">
                              <button
                                onClick={() => openEditModal(product)}
                                className="text-xs text-pink-500 font-medium"
                              >
                                עריכה
                              </button>
                              <button
                                onClick={() => router.push(`/brand/products/${product.id}/brief`)}
                                className={`text-xs font-medium ${hasBrief ? "text-pink-500" : "text-amber-600"}`}
                              >
                                {hasBrief ? "בריף" : "בריף ✎ חסר"}
                              </button>
                            </div>
                            <div className="flex gap-2.5">
                              <button
                                onClick={() => toggleStatus(product)}
                                className="text-[11px] text-neutral-400 hover:text-neutral-600 font-medium"
                              >
                                {product.status === "active" ? "השהיה" : "הפעלה"}
                              </button>
                              <button
                                onClick={() => setDeleteTarget(product)}
                                className="text-[11px] text-neutral-400 hover:text-red-500 font-medium"
                              >
                                מחיקה
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      <Modal open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)} size="sm">
        <div className="text-center space-y-4">
          <span className="text-4xl block">🗑️</span>
          <div>
            <h3 className="text-lg font-bold">למחוק את &quot;{deleteTarget?.name}&quot;?</h3>
            <p className="text-sm text-neutral-500 mt-1">
              המוצר יוסר מהפיד ולא יופיע יותר ליוצרים. חיבורים שכבר נפתחו עליו ממשיכים כרגיל.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="danger" fullWidth loading={deleting} onClick={() => deleteTarget && deleteProduct(deleteTarget)}>
              כן, למחוק
            </Button>
            <Button variant="ghost" fullWidth disabled={deleting} onClick={() => setDeleteTarget(null)}>
              ביטול
            </Button>
          </div>
        </div>
      </Modal>

      {/* A new product is saved — the detailed brief has its own screen */}
      <Modal open={!!briefPromptFor} onClose={() => setBriefPromptFor(null)} size="sm">
        <div className="text-center space-y-4">
          <span className="text-4xl block">📝</span>
          <div>
            <h3 className="text-lg font-bold">המוצר נשמר. רוצים למלא בריף מפורט?</h3>
            <p className="text-sm text-neutral-500 mt-1">
              אורך, סגנון, מה חייב להופיע, מה לא — היוצרים רואים את זה לפני שהם שולחים לב, וזה מעלה את איכות הסרטונים.
            </p>
          </div>
          <div className="flex gap-3">
            <Button fullWidth onClick={() => { const p = briefPromptFor; setBriefPromptFor(null); if (p) router.push(`/brand/products/${p.id}/brief`); }}>
              לבריף המפורט
            </Button>
            <Button variant="ghost" fullWidth onClick={() => setBriefPromptFor(null)}>
              אחר כך
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={showAddModal}
        onClose={() => { setShowAddModal(false); resetForm(); }}
        title={editingProduct ? "עריכת מוצר" : "הוספת מוצר חדש"}
        size="lg"
      >
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">שם המוצר *</label>
            <Input
              placeholder="למשל: סרום ויטמין C"
              value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">תיאור</label>
            <Textarea
              placeholder="תארו את המוצר..."
              value={formData.description}
              onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">שווי מוצר (₪) *</label>
            <Input
              type="number"
              placeholder="0"
              value={formData.price}
              onChange={(e) => setFormData((p) => ({ ...p, price: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">סוג מוצר</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormData((p) => ({ ...p, productType: "physical" }))}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                  formData.productType === "physical"
                    ? "bg-pink-50 border-pink-300 text-pink-600"
                    : "bg-neutral-50 border-neutral-200 text-neutral-500"
                }`}
              >
                📦 פיזי
              </button>
              <button
                type="button"
                onClick={() => setFormData((p) => ({ ...p, productType: "digital" }))}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                  formData.productType === "digital"
                    ? "bg-pink-50 border-pink-300 text-pink-600"
                    : "bg-neutral-50 border-neutral-200 text-neutral-500"
                }`}
              >
                📱 דיגיטלי
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">קטגוריה</label>
            <div className="flex flex-wrap gap-2">
              {[...PRODUCT_CATEGORIES, OTHER].map((cat) => {
                const active = formData.category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFormData((p) => ({ ...p, category: active ? "" : cat }))}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      active
                        ? "bg-pink-50 border-pink-300 text-pink-600"
                        : "bg-neutral-50 border-neutral-200 text-neutral-500"
                    }`}
                  >
                    {cat === OTHER ? "✎ אחר" : cat}
                  </button>
                );
              })}
            </div>
            {formData.category === OTHER ? (
              <Input
                className="mt-2"
                placeholder="כתבו קטגוריה משלכם (למשל: מוצרי טבע)"
                value={formData.categoryCustom}
                maxLength={CUSTOM_CATEGORY_MAX}
                onChange={(e) => setFormData((p) => ({ ...p, categoryCustom: e.target.value }))}
              />
            ) : (
              <p className="text-xs text-neutral-400 mt-1">
                {formData.category ? "הקטגוריה שבה המוצר יופיע בפיד היוצרים" : "לא נבחר — המוצר יוצג תחת הקטגוריה של העסק"}
              </p>
            )}
          </div>

          {formData.productType === "physical" ? (
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">מדיניות משלוח</label>
              <select
                value={formData.shippingPolicy}
                onChange={(e) => setFormData((p) => ({ ...p, shippingPolicy: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-sm outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-500/10"
              >
                <option value="free">משלוח חינם</option>
                <option value="pickup">איסוף עצמי</option>
              </select>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">סוג גישה דיגיטלית *</label>
                <select
                  value={formData.digitalAccessType}
                  onChange={(e) => setFormData((p) => ({ ...p, digitalAccessType: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-sm outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-500/10"
                >
                  <option value="">בחרו סוג...</option>
                  <option value="link">קישור (לקורס, פלטפורמה)</option>
                  <option value="code">קוד גישה / קופון</option>
                  <option value="invite">הזמנה (אימייל/טלפון)</option>
                  <option value="file">קובץ (ebook, מדריך)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">הוראות גישה</label>
                <Textarea
                  placeholder="הסבירו ליוצר איך להשתמש במוצר הדיגיטלי..."
                  value={formData.digitalAccessInstructions}
                  onChange={(e) => setFormData((p) => ({ ...p, digitalAccessInstructions: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">תקופת גישה (ימים, אופציונלי)</label>
                <Input
                  type="number"
                  placeholder="למשל: 30"
                  value={formData.digitalAccessDurationDays}
                  onChange={(e) => setFormData((p) => ({ ...p, digitalAccessDurationDays: e.target.value }))}
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">תמונת מוצר</label>
            <FilePicker
              accept="image/*"
              file={imageFile}
              label="בחירת תמונה"
              changeLabel="החלפת תמונה"
              onChange={(f) => {
                setImageFile(f);
                if (f) setFormData((p) => ({ ...p, imageUrl: "" }));
              }}
            />
            {!imageFile && (
              <div className="mt-2">
                <p className="text-xs text-neutral-400 mb-1">או הדביקו קישור לתמונה:</p>
                <Input
                  type="url"
                  placeholder="https://..."
                  value={formData.imageUrl}
                  onChange={(e) => setFormData((p) => ({ ...p, imageUrl: e.target.value }))}
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">{briefTypes.title} <span className="text-neutral-400 font-normal">(כיוון כללי לבריף)</span></label>
            <div className="flex flex-wrap gap-2">
              {briefTypes.options.map((option) => {
                const active = formData.briefTypes.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      setFormData((p) => ({
                        ...p,
                        briefTypes: active ? p.briefTypes.filter((o) => o !== option) : [...p.briefTypes, option],
                      }))
                    }
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      active ? "bg-pink-500 border-pink-500 text-white" : "bg-neutral-50 border-neutral-200 text-neutral-500"
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              {editingProduct ? (
                <>
                  בריף מפורט (אורך, סגנון, מה חייב להופיע) —{" "}
                  <button type="button" className="text-pink-500 font-medium" onClick={() => { setShowAddModal(false); router.push(`/brand/products/${editingProduct.id}/brief`); }}>
                    לעריכה במסך הבריף ›
                  </button>
                </>
              ) : (
                "אחרי השמירה אפשר למלא בריף מפורט במסך נפרד."
              )}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">הערות קצרות ליוצר/ת (אופציונלי)</label>
            <Textarea
              placeholder="דגש אחד או שניים — למשל: להראות את הסוגר המגנטי"
              value={formData.brief}
              rows={2}
              onChange={(e) => setFormData((p) => ({ ...p, brief: e.target.value }))}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button fullWidth loading={saving} onClick={handleSubmit}>
              {editingProduct ? "עדכון מוצר" : "הוספת מוצר"}
            </Button>
            <Button variant="ghost" fullWidth onClick={() => { setShowAddModal(false); resetForm(); }}>
              ביטול
            </Button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
