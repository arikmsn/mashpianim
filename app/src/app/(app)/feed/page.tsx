"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge, Button, Card } from "@/components/ui";

const categories = [
  "הכל",
  "אופנה",
  "ביוטי",
  "טכנולוגיה",
  "בית וגינה",
  "אוכל",
  "ספורט",
  "ילדים",
];

const mockProducts = [
  {
    id: "1",
    name: 'סרום ויטמין C לעור הפנים',
    brand: "GlowUp Skincare",
    brandAvatar: null,
    image: null,
    category: "ביוטי",
    value: 189,
    description: "סרום מרוכז עם ויטמין C טהור לעור זוהר ובריא",
    requirements: "סרטון אנבוקסינג + שימוש",
    deadline: 10,
    applicants: 12,
    maxCreators: 3,
  },
  {
    id: "2",
    name: "שעון ספורט חכם",
    brand: "TechFit",
    brandAvatar: null,
    image: null,
    category: "טכנולוגיה",
    value: 350,
    description: "שעון ספורט עם מעקב דופק, GPS ועמידות במים",
    requirements: "סרטון סקירה + שימוש באימון",
    deadline: 10,
    applicants: 24,
    maxCreators: 5,
  },
  {
    id: "3",
    name: "תיק גב עור טבעוני",
    brand: "UrbanStyle",
    brandAvatar: null,
    image: null,
    category: "אופנה",
    value: 220,
    description: "תיק גב אלגנטי מעור טבעוני, מושלם ליומיום",
    requirements: "סטיילינג + סרטון OOTD",
    deadline: 10,
    applicants: 8,
    maxCreators: 2,
  },
  {
    id: "4",
    name: "ערכת בישול שף",
    brand: "ChefHome",
    brandAvatar: null,
    image: null,
    category: "אוכל",
    value: 280,
    description: "ערכה מלאה עם סכינים, קרש חיתוך ומגבות מטבח",
    requirements: "סרטון בישול עם הערכה",
    deadline: 10,
    applicants: 6,
    maxCreators: 2,
  },
  {
    id: "5",
    name: "סט יוגה פרימיום",
    brand: "ZenLife",
    brandAvatar: null,
    image: null,
    category: "ספורט",
    value: 199,
    description: "מזרן יוגה, בלוקים ורצועה — כל מה שצריך לתרגול",
    requirements: "סרטון תרגול יוגה",
    deadline: 10,
    applicants: 15,
    maxCreators: 4,
  },
  {
    id: "6",
    name: "מנורת לד דקורטיבית",
    brand: "LightHouse",
    brandAvatar: null,
    image: null,
    category: "בית וגינה",
    value: 145,
    description: "מנורה עם 16 צבעים ושלט רחוק, מושלמת לחדר",
    requirements: "סרטון עיצוב חדר / אווירה",
    deadline: 10,
    applicants: 18,
    maxCreators: 5,
  },
];

function ProductCard({ product }: { product: (typeof mockProducts)[0] }) {
  const placeholderColors = [
    "from-pink-200 to-pink-300",
    "from-purple-200 to-purple-300",
    "from-blue-200 to-blue-300",
    "from-emerald-200 to-emerald-300",
    "from-amber-200 to-amber-300",
    "from-rose-200 to-rose-300",
  ];
  const colorIndex =
    parseInt(product.id) % placeholderColors.length;

  return (
    <Card hover padding="none" className="overflow-hidden">
      <div
        className={`h-48 bg-gradient-to-br ${placeholderColors[colorIndex]} flex items-center justify-center`}
      >
        <span className="text-5xl opacity-50">📦</span>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="font-bold text-neutral-900">{product.name}</h3>
            <p className="text-sm text-neutral-500">{product.brand}</p>
          </div>
          <Badge variant="pink" size="sm">
            ₪{product.value}
          </Badge>
        </div>
        <p className="text-sm text-neutral-600 mb-3 line-clamp-2">
          {product.description}
        </p>
        <div className="flex items-center gap-2 mb-3 text-xs text-neutral-400">
          <span>📋 {product.requirements}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-neutral-400">
            <span>👥 {product.applicants}/{product.maxCreators}</span>
            <span>⏱ {product.deadline} ימים</span>
          </div>
          <Button size="sm" rounded>
            שלחו בקשה
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default function FeedPage() {
  const [activeCategory, setActiveCategory] = useState("הכל");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = mockProducts.filter((p) => {
    if (activeCategory !== "הכל" && p.category !== activeCategory) return false;
    if (searchQuery && !p.name.includes(searchQuery) && !p.brand.includes(searchQuery))
      return false;
    return true;
  });

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-neutral-100">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="חיפוש מוצרים..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-neutral-50 border border-neutral-100 text-sm outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-500/10 transition-all"
              />
              <svg
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
            <button className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-100 text-neutral-500 hover:bg-neutral-100 transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </button>
          </div>

          {/* Categories */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activeCategory === cat
                    ? "bg-pink-500 text-white"
                    : "bg-neutral-50 text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Product grid */}
      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((product) => (
              <motion.div
                key={product.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <ProductCard product={product} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-20 text-neutral-400">
            <span className="text-4xl block mb-4">🔍</span>
            <p>לא נמצאו מוצרים בקטגוריה זו</p>
          </div>
        )}
      </div>
    </main>
  );
}
