"use client";

import { useState, useEffect } from "react";
import { Avatar, Badge, Button, Card, Modal, useToast } from "@/components/ui";

type Brand = {
  id: string;
  name: string;
  status: string;
  products: number;
  credits: number;
  spent: number;
  connections: number;
  joined: string;
  category?: string;
  websiteUrl?: string;
  contactName?: string;
  phone?: string;
  description?: string;
};

const mockBrands: Brand[] = [
  { id: "1", name: "GlowUp Skincare", status: "active", products: 8, credits: 45, spent: 12400, connections: 15, joined: "דצמבר 2025", category: "ביוטי וטיפוח", contactName: "רונית כהן", description: "מותג טיפוח ישראלי" },
  { id: "2", name: "TechFit", status: "active", products: 5, credits: 22, spent: 8200, connections: 9, joined: "ינואר 2026", category: "טכנולוגיה", contactName: "יואב לוי" },
  { id: "3", name: "UrbanStyle", status: "active", products: 12, credits: 67, spent: 18500, connections: 23, joined: "נובמבר 2025", category: "אופנה", contactName: "ליאור שמש" },
  { id: "4", name: "ChefHome", status: "pending", products: 3, credits: 10, spent: 2000, connections: 2, joined: "אוקטובר 2026", category: "מזון ומשקאות", contactName: "אורי דגן" },
  { id: "5", name: "ZenLife", status: "active", products: 6, credits: 30, spent: 9800, connections: 11, joined: "מרץ 2026", category: "ספורט ובריאות", contactName: "מאיה ברק" },
  { id: "6", name: "LightHouse", status: "active", products: 4, credits: 15, spent: 5600, connections: 7, joined: "מאי 2026", category: "בית וגינה", contactName: "דן אורן" },
];

export default function AdminBrandsPage() {
  const [brands, setBrands] = useState<Brand[]>(mockBrands);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchBrands() {
      try {
        const res = await fetch("/api/admin/brands");
        if (!res.ok) throw new Error("API error");
        const data = await res.json();
        if (data.brands && data.brands.length > 0) {
          setBrands(data.brands);
        }
      } catch {
        // fallback to mock data
      } finally {
        setLoading(false);
      }
    }
    fetchBrands();
  }, []);

  const filtered = brands.filter((b) => {
    if (search && !b.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

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
          placeholder="חיפוש לפי שם עסק..."
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
        <div className="bg-white rounded-2xl border border-neutral-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-100 text-right">
                <th className="px-4 py-3 text-xs font-medium text-neutral-400">עסק</th>
                <th className="px-4 py-3 text-xs font-medium text-neutral-400">סטטוס</th>
                <th className="px-4 py-3 text-xs font-medium text-neutral-400">מוצרים</th>
                <th className="px-4 py-3 text-xs font-medium text-neutral-400">קרדיטים</th>
                <th className="px-4 py-3 text-xs font-medium text-neutral-400">הוצאה כוללת</th>
                <th className="px-4 py-3 text-xs font-medium text-neutral-400">חיבורים</th>
                <th className="px-4 py-3 text-xs font-medium text-neutral-400">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((brand) => (
                <tr key={brand.id} className="border-b border-neutral-50 hover:bg-pink-50/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={brand.name} size="sm" />
                      <div>
                        <p className="text-sm font-medium">{brand.name}</p>
                        <p className="text-xs text-neutral-400">הצטרף {brand.joined}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={brand.status === "active" ? "success" : "warning"}
                      size="sm"
                      dot
                    >
                      {brand.status === "active" ? "פעיל" : "ממתין"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm">{brand.products}</td>
                  <td className="px-4 py-3 text-sm">{brand.credits}</td>
                  <td className="px-4 py-3 text-sm">₪{brand.spent.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm">{brand.connections}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => setSelectedBrand(brand)}
                        className="px-2.5 py-1 rounded-lg text-xs bg-neutral-50 hover:bg-neutral-100 transition-colors"
                      >
                        צפייה
                      </button>
                      <button
                        onClick={() => toast("עריכת עסקים — בקרוב!", "info")}
                        className="px-2.5 py-1 rounded-lg text-xs bg-neutral-50 hover:bg-neutral-100 transition-colors"
                      >
                        עריכה
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-neutral-400 text-sm">
                    לא נמצאו עסקים
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={!!selectedBrand}
        onClose={() => setSelectedBrand(null)}
        title={selectedBrand?.name || "פרטי עסק"}
        size="md"
      >
        {selectedBrand && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar name={selectedBrand.name} size="lg" />
              <div>
                <h3 className="text-lg font-bold">{selectedBrand.name}</h3>
                <Badge
                  variant={selectedBrand.status === "active" ? "success" : "warning"}
                  size="sm"
                  dot
                >
                  {selectedBrand.status === "active" ? "פעיל" : "ממתין לאישור"}
                </Badge>
              </div>
            </div>

            {selectedBrand.description && (
              <p className="text-sm text-neutral-600 bg-neutral-50 rounded-xl p-3">
                {selectedBrand.description}
              </p>
            )}

            <div className="grid grid-cols-4 gap-3">
              <div className="text-center p-3 bg-neutral-50 rounded-xl">
                <p className="text-lg font-bold">{selectedBrand.products}</p>
                <p className="text-xs text-neutral-500">מוצרים</p>
              </div>
              <div className="text-center p-3 bg-neutral-50 rounded-xl">
                <p className="text-lg font-bold">{selectedBrand.credits}</p>
                <p className="text-xs text-neutral-500">קרדיטים</p>
              </div>
              <div className="text-center p-3 bg-neutral-50 rounded-xl">
                <p className="text-lg font-bold">{selectedBrand.connections}</p>
                <p className="text-xs text-neutral-500">חיבורים</p>
              </div>
              <div className="text-center p-3 bg-neutral-50 rounded-xl">
                <p className="text-lg font-bold">₪{selectedBrand.spent.toLocaleString()}</p>
                <p className="text-xs text-neutral-500">הוצאה</p>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              {selectedBrand.contactName && (
                <div className="flex justify-between py-2 border-b border-neutral-50">
                  <span className="text-neutral-500">איש קשר</span>
                  <span className="font-medium">{selectedBrand.contactName}</span>
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
              <Button variant="ghost" size="sm" onClick={() => setSelectedBrand(null)}>
                סגירה
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
