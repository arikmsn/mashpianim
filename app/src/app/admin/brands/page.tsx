"use client";

import { useState, useEffect } from "react";
import { Avatar, Badge, Button, Card, Modal, Input, useToast } from "@/components/ui";

type Brand = {
  id: string;
  name: string;
  contactName: string;
  phone: string;
  isActive: boolean;
  avatarUrl: string | null;
  totalCredits: number;
  usedCredits: number;
  joined: string;
  category?: string;
  websiteUrl?: string;
  description?: string;
};

export default function AdminBrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [creditsInput, setCreditsInput] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchBrands() {
      try {
        const res = await fetch("/api/admin/brands");
        if (!res.ok) throw new Error("API error");
        const data = await res.json();
        setBrands(
          (data.brands || []).map((b: Record<string, unknown>): Brand => ({
            id: b.id as string,
            name: (b.shop_name as string) || (b.full_name as string) || "עסק",
            contactName: (b.full_name as string) || "",
            phone: (b.phone as string) || "",
            isActive: b.is_active !== false,
            avatarUrl: (b.logo_url as string) || (b.avatar_url as string) || null,
            totalCredits: (b.total_credits as number) || 0,
            usedCredits: (b.used_credits as number) || 0,
            joined: b.created_at ? new Date(b.created_at as string).toLocaleDateString("he-IL") : "",
            category: (Array.isArray(b.categories) && (b.categories as string[]).length > 0
              ? (b.categories as string[]).join(" · ")
              : (b.category as string)) || undefined,
            websiteUrl: (b.website_url as string) || undefined,
            description: (b.description as string) || undefined,
          }))
        );
      } catch {
        // API unavailable
      } finally {
        setLoading(false);
      }
    }
    fetchBrands();
  }, []);

  function openCreditsEditor(brand: Brand) {
    setEditingBrand(brand);
    setCreditsInput(String(brand.totalCredits));
  }

  async function saveCredits() {
    if (!editingBrand) return;
    const credits = Number(creditsInput);
    if (!Number.isInteger(credits) || credits < 0) {
      toast("יש להזין מספר שלם חיובי", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/brands", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: editingBrand.id, total_credits: credits }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast(data.error || "שגיאה בעדכון", "error");
        return;
      }
      setBrands((prev) => prev.map((b) => (b.id === editingBrand.id ? { ...b, totalCredits: credits } : b)));
      if (selectedBrand?.id === editingBrand.id) setSelectedBrand({ ...selectedBrand, totalCredits: credits });
      toast("הסרטונים עודכנו בהצלחה", "success");
      setEditingBrand(null);
    } catch {
      toast("שגיאה בעדכון", "error");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(brand: Brand) {
    try {
      const res = await fetch("/api/admin/brands", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: brand.id, is_active: !brand.isActive }),
      });
      if (!res.ok) throw new Error();
      setBrands((prev) => prev.map((b) => (b.id === brand.id ? { ...b, isActive: !brand.isActive } : b)));
      if (selectedBrand?.id === brand.id) setSelectedBrand({ ...selectedBrand, isActive: !brand.isActive });
      toast(brand.isActive ? "העסק הושבת" : "העסק הופעל", "success");
    } catch {
      toast("שגיאה בעדכון", "error");
    }
  }

  const filtered = brands.filter((b) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return b.name.toLowerCase().includes(q) || b.contactName.toLowerCase().includes(q) || b.phone.includes(q);
  });

  const remaining = (b: Brand) => Math.max(0, b.totalCredits - b.usedCredits);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">ניהול עסקים</h1>
          <p className="text-neutral-500 text-sm mt-1">{brands.length} עסקים רשומים</p>
        </div>
      </div>

      <Card padding="md" className="mb-6">
        <input
          type="text"
          placeholder="חיפוש לפי שם עסק, איש קשר או טלפון..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl bg-neutral-50 border border-neutral-100 text-sm outline-none focus:border-pink-300"
        />
      </Card>

      {loading ? (
        <div className="bg-white rounded-2xl border border-neutral-100 p-8">
          <div className="animate-pulse space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-neutral-200" />
                <div className="flex-1">
                  <div className="h-4 bg-neutral-200 rounded w-32 mb-2" />
                  <div className="h-3 bg-neutral-100 rounded w-20" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-neutral-100 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-100 text-right">
                <th className="px-4 py-3 text-xs font-medium text-neutral-400">עסק</th>
                <th className="px-4 py-3 text-xs font-medium text-neutral-400">סטטוס</th>
                <th className="px-4 py-3 text-xs font-medium text-neutral-400">קטגוריה</th>
                <th className="px-4 py-3 text-xs font-medium text-neutral-400">סרטונים (נותרו / סה״כ)</th>
                <th className="px-4 py-3 text-xs font-medium text-neutral-400">נוצלו</th>
                <th className="px-4 py-3 text-xs font-medium text-neutral-400">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((brand) => (
                <tr key={brand.id} className="border-b border-neutral-50 hover:bg-pink-50/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar src={brand.avatarUrl} name={brand.name} size="sm" />
                      <div>
                        <p className="text-sm font-medium">{brand.name}</p>
                        <p className="text-xs text-neutral-400">{brand.contactName} · הצטרף {brand.joined}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={brand.isActive ? "success" : "warning"} size="sm" dot>
                      {brand.isActive ? "פעיל" : "מושבת"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-600">{brand.category || "—"}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={remaining(brand) === 0 ? "text-red-500 font-bold" : "font-bold text-emerald-600"}>
                      {remaining(brand)}
                    </span>
                    <span className="text-neutral-400"> / {brand.totalCredits}</span>
                  </td>
                  <td className="px-4 py-3 text-sm">{brand.usedCredits}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => setSelectedBrand(brand)}
                        className="px-2.5 py-1 rounded-lg text-xs bg-neutral-50 hover:bg-neutral-100 transition-colors"
                      >
                        צפייה
                      </button>
                      <button
                        onClick={() => openCreditsEditor(brand)}
                        className="px-2.5 py-1 rounded-lg text-xs bg-pink-50 text-pink-600 hover:bg-pink-100 transition-colors"
                      >
                        🎬 סרטונים
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-neutral-400 text-sm">
                    לא נמצאו עסקים
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Brand details */}
      <Modal
        open={!!selectedBrand}
        onClose={() => setSelectedBrand(null)}
        title={selectedBrand?.name || "פרטי עסק"}
        size="md"
      >
        {selectedBrand && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar src={selectedBrand.avatarUrl} name={selectedBrand.name} size="lg" />
              <div>
                <h3 className="text-lg font-bold">{selectedBrand.name}</h3>
                <Badge variant={selectedBrand.isActive ? "success" : "warning"} size="sm" dot>
                  {selectedBrand.isActive ? "פעיל" : "מושבת"}
                </Badge>
              </div>
            </div>

            {selectedBrand.description && (
              <p className="text-sm text-neutral-600 bg-neutral-50 rounded-xl p-3">
                {selectedBrand.description}
              </p>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-emerald-50 rounded-xl">
                <p className="text-lg font-bold text-emerald-600">{remaining(selectedBrand)}</p>
                <p className="text-xs text-neutral-500">סרטונים נותרו</p>
              </div>
              <div className="text-center p-3 bg-neutral-50 rounded-xl">
                <p className="text-lg font-bold">{selectedBrand.usedCredits}</p>
                <p className="text-xs text-neutral-500">נוצלו</p>
              </div>
              <div className="text-center p-3 bg-neutral-50 rounded-xl">
                <p className="text-lg font-bold">{selectedBrand.totalCredits}</p>
                <p className="text-xs text-neutral-500">סה״כ</p>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              {selectedBrand.contactName && (
                <div className="flex justify-between py-2 border-b border-neutral-50">
                  <span className="text-neutral-500">איש קשר</span>
                  <span className="font-medium">{selectedBrand.contactName}</span>
                </div>
              )}
              {selectedBrand.phone && (
                <div className="flex justify-between py-2 border-b border-neutral-50">
                  <span className="text-neutral-500">טלפון</span>
                  <span className="font-medium" dir="ltr">{selectedBrand.phone}</span>
                </div>
              )}
              {selectedBrand.category && (
                <div className="flex justify-between py-2 border-b border-neutral-50">
                  <span className="text-neutral-500">קטגוריה</span>
                  <span className="font-medium">{selectedBrand.category}</span>
                </div>
              )}
              {selectedBrand.websiteUrl && (
                <div className="flex justify-between py-2 border-b border-neutral-50">
                  <span className="text-neutral-500">אתר</span>
                  <span className="font-medium" dir="ltr">{selectedBrand.websiteUrl}</span>
                </div>
              )}
              <div className="flex justify-between py-2">
                <span className="text-neutral-500">הצטרף</span>
                <span className="font-medium">{selectedBrand.joined}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={() => openCreditsEditor(selectedBrand)}>
                🎬 עריכת סרטונים
              </Button>
              <Button variant={selectedBrand.isActive ? "danger" : "secondary"} size="sm" onClick={() => toggleActive(selectedBrand)}>
                {selectedBrand.isActive ? "השבתת עסק" : "הפעלת עסק"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedBrand(null)}>
                סגירה
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Credits editor */}
      <Modal
        open={!!editingBrand}
        onClose={() => setEditingBrand(null)}
        title="עריכת סרטונים"
        size="sm"
      >
        {editingBrand && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar src={editingBrand.avatarUrl} name={editingBrand.name} size="md" />
              <div>
                <p className="font-bold">{editingBrand.name}</p>
                <p className="text-xs text-neutral-500">
                  נוצלו {editingBrand.usedCredits} · נותרו {remaining(editingBrand)}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm text-neutral-500 mb-1">סה״כ סרטונים (כולל מה שנוצל)</label>
              <Input
                type="number"
                min={0}
                step={1}
                value={creditsInput}
                onChange={(e) => setCreditsInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveCredits(); }}
                autoFocus
              />
              <p className="text-xs text-neutral-400 mt-1">
                לאחר השמירה יישארו לעסק{" "}
                <span className="font-bold text-neutral-700">
                  {Math.max(0, (Number(creditsInput) || 0) - editingBrand.usedCredits)}
                </span>{" "}
                סרטונים
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {[1, 5, 10].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCreditsInput(String((Number(creditsInput) || 0) + n))}
                  className="px-3 py-1.5 rounded-full border border-neutral-200 text-sm hover:border-pink-500 hover:bg-pink-50 transition-colors"
                >
                  +{n}
                </button>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <Button fullWidth loading={saving} onClick={saveCredits}>
                שמירה
              </Button>
              <Button variant="ghost" onClick={() => setEditingBrand(null)}>
                ביטול
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
