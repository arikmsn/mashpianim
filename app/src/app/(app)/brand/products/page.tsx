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
  category: string;
  shippingPolicy: string;
  sourceUrl: string | null;
  applicantsCount: number;
  createdAt: string;
}

const categories = ["ביוטי", "אופנה", "טכנולוגיה", "בית וגינה", "אוכל", "ספורט", "ילדים", "אחר"];

const shippingLabels: Record<string, string> = {
  free: "משלוח חינם",
  paid: "משלוח בתשלום",
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
    category: "ביוטי",
    imageUrl: "",
    shippingPolicy: "free",
    sourceUrl: "",
  });

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
              category: (p.category as string) || "",
              shippingPolicy: (p.shipping_policy as string) || "free",
              sourceUrl: (p.source_url as string) || null,
              applicantsCount: (p.applicants_count as number) || 0,
              createdAt: (p.created_at as string) || "",
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
    setFormData({ name: "", description: "", price: "", category: "ביוטי", imageUrl: "", shippingPolicy: "free", sourceUrl: "" });
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
      category: product.category,
      imageUrl: product.imageUrl || "",
      shippingPolicy: product.shippingPolicy,
      sourceUrl: product.sourceUrl || "",
    });
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
      const body = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        price: Number(formData.price),
        category: formData.category,
        image_url: formData.imageUrl.trim() || null,
        shipping_policy: formData.shippingPolicy,
        source_url: formData.sourceUrl.trim() || null,
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
                ? { ...p, ...body, imageUrl: body.image_url, shippingPolicy: body.shipping_policy, sourceUrl: body.source_url }
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
              name: body.name,
              description: body.description,
              price: body.price,
              imageUrl: body.image_url,
              status: "active",
              category: body.category,
              shippingPolicy: body.shipping_policy,
              sourceUrl: body.source_url,
              applicantsCount: 0,
              createdAt: new Date().toISOString(),
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
    <main className="min-h-screen bg-background">
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
                            <span>👥 {product.applicantsCount} בקשות</span>
                            <span>{shippingLabels[product.shippingPolicy] || product.shippingPolicy}</span>
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
        <div className="space-y-4">
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

          <div className="grid grid-cols-2 gap-3">
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
              <label className="block text-sm font-medium text-neutral-700 mb-1">קטגוריה</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-sm outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-500/10"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">מדיניות משלוח</label>
            <select
              value={formData.shippingPolicy}
              onChange={(e) => setFormData((p) => ({ ...p, shippingPolicy: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-sm outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-500/10"
            >
              <option value="free">משלוח חינם</option>
              <option value="paid">משלוח בתשלום</option>
              <option value="pickup">איסוף עצמי</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">קישור לתמונה</label>
            <Input
              type="url"
              placeholder="https://..."
              value={formData.imageUrl}
              onChange={(e) => setFormData((p) => ({ ...p, imageUrl: e.target.value }))}
            />
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
