"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, Badge, Button, Card, Modal, useToast } from "@/components/ui";
import { useAuth } from "@/hooks/use-auth";
import { useNotifications } from "@/hooks/use-notifications";
import { createClient } from "@/lib/supabase/client";
import { swrFetch, fetchJson } from "@/lib/client-cache";

// Filter chips: "for you" (the creator's categories + anything already in motion), everything, then categories
const FOR_YOU = "בשבילך";
const ALL = "הכל";

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
  categories: string[];
  value: number;
  description: string;
  requirements: string;
  deadline: number;
  applicants: number;
  maxCreators: number;
}


interface Relation {
  connectionId: string;
  status: string;
  initiatedBy: "creator" | "brand";
}

const MIN_PORTFOLIO = 5;

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
  relation,
  locked,
  onApply,
  onApprove,
  onOpenChat,
  onOpen,
  applying,
  approving,
}: {
  product: Product;
  relation: Relation | undefined;
  locked: boolean;
  onApply: (id: string) => void;
  onApprove: (connectionId: string) => void;
  onOpenChat: (connectionId: string) => void;
  onOpen: (productId: string) => void;
  applying: string | null;
  approving: string | null;
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

  const pendingFromBrand = relation?.status === "pending" && relation.initiatedBy === "brand";
  const pendingFromMe = relation?.status === "pending" && relation.initiatedBy === "creator";
  const matched = !!relation && relation.status !== "pending";

  return (
    <Card hover padding="none" className="overflow-hidden relative">
      {pendingFromBrand && (
        <div className="absolute top-3 right-3 z-10 ig-gradient-bg text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
          💗 סימנו אותך
        </div>
      )}
      {matched && (
        <div className="absolute top-3 right-3 z-10 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
          🎉 מאטץ&apos;
        </div>
      )}
      {/* The card opens the product page (details, brief, status); the buttons below act in place */}
      <button
        type="button"
        onClick={() => onOpen(product.id)}
        className="block w-full text-right"
        aria-label={`פרטי המוצר ${product.name}`}
      >
        {product.image ? (
          <div className="h-48 overflow-hidden">
            <img
              src={product.image}
              alt={product.name}
              loading="lazy"
              decoding="async"
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
      </button>
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <button
            type="button"
            onClick={() => onOpen(product.id)}
            className="flex items-center gap-2 text-right min-w-0 group"
          >
            <Avatar src={product.brandAvatar} name={product.brand} size="sm" className="group-hover:ring-pink-300 transition-all" />
            <div className="min-w-0">
              <h3 className="font-bold text-neutral-900 truncate group-hover:text-pink-600 transition-colors">{product.name}</h3>
              <p className="text-sm text-neutral-500 truncate">
                {product.brand}
                <span className="text-[10px] text-pink-400 mr-1">· פרטים ובריף ›</span>
              </p>
            </div>
          </button>
          <Badge variant="pink" size="sm">
            ₪{product.value}
          </Badge>
        </div>
        {locked ? (
          <div className="relative mb-3">
            <p className="text-sm text-neutral-600 line-clamp-2 blur-sm select-none" aria-hidden="true">
              {product.description || "פרטי המוצר, הדרישות והבריף יופיעו כאן"}
            </p>
            <button
              type="button"
              onClick={() => onApply(product.id)}
              className="absolute inset-0 flex items-center justify-center text-xs font-medium text-neutral-600 bg-white/50 rounded-lg"
            >
              🔒 5 סרטונים בתיק פותחים את הפרטים
            </button>
          </div>
        ) : (
          <p className="text-sm text-neutral-600 mb-3 line-clamp-2">
            {product.description}
          </p>
        )}
        <div className="flex items-center gap-2 mb-3 text-xs text-neutral-400">
          <span>📋 {product.requirements}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-neutral-400">
            <span>👥 {product.applicants}/{product.maxCreators}</span>
            <span>⏱ {product.deadline} ימים</span>
          </div>
          {pendingFromBrand && relation ? (
            <Button
              size="sm"
              rounded
              loading={approving === relation.connectionId}
              onClick={() => onApprove(relation.connectionId)}
            >
              {locked ? "🔒 " : "💗 "}אישור — מאטץ&apos;
            </Button>
          ) : pendingFromMe ? (
            <Button size="sm" rounded variant="secondary" disabled>
              ❤️ לב נשלח
            </Button>
          ) : matched && relation ? (
            <Button size="sm" rounded variant="secondary" onClick={() => onOpenChat(relation.connectionId)}>
              💬 לצ&apos;אט
            </Button>
          ) : (
            <Button
              size="sm"
              rounded
              loading={applying === product.id}
              onClick={() => onApply(product.id)}
            >
              {locked ? "🔒 " : "❤️ "}מעוניין/ת
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function productMatchesCategory(p: Product, cat: string): boolean {
  if (cat === ALL || cat === FOR_YOU) return true;
  const cats = p.categories.length > 0 ? p.categories : [p.category];
  return cats.some((c) => c === cat || c.startsWith(cat));
}

// Chip order: "for you", everything, the creator's own categories, then the rest
function buildCategoryList(userCategories: string[]): string[] {
  const mapped = userCategories
    .map((c) => registrationToFeedMap[c] || c)
    .filter((c) => allFeedCategories.includes(c));
  const unique = [...new Set(mapped)];
  const rest = allFeedCategories.filter((c) => !unique.includes(c));
  return [FOR_YOU, ALL, ...unique, ...rest];
}

export default function FeedPage() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([FOR_YOU, ALL, ...allFeedCategories]);
  const [portfolioCount, setPortfolioCount] = useState<number | null>(null);
  const [userCategories, setUserCategories] = useState<string[]>([]);
  const [relations, setRelations] = useState<Record<string, Relation>>({});
  const [gateOpen, setGateOpen] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const { unreadCount } = useNotifications();
  const router = useRouter();

  useEffect(() => {
    swrFetch<{ user?: { type?: string }; profile?: { categories?: string[]; category?: string; portfolio_count?: number } }>(
      "/api/profile",
      (data) => {
        if (data.user?.type === "brand") {
          router.replace("/brand");
          return;
        }
        const profile = data.profile || {};
        const userCats: string[] = profile.categories || (profile.category ? [profile.category] : []);
        setUserCategories(userCats);
        if (userCats.length > 0) {
          setCategories(buildCategoryList(userCats));
        }
        if (data.user?.type === "creator") {
          setPortfolioCount(typeof profile.portfolio_count === "number" ? profile.portfolio_count : 0);
        }
      }
    );
  }, [router]);

  const applyProducts = useCallback((data: { products?: Record<string, unknown>[] }) => {
    if (!data.products) return;
    setProducts(
      data.products.map((p) => ({
        id: p.id as string,
        name: p.name as string,
        brand: (p.brand_name as string) || (p.shop_name as string) || "",
        brandAvatar: (p.logo_url as string) || null,
        brandUserId: (p.brand_user_id as string) || null,
        image: toDirectImageUrl((p.image_url as string) || null),
        category: (p.category as string) || "",
        categories: Array.isArray(p.categories) ? (p.categories as string[]) : [],
        value: Number(p.price) || 0,
        description: (p.description as string) || "",
        requirements: (p.requirements as string) || "סרטון UGC",
        deadline: (p.film_deadline_days as number) || 10,
        applicants: (p.occupied as number) || 0,
        maxCreators: (p.max_creators as number) || 3,
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    swrFetch("/api/products?status=active", applyProducts).finally(() => setLoading(false));
  }, [applyProducts]);

  const applyRelations = useCallback((data: { connections?: Record<string, unknown>[] }) => {
    const map: Record<string, Relation> = {};
    for (const c of data.connections || []) {
      const status = c.status as string;
      if (["cancelled", "rejected", "completed"].includes(status)) continue;
      const pid = c.product_id as string;
      if (!pid || map[pid]) continue;
      map[pid] = { connectionId: c.id as string, status, initiatedBy: c.initiated_by === "brand" ? "brand" : "creator" };
    }
    setRelations(map);
  }, []);

  useEffect(() => {
    if (!user) return;
    swrFetch("/api/connections", applyRelations);
    const supabase = createClient();
    const channel = supabase
      .channel("feed-connections")
      .on("postgres_changes", { event: "*", schema: "public", table: "connections" }, () => {
        fetchJson<{ connections?: Record<string, unknown>[] }>("/api/connections").then((d) => d && applyRelations(d));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, applyRelations]);

  // Realtime: refresh feed when products change
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("feed-products")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        () => {
          fetchJson<{ products?: Record<string, unknown>[] }>("/api/products?status=active").then((data) => {
            if (data) applyProducts(data);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [applyProducts]);

  const locked = portfolioCount !== null && portfolioCount < MIN_PORTFOLIO;

  const handleApply = useCallback(
    async (productId: string) => {
      if (!user) {
        router.push("/login?redirect=/feed");
        return;
      }
      if (locked) {
        setGateOpen(true);
        return;
      }

      setApplying(productId);
      try {
        const res = await fetch("/api/connections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ product_id: productId }),
        });
        const data = await res.json().catch(() => ({}));

        if (res.ok) {
          const connectionId = data.connection?.id as string;
          if (data.matched) {
            toast("🎉 יש מאטץ'! הצ'אט נפתח", "success");
            setRelations((prev) => ({ ...prev, [productId]: { connectionId, status: "approved", initiatedBy: "brand" } }));
          } else {
            toast("❤️ הלב נשלח! נעדכן אותך כשהעסק יאשר", "success");
            setRelations((prev) => ({ ...prev, [productId]: { connectionId, status: "pending", initiatedBy: "creator" } }));
          }
          setProducts((prev) =>
            prev.map((p) => (p.id === productId ? { ...p, applicants: p.applicants + 1 } : p))
          );
        } else if (data.code === "portfolio_gate") {
          setPortfolioCount(typeof data.count === "number" ? data.count : 0);
          setGateOpen(true);
        } else {
          toast(data.error || "שגיאה בשליחת הלב", "error");
        }
      } catch {
        toast("שגיאה בשליחת הלב", "error");
      } finally {
        setApplying(null);
      }
    },
    [user, router, toast, locked]
  );

  const handleApprove = useCallback(
    async (connectionId: string) => {
      if (locked) {
        setGateOpen(true);
        return;
      }
      setApproving(connectionId);
      try {
        const res = await fetch(`/api/connections/${connectionId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "approved" }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          toast("🎉 יש מאטץ'! הצ'אט נפתח", "success");
          setRelations((prev) => {
            const next = { ...prev };
            for (const pid of Object.keys(next)) {
              if (next[pid].connectionId === connectionId) next[pid] = { ...next[pid], status: "approved" };
            }
            return next;
          });
          router.push(`/messages?connection=${connectionId}`);
        } else if (data.code === "portfolio_gate") {
          setPortfolioCount(typeof data.count === "number" ? data.count : 0);
          setGateOpen(true);
        } else {
          toast(data.error || "שגיאה באישור", "error");
        }
      } catch {
        toast("שגיאה באישור", "error");
      } finally {
        setApproving(null);
      }
    },
    [locked, router, toast]
  );

  // Until the creator picks a chip: "for you" when there is something to match on (own categories or hearts/matches), else "all"
  const effectiveCategory =
    activeCategory ?? (userCategories.length > 0 || Object.keys(relations).length > 0 ? FOR_YOU : ALL);

  // Products that match the creator's own categories float to the top; brand hearts first of all
  const matchesUser = (p: Product) => userCategories.some((c) => productMatchesCategory(p, registrationToFeedMap[c] || c));

  const filtered = products.filter((p) => {
    if (effectiveCategory === FOR_YOU) {
      if (!matchesUser(p) && !relations[p.id]) return false;
    } else if (!productMatchesCategory(p, effectiveCategory)) {
      return false;
    }
    if (
      searchQuery &&
      !p.name.includes(searchQuery) &&
      !p.brand.includes(searchQuery)
    )
      return false;
    return true;
  });
  const rank = (p: Product) => {
    const r = relations[p.id];
    if (r?.status === "pending" && r.initiatedBy === "brand") return 3;
    if (r && r.status !== "pending") return 2;
    return matchesUser(p) ? 1 : 0;
  };
  const ordered = [...filtered].sort((a, b) => rank(b) - rank(a));
  const brandHearts = Object.values(relations).filter((r) => r.status === "pending" && r.initiatedBy === "brand").length;

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
        {brandHearts > 0 && (
          <button
            type="button"
            onClick={() => router.push("/connections")}
            className="w-full text-right ig-gradient-bg text-white rounded-2xl p-3 mb-4 flex items-center gap-3 shadow-md"
          >
            <span className="text-2xl">💗</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold">{brandHearts === 1 ? "עסק אחד מתעניין בך!" : `${brandHearts} עסקים מתעניינים בך!`}</p>
              <p className="text-xs text-white/90">{locked ? "השלימו 5 סרטונים בתיק כדי לאשר" : "אשרו כדי לפתוח צ'אט ולקבל את המוצר"}</p>
            </div>
            <span className="text-sm font-medium">לצפייה ›</span>
          </button>
        )}
        {locked && (
          <button
            type="button"
            onClick={() => router.push("/profile")}
            className="w-full text-right bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-4 flex items-center gap-3"
          >
            <span className="text-2xl">🎬</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-amber-800">תיק העבודות: {portfolioCount}/{MIN_PORTFOLIO}</p>
              <p className="text-xs text-amber-700">העלו עוד {MIN_PORTFOLIO - (portfolioCount || 0)} סרטונים כדי לסמן לב ולפתוח פרטי מוצרים</p>
            </div>
            <span className="text-amber-600 text-sm font-medium">להעלאה ›</span>
          </button>
        )}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <ProductSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AnimatePresence mode="popLayout">
              {ordered.map((product) => (
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
                    relation={relations[product.id]}
                    locked={locked}
                    onApply={handleApply}
                    onApprove={handleApprove}
                    onOpenChat={(id) => router.push(`/messages?connection=${id}`)}
                    onOpen={(id) => router.push(`/products/${id}`)}
                    applying={applying}
                    approving={approving}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
        {!loading && ordered.length === 0 && (
          <div className="text-center py-20 text-neutral-400">
            <span className="text-4xl block mb-4">🔍</span>
            {effectiveCategory === FOR_YOU ? (
              <>
                <p>אין כרגע מוצרים בקטגוריות שלך</p>
                <Button variant="secondary" size="sm" rounded className="mt-4" onClick={() => setActiveCategory(ALL)}>
                  הצגת כל המוצרים
                </Button>
              </>
            ) : (
              <p>לא נמצאו מוצרים בקטגוריה זו</p>
            )}
          </div>
        )}
      </div>

      <Modal open={gateOpen} onClose={() => setGateOpen(false)} size="sm">
        <div className="text-center space-y-4">
          <span className="text-4xl block">🎬</span>
          <div>
            <h3 className="text-lg font-bold">עוד {Math.max(0, MIN_PORTFOLIO - (portfolioCount || 0))} סרטונים ואת/ה בפנים</h3>
            <p className="text-sm text-neutral-500 mt-1">
              תיק העבודות: {portfolioCount || 0}/{MIN_PORTFOLIO}. עסקים בוחרים יוצרים לפי התיק — {MIN_PORTFOLIO} סרטונים פותחים לבבות, פרטי מוצרים וצ&apos;אט.
            </p>
          </div>
          <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
            <div className="h-full bg-pink-500 rounded-full" style={{ width: `${Math.min(100, ((portfolioCount || 0) / MIN_PORTFOLIO) * 100)}%` }} />
          </div>
          <Button fullWidth onClick={() => router.push("/profile")}>להעלאת סרטונים</Button>
        </div>
      </Modal>
    </main>
  );
}
