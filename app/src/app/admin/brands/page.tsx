"use client";

import { useState } from "react";
import { Avatar, Badge, Card } from "@/components/ui";

const mockBrands = [
  { id: "1", name: "GlowUp Skincare", status: "active", products: 8, credits: 45, spent: 12400, connections: 15, joined: "דצמבר 2025" },
  { id: "2", name: "TechFit", status: "active", products: 5, credits: 22, spent: 8200, connections: 9, joined: "ינואר 2026" },
  { id: "3", name: "UrbanStyle", status: "active", products: 12, credits: 67, spent: 18500, connections: 23, joined: "נובמבר 2025" },
  { id: "4", name: "ChefHome", status: "pending", products: 3, credits: 10, spent: 2000, connections: 2, joined: "אוקטובר 2026" },
  { id: "5", name: "ZenLife", status: "active", products: 6, credits: 30, spent: 9800, connections: 11, joined: "מרץ 2026" },
  { id: "6", name: "LightHouse", status: "active", products: 4, credits: 15, spent: 5600, connections: 7, joined: "מאי 2026" },
];

export default function AdminBrandsPage() {
  const [search, setSearch] = useState("");

  const filtered = mockBrands.filter((b) => {
    if (search && !b.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">ניהול עסקים</h1>
          <p className="text-neutral-500 text-sm mt-1">{mockBrands.length} עסקים רשומים</p>
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
                    <button className="px-2.5 py-1 rounded-lg text-xs bg-neutral-50 hover:bg-neutral-100 transition-colors">
                      צפייה
                    </button>
                    <button className="px-2.5 py-1 rounded-lg text-xs bg-neutral-50 hover:bg-neutral-100 transition-colors">
                      עריכה
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
