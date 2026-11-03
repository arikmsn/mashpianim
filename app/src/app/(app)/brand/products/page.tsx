"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, Badge, Button, Modal, Input, Textarea, useToast } from "@/components/ui";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string | null;
  status: "active" | "paused";
  brief: string;
  shippingPolicy: string;
  sourceUrl: string | null;
  applicantsCount: number;
  maxCreators: number;
  createdAt: string;
  productType: "physical" | "digital";
  digitalAccessType: string | null;
  digitalAccessInstructions: string | null;
  digitalAccessDurationDays: number | null;
  expirationDate: string | null;
  quantity: number | null;
}

const shippingLabels: Record<string, string> = {
  free: "משלוח חינם",
  pickup: "איסוף עצמי",
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

export default function BrandProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    brief: "",
    imageUrl: "",
    shippingPolicy: "free",
    sourceUrl: "",
    productType: "physical" as "physical" | "digital",
    digitalAccessType: "",
    digitalAccessInstructions: "",
    digitalAccessDurationDays: "",
    expirationDate: "",
    quantity: "",
    maxCreators: "3",
  });
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
          setProducts(
            data.products.map((p: Record<string, unknown>) => ({
              id: p.id as string,
              name: p.name as string,
              description: (p.description as string) || "",
              price: Number(p.price) || 0,
              imageUrl: (p.image_url as string) || null,
              status: (p.status as string) || "active",
              brief: (p.brief as string) || "",
              shippingPolicy: (p.shipping_policy as string) || "free",
              sourceUrl: (p.source_url as string) || null,
              applicantsCount: (p.matched_count as number) || 0,
              maxCreators: (p.max_creators as number) || 3,
              createdAt: (p.created_at as string) || "",
              productType: (p.product_type as string) || "physical",
              digitalAccessType: (p.digital_access_type as string) || null,
              digitalAccessInstructions: (p.digital_access_instructions as string) || null,
              digitalAccessDurationDays: (p.digital_access_duration_days as number) || null,
              expirationDate: (p.expiration_date as string) || null,
              quantity: (p.quantity as number) || null,
            }))
          );
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
    setFormData({ name: "", description: "", price: "", brief: "", imageUrl: "", shippingPolicy: "free", sourceUrl: "", productType: "physical", digitalAccessType: "", digitalAccessInstructions: "", digitalAccessDurationDays: "", expirationDate: "", quantity: "", maxCreators: "3" });
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
      imageUrl: product.imageUrl || "",
      shippingPolicy: product.shippingPolicy,
      sourceUrl: product.sourceUrl || "",
      productType: product.productType || "physical",
      digitalAccessType: product.digitalAccessType || "",
      digitalAccessInstructions: product.digitalAccessInstructions || "",
      digitalAccessDurationDays: product.digitalAccessDurationDays ? String(product.digitalAccessDurationDays) : "",
      expirationDate: product.expirationDate || "",
      quantity: product.quantity ? String(product.quantity) : "",
      maxCreators: String(product.maxCreators || 3),
    });
    setImageFile(null);
    setEditingProduct(product);
    setShowAddModal(true);
  }

  async function handleSubmit() {
    if (!formData.name.trim() || !formData.price) {
      toast("שם ומחיר חובה", "error");
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

      const body: Record<string, unknown> = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        price: Number(formData.price),
        brief: formData.brief.trim() || null,
        image_url: imageUrl,
        shipping_policy: formData.shippingPolicy,
        source_url: formData.sourceUrl.trim() || null,
        product_type: formData.productType,
        digital_access_type: formData.productType === "digital" ? formData.digitalAccessType || null : null,
        digital_access_instructions: formData.productType === "digital" ? formData.digitalAccessInstructions.trim() || null : null,
        digital_access_duration_days: formData.productType === "digital" && formData.digitalAccessDurationDays ? Number(formData.digitalAccessDurationDays) : null,
        expiration_date: formData.expirationDate || null,
        quantity: formData.quantity ? Number(formData.quantity) : null,
        max_creators: Math.min(50, Math.max(1, Number(formData.maxCreators) || 3)),
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
                    imageUrl: (body.image_url as string) || null,
                    shippingPolicy: body.shipping_policy as string,
                    sourceUrl: (body.source_url as string) || null,
                    productType: (body.product_type as "physical" | "digital") || "physical",
                    digitalAccessType: (body.digital_access_type as string) || null,
                    digitalAccessInstructions: (body.digital_access_instructions as string) || null,
                    digitalAccessDurationDays: (body.digital_access_duration_days as number) || null,
                    expirationDate: (body.expiration_date as string) || null,
                    quantity: (body.quantity as number) || null,
                    maxCreators: (body.max_creators as number) || 3,
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
          toast("המוצר נוסף בהצלחה!", "success");
          setProducts((prev) => [
            {
              id: data.product?.id || `local-${Date.now()}`,
              name: body.name as string,
              description: body.description as string,
              price: body.price as number,
              imageUrl: body.image_url as string | null,
              status: "active",
              brief: (body.brief as string) || "",
              shippingPolicy: body.shipping_policy as string,
              sourceUrl: body.source_url as string | null,
              applicantsCount: 0,
              maxCreators: (body.max_creators as number) || 3,
              createdAt: new Date().toISOString(),
              productType: (body.product_type as "physical" | "digital") || "physical",
              digitalAccessType: (body.digital_access_type as string) || null,
              digitalAccessInstructions: (body.digital_access_instructions as string) || null,
              digitalAccessDurationDays: (body.digital_access_duration_days as number) || null,
              expirationDate: (body.expiration_date as string) || null,
              quantity: (body.quantity as number) || null,
            },
            ...prev,
          ]);
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
        toast(newStatus === "active" ? "המוצר הופעל" : "המוצר הושהה", "success");
      }
    } catch {
      toast("שגיאה בעדכון", "error");
    }
  }

  async function deleteProduct(product: Product) {
    try {
      const res = await fetch(`/api/products/${product.id}`, { method: "DELETE" });
      if (res.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== product.id));
        toast("המוצר נמחק", "success");
      }
    } catch {
      toast("שגיאה במחיקה", "error");
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
                          <div className="flex items-center gap-3 text-xs text-neutral-400 mb-2">
                            <span>₪{product.price}</span>
                            <span>👥 {product.applicantsCount}/{product.maxCreators} יוצרים</span>
                            <span>{product.productType === "digital" ? "📱 דיגיטלי" : shippingLabels[product.shippingPolicy] || product.shippingPolicy}</span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => openEditModal(product)}
                              className="text-xs text-pink-500 font-medium"
                            >
                              עריכה
                            </button>
                            <button
                              onClick={() => toggleStatus(product)}
                              className="text-xs text-neutral-500 font-medium"
                            >
                              {product.status === "active" ? "השהיה" : "הפעלה"}
                            </button>
                            <button
                              onClick={() => deleteProduct(product)}
                              className="text-xs text-red-500 font-medium"
                            >
                              מחיקה
                            </button>
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
            <label className="block text-sm font-medium text-neutral-700 mb-1">בריף ליוצר/ת (אופציונלי)</label>
            <Textarea
              placeholder="מה חובה להגיד, למי המוצר מתאים, מה לא להראות... נשלח ליוצר/ת בצ'אט ברגע שנפתח מאטץ'"
              value={formData.brief}
              onChange={(e) => setFormData((p) => ({ ...p, brief: e.target.value }))}
            />
            <p className="text-xs text-neutral-400 mt-1">בלי בריף נשלחת תבנית למילוי בצ&apos;אט.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">מחיר (₪) *</label>
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
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                setImageFile(f);
                if (f) setFormData((p) => ({ ...p, imageUrl: "" }));
              }}
              className="w-full text-sm text-neutral-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-pink-50 file:text-pink-500 hover:file:bg-pink-100 transition-all"
            />
            {imageFile && (
              <p className="text-xs text-neutral-400 mt-1">{imageFile.name} ({(imageFile.size / 1024 / 1024).toFixed(1)} MB)</p>
            )}
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">תאריך תפוגה</label>
              <Input
                type="date"
                value={formData.expirationDate}
                onChange={(e) => setFormData((p) => ({ ...p, expirationDate: e.target.value }))}
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">כמות במלאי</label>
              <Input
                type="number"
                placeholder="ללא הגבלה"
                value={formData.quantity}
                onChange={(e) => setFormData((p) => ({ ...p, quantity: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">מספר יוצרים למוצר</label>
            <Input
              type="number"
              min={1}
              max={50}
              value={formData.maxCreators}
              onChange={(e) => setFormData((p) => ({ ...p, maxCreators: e.target.value }))}
            />
            <p className="text-xs text-neutral-400 mt-1">כמה סרטונים (יוצרים) תרצו למוצר הזה. כל מאטץ&apos; תופס מקום אחד וקרדיט אחד; כשהמקומות נגמרים המוצר יורד מהפיד.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">קישור למוצר (אופציונלי)</label>
            <Input
              type="url"
              placeholder="https://your-store.com/product"
              value={formData.sourceUrl}
              onChange={(e) => setFormData((p) => ({ ...p, sourceUrl: e.target.value }))}
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
