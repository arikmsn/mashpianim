"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, Badge, Button, Card, useToast } from "@/components/ui";
import { ProfileModal } from "@/components/features";
import { useAuth } from "@/hooks/use-auth";
import { useNotifications } from "@/hooks/use-notifications";
import { createClient } from "@/lib/supabase/client";

const allFeedCategories = [
  "אופנה",
  "ביוטי",
  "טכנולוגיה",
  "בית וגינה",
  "אוכל",
  "ספורט",
  "ילדים",
  "כללי",
];

const registrationToFeedMap: Record<string, string> = {
  "אופנה": "אופנה",
  "ביוטי וטיפוח": "ביוטי",
  "מזון ומשקאות": "אוכל",
  "ניקיון ובית": "בית וגינה",
  "ילדים ותינוקות": "ילדים",
  "ספורט ובריאות": "ספורט",
  "טכנולוגיה": "טכנולוגיה",
  "חיות מחמד": "כללי",
  "אחר": "כללי",
};

function toDirectImageUrl(url: string | null): string | null {
  if (!url) return null;
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (driveMatch) {
    return `https://drive.google.com/uc?export=view&id=${driveMatch[1]}`;
  }
  return url;
}

interface Product {
  id: string;
  name: string;
  brand: string;
  brandAvatar: string | null;
  brandUserId: string | null;
  image: string | null;
  category: string;
  value: number;
  description: string;
  requirements: string;
  deadline: number;
  applicants: number;
  maxCreators: number;
}


function ProductSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-neutral-100 overflow-hidden">
      <div className="h-48 bg-gradient-to-br from-pink-100 to-pink-50 animate-pulse" />
      <div className="p-4 space-y-3">
        <div className="flex justify-between">
          <div className="space-y-2 flex-1">
            <div className="h-4 bg-pink-100 rounded-lg w-3/4 animate-pulse" />
            <div className="h-3 bg-neutral-100 rounded-lg w-1/2 animate-pulse" />
          </div>
          <div className="h-6 w-12 bg-pink-100 rounded-full animate-pulse" />
        </div>
        <div className="h-3 bg-neutral-100 rounded-lg w-full animate-pulse" />
        <div className="h-3 bg-neutral-100 rounded-lg w-2/3 animate-pulse" />
        <div className="flex justify-between items-center pt-1">
          <div className="h-3 bg-neutral-100 rounded-lg w-1/3 animate-pulse" />
          <div className="h-8 w-20 bg-pink-100 rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function ProductCard({
  product,
  onApply,
  onViewBrand,
  applying,
}: {
  product: Product;
  onApply: (id: string) => void;
  onViewBrand: (userId: string) => void;
  applying: string | null;
}) {
  const placeholderColors = [
    "from-pink-200 to-pink-300",
    "from-purple-200 to-purple-300",
    "from-blue-200 to-blue-300",
    "from-emerald-200 to-emerald-300",
    "from-amber-200 to-amber-300",
    "from-rose-200 to-rose-300",
  ];
  const colorIndex =
    parseInt(product.id.replace(/\D/g, "") || "0") % placeholderColors.length;

  return (
    <Card hover padding="none" className="overflow-hidden">
      {product.image ? (
        <div className="h-48 overflow-hidden">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div
          className={`h-48 bg-gradient-to-br ${placeholderColors[colorIndex]} flex items-center justify-center`}
        >
          <span className="text-5xl opacity-50">📦</span>
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              disabled={!product.brandUserId}
              onClick={() => product.brandUserId && onViewBrand(product.brandUserId)}
              className="flex items-center gap-2 text-right min-w-0 disabled:cursor-default group"
              aria-label={`פרופיל ${product.brand}`}
            >
              <Avatar src={product.brandAvatar} name={product.brand} size="sm" className="group-enabled:group-hover:ring-pink-300 transition-all" />
              <div className="min-w-0">
                <h3 className="font-bold text-neutral-900 truncate">{product.name}</h3>
                <p className="text-sm text-neutral-500 truncate group-enabled:group-hover:text-pink-500 transition-colors">
                  {product.brand}
                  {product.brandUserId && <span className="text-[10px] text-neutral-300 mr-1">· פרופיל</span>}
                </p>
              </div>
            </button>
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
          <Button
            size="sm"
            rounded
            loading={applying === product.id}
            onClick={() => onApply(product.id)}
          >
            שלחו בקשה
          </Button>
        </div>
      </div>
    </Card>
  );
}

function buildCategoryList(userCategories: string[]): string[] {
  const mapped = userCategories
    .map((c) => registrationToFeedMap[c] || c)
    .filter((c) => allFeedCategories.includes(c));
  const unique = [...new Set(mapped)];
  const rest = allFeedCategories.filter((c) => !unique.includes(c));
  return [...unique, "הכל", ...rest];
}

export default function FeedPage() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>(["הכל", ...allFeedCategories]);
  const [viewBrandId, setViewBrandId] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const { unreadCount } = useNotifications();
  const router = useRouter();

  useEffect(() => {
    async function fetchUserCategories() {
      try {
        const res = await fetch("/api/profile");
        if (res.ok) {
          const data = await res.json();
          if (data.user?.type === "brand") {
            router.replace("/brand");
            return;
          }
          const profile = data.profile || {};
          const userCats: string[] = profile.categories || (profile.category ? [profile.category] : []);
          if (userCats.length > 0) {
            setCategories(buildCategoryList(userCats));
          }
        }
      } catch {
        // Use default order
      }
    }
    fetchUserCategories();
  }, [router]);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const res = await fetch("/api/products?status=active");
        if (res.ok) {
          const data = await res.json();
          if (data.products && data.products.length > 0) {
            setProducts(
              data.products.map((p: Record<string, unknown>) => ({
                id: p.id as string,
                name: p.name as string,
                brand: (p.brand_name as string) || (p.shop_name as string) || "",
                brandAvatar: (p.logo_url as string) || null,
                brandUserId: (p.brand_user_id as string) || null,
                image: toDirectImageUrl((p.image_url as string) || null),
                category: (p.category as string) || "",
                value: Number(p.price) || 0,
                description: (p.description as string) || "",
                requirements: (p.requirements as string) || "סרטון UGC",
                deadline: (p.film_deadline_days as number) || 10,
                applicants: (p.applicants_count as number) || 0,
                maxCreators: (p.max_creators as number) || 3,
              }))
            );
          }
        }
      } catch {
        // API unavailable
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
  }, []);

  // Realtime: refresh feed when products change
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("feed-products")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        async () => {
          try {
            const res = await fetch("/api/products?status=active");
            if (res.ok) {
              const data = await res.json();
              if (data.products) {
                setProducts(
                  data.products.map((p: Record<string, unknown>) => ({
                    id: p.id as string,
                    name: p.name as string,
                    brand: (p.brand_name as string) || (p.shop_name as string) || "",
                    brandAvatar: (p.logo_url as string) || null,
                    brandUserId: (p.brand_user_id as string) || null,
                    image: toDirectImageUrl((p.image_url as string) || null),
                    category: (p.category as string) || "",
                    value: Number(p.price) || 0,
                    description: (p.description as string) || "",
                    requirements: (p.requirements as string) || "סרטון UGC",
                    deadline: (p.film_deadline_days as number) || 10,
                    applicants: (p.applicants_count as number) || 0,
                    maxCreators: (p.max_creators as number) || 3,
                  }))
                );
              }
            }
          } catch {
            // ignore
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (activeCategory !== null || loading) return;
    const firstUserCat = categories[0];
    if (firstUserCat && firstUserCat !== "הכל") {
      const hasProducts = products.some(
        (p) => p.category.startsWith(firstUserCat) || p.category === firstUserCat
      );
      setActiveCategory(hasProducts ? firstUserCat : "הכל");
    } else {
      setActiveCategory("הכל");
    }
  }, [loading, categories, products, activeCategory]);

  const handleApply = useCallback(
    async (productId: string) => {
      if (!user) {
        router.push("/login?redirect=/feed");
        return;
      }

      setApplying(productId);
      try {
        const res = await fetch("/api/connections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ product_id: productId }),
        });

        if (res.ok) {
          toast("בקשת החיבור נשלחה בהצלחה!", "success");
          setProducts((prev) =>
            prev.map((p) =>
              p.id === productId
                ? { ...p, applicants: p.applicants + 1 }
                : p
            )
          );
        } else {
          const data = await res.json();
          toast(data.error || "שגיאה בשליחת הבקשה", "error");
        }
      } catch {
        toast("שגיאה בשליחת הבקשה", "error");
      } finally {
        setApplying(null);
      }
    },
    [user, router, toast]
  );

  const effectiveCategory = activeCategory || "הכל";

  const filtered = products.filter((p) => {
    if (effectiveCategory !== "הכל" && !p.category.startsWith(effectiveCategory) && p.category !== effectiveCategory) return false;
    if (
      searchQuery &&
      !p.name.includes(searchQuery) &&
      !p.brand.includes(searchQuery)
    )
      return false;
    return true;
  });

  return (
    <main className="min-h-screen bg-background pb-20">
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
            <Link
              href="/notifications"
              className="relative p-2.5 rounded-xl bg-neutral-50 border border-neutral-100 text-neutral-500 hover:bg-neutral-100 transition-colors"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-pink-500 text-white text-[10px] flex items-center justify-center font-bold ring-2 ring-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
          </div>

          {/* Categories */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  effectiveCategory === cat
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
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <ProductSkeleton key={i} />
            ))}
          </div>
        ) : (
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
                  <ProductCard
                    product={product}
                    onApply={handleApply}
                    onViewBrand={setViewBrandId}
                    applying={applying}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-20 text-neutral-400">
            <span className="text-4xl block mb-4">🔍</span>
            <p>לא נמצאו מוצרים בקטגוריה זו</p>
          </div>
        )}
      </div>

      <ProfileModal userId={viewBrandId} onClose={() => setViewBrandId(null)} title="פרופיל העסק" />
    </main>
  );
}
