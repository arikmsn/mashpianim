"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import { Avatar, Badge, Button, Modal, useToast } from "@/components/ui";
import { useAuth } from "@/hooks/use-auth";
import { useNotifications } from "@/hooks/use-notifications";
import { createClient } from "@/lib/supabase/client";
import { swrFetch, fetchJson } from "@/lib/client-cache";
import { toDirectImageUrl } from "@/lib/images";
import { REGISTRATION_TO_FEED, displayCategory } from "@/lib/categories";

interface Product {
  id: string;
  name: string;
  brand: string;
  brandAvatar: string | null;
  brandUserId: string | null;
  image: string | null;
  category: string;
  categoryLabel: string;
  region: string;
  value: number;
  description: string;
  productType: string;
  deadline: number;
  createdAt: string;
}

interface Relation {
  connectionId: string;
  status: string;
  initiatedBy: "creator" | "brand";
  mutualAt: string | null;
  approvedAt: string | null;
  product: { id: string; name: string; image: string | null; value: number; brand: string };
}

type View = "all" | "mine";

const MIN_PORTFOLIO = 5;
const SWIPE_THRESHOLD = 70;

const placeholderColors = [
  "from-pink-200 to-pink-300",
  "from-purple-200 to-purple-300",
  "from-blue-200 to-blue-300",
  "from-emerald-200 to-emerald-300",
  "from-amber-200 to-amber-300",
  "from-rose-200 to-rose-300",
];

function placeholderFor(id: string) {
  return placeholderColors[parseInt(id.replace(/\D/g, "").slice(-4) || "0", 10) % placeholderColors.length];
}

function relationLabel(r: Relation): { text: string; tone: string } {
  if (r.status === "pending" && r.mutualAt) return { text: "🎉 מאטץ' — ממתין לאישור העסק", tone: "bg-emerald-500" };
  if (r.status === "pending" && r.initiatedBy === "creator") return { text: "❤️ נשלח — ממתין לעסק", tone: "bg-pink-500" };
  if (r.status === "pending") return { text: "💗 העסק סימן אותך", tone: "bg-amber-500" };
  if (r.status === "completed") return { text: "✅ הושלם", tone: "bg-neutral-500" };
  return { text: "🎉 פעיל", tone: "bg-emerald-600" };
}

// Chevrons as SVG: the ‹ › characters are bidi-mirrored in RTL text and ended up pointing the wrong way
function ChevronRight() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}
function ChevronLeft() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function FeedSkeleton() {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex-1 min-h-0 rounded-3xl bg-pink-100 animate-pulse" />
      <div className="flex justify-center gap-5 pt-3">
        {[1, 2, 3].map((i) => <div key={i} className="w-14 h-14 rounded-full bg-neutral-100 animate-pulse" />)}
      </div>
    </div>
  );
}

export default function FeedPage() {
  const [view, setView] = useState<View>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [portfolioCount, setPortfolioCount] = useState<number | null>(null);
  const [userCategories, setUserCategories] = useState<string[]>([]);
  const [relations, setRelations] = useState<Record<string, Relation>>({});
  const [gateOpen, setGateOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [regionFilter, setRegionFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<"" | "physical" | "digital">("");
  const [index, setIndex] = useState(0);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [busy, setBusy] = useState<string | null>(null);
  // The deck is painted only once products, the profile and the relations are all in
  const [profileReady, setProfileReady] = useState(false);
  const [relationsReady, setRelationsReady] = useState(false);
  const dragging = useRef(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const { unreadCount } = useNotifications();
  const router = useRouter();

  useEffect(() => {
    swrFetch<{ user?: { type?: string }; role?: string; profile?: { categories?: string[]; category?: string; portfolio_count?: number } }>(
      "/api/profile",
      (data) => {
        // The feed is the creator home; a session signed in as a brand belongs on /brand
        const role = data.role || data.user?.type;
        if (role === "brand") {
          router.replace("/brand");
          return;
        }
        const profile = data.profile || {};
        setUserCategories(profile.categories || (profile.category ? [profile.category] : []));
        if (role === "creator") {
          setPortfolioCount(typeof profile.portfolio_count === "number" ? profile.portfolio_count : 0);
        }
        setProfileReady(true);
      }
    ).then((fresh) => {
      if (fresh === null) setProfileReady(true); // offline / error: don't block the screen
    });
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
        categoryLabel: displayCategory(p.category, p.category_custom),
        region: (p.brand_region as string) || "",
        value: Number(p.price) || 0,
        description: (p.description as string) || "",
        productType: (p.product_type as string) || "physical",
        deadline: (p.film_deadline_days as number) || 10,
        createdAt: (p.created_at as string) || "",
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
      if (["cancelled", "rejected"].includes(status)) continue;
      const pid = c.product_id as string;
      if (!pid || map[pid]) continue;
      const prod = (c.products as Record<string, unknown> | null) || {};
      const bp = (c.brand_profiles as Record<string, unknown> | null) || {};
      map[pid] = {
        connectionId: c.id as string,
        status,
        initiatedBy: c.initiated_by === "brand" ? "brand" : "creator",
        mutualAt: (c.mutual_at as string) || null,
        approvedAt: (c.approved_at as string) || null,
        product: {
          id: pid,
          name: (prod.name as string) || "מוצר",
          image: toDirectImageUrl((prod.image_url as string) || null),
          value: Number(prod.price) || 0,
          brand: (bp.shop_name as string) || "",
        },
      };
    }
    setRelations(map);
    setRelationsReady(true);
  }, []);

  useEffect(() => {
    if (!user) return;
    swrFetch("/api/connections", applyRelations).then((fresh) => {
      if (fresh === null) setRelationsReady(true);
    });
  }, [user, applyRelations]);

  // Realtime: a brand answering updates the cards
  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    const channel = supabase
      .channel("feed-relations")
      .on("postgres_changes", { event: "*", schema: "public", table: "connections" }, () => {
        fetchJson<{ connections?: Record<string, unknown>[] }>("/api/connections").then((d) => d && applyRelations(d));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, applyRelations]);

  const ready = !loading && profileReady && (relationsReady || !user);
  const locked = portfolioCount !== null && portfolioCount < MIN_PORTFOLIO;

  // Only categories and regions that actually have products are offered as filters
  const availableCategories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) counts.set(p.category || "כללי", (counts.get(p.category || "כללי") || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([cat]) => cat);
  }, [products]);
  const availableRegions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) if (p.region) counts.set(p.region, (counts.get(p.region) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([region]) => region);
  }, [products]);
  const activeFilterCount = categoryFilter.length + regionFilter.length + (typeFilter ? 1 : 0);

  const ownFeedCategories = useMemo<string[]>(() => userCategories.map((c) => REGISTRATION_TO_FEED[c] || c), [userCategories]);

  // The deck: products with no open relation, matching the filters; own categories first, then newest
  const query = searchQuery.trim().toLowerCase();
  const deck = useMemo(() => {
    const fits = (p: Product) => ownFeedCategories.includes(p.category);
    return products
      .filter((p) => !relations[p.id] || relations[p.id].status === "completed")
      .filter((p) => categoryFilter.length === 0 || categoryFilter.includes(p.category || "כללי"))
      .filter((p) => regionFilter.length === 0 || regionFilter.includes(p.region))
      .filter((p) => !typeFilter || p.productType === typeFilter)
      .filter((p) => !query || p.name.toLowerCase().includes(query) || p.brand.toLowerCase().includes(query))
      .sort((a, b) => Number(fits(b)) - Number(fits(a)) || b.createdAt.localeCompare(a.createdAt));
  }, [products, relations, categoryFilter, regionFilter, typeFilter, query, ownFeedCategories]);

  const picks = useMemo(
    () => Object.values(relations).filter((r) => r.initiatedBy === "creator" || !!r.mutualAt || r.status !== "pending"),
    [relations]
  );
  const brandHearts = Object.values(relations).filter((r) => r.status === "pending" && r.initiatedBy === "brand" && !r.mutualAt).length;

  const currentIndex = (() => {
    if (deck.length === 0) return 0;
    const byId = currentId ? deck.findIndex((p) => p.id === currentId) : -1;
    return byId >= 0 ? byId : Math.min(index, deck.length - 1);
  })();
  const current = deck[currentIndex];
  const currentProductId = current?.id ?? null;

  // The details page of the card on screen is fetched ahead of the tap: the route shell (Next prefetch) and
  // the product payload (client cache), so "פרטים" opens instantly instead of waiting on two round trips
  useEffect(() => {
    if (!currentProductId || !user) return;
    router.prefetch(`/products/${currentProductId}`);
    swrFetch(`/api/products/${currentProductId}`, () => {});
  }, [currentProductId, user, router]);

  function goTo(nextIndex: number, dir: 1 | -1) {
    if (deck.length === 0) return;
    const wrapped = ((nextIndex % deck.length) + deck.length) % deck.length;
    setDirection(dir);
    setIndex(wrapped);
    setCurrentId(deck[wrapped]?.id ?? null);
  }
  const next = () => goTo(currentIndex + 1, 1);
  const prev = () => goTo(currentIndex - 1, -1);
  function onDragEnd(_: unknown, info: PanInfo) {
    dragging.current = false;
    if (info.offset.x < -SWIPE_THRESHOLD) next();
    else if (info.offset.x > SWIPE_THRESHOLD) prev();
  }
  // After ❤️/✕ the card leaves the deck; stay on the same slot so the next product slides in
  function keepSlot() {
    setCurrentId(null);
    setIndex(currentIndex);
  }

  // ❤️ — a heart on the product (needs the 5-video portfolio: the gate modal explains and leads to the upload)
  async function heart(product: Product) {
    if (!user) {
      router.push("/login?redirect=/feed");
      return;
    }
    if (locked) {
      setGateOpen(true);
      return;
    }
    setBusy(product.id);
    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: product.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const connectionId = data.connection?.id as string;
        toast(data.mutual ? "🎉 יש מאטץ'! העסק יאשר את החיבור ואז ייפתח הצ'אט" : "❤️ הלב נשלח! נעדכן אותך כשהעסק יאשר", "success");
        setRelations((prev) => ({
          ...prev,
          [product.id]: {
            connectionId,
            status: "pending",
            initiatedBy: data.mutual ? "brand" : "creator",
            mutualAt: data.mutual ? new Date().toISOString() : null,
            approvedAt: null,
            product: { id: product.id, name: product.name, image: product.image, value: product.value, brand: product.brand },
          },
        }));
        keepSlot();
      } else if (data.code === "portfolio_gate") {
        setPortfolioCount(typeof data.count === "number" ? data.count : 0);
        setGateOpen(true);
      } else {
        toast(data.error || "שגיאה בשליחת הלב", "error");
      }
    } catch {
      toast("שגיאה בשליחת הלב", "error");
    } finally {
      setBusy(null);
    }
  }

  // ✕ — not interested: the product never comes back
  async function pass(product: Product) {
    if (!user) {
      router.push("/login?redirect=/feed");
      return;
    }
    setBusy(product.id);
    try {
      const res = await fetch("/api/products/pass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: product.id }),
      });
      if (res.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== product.id));
        keepSlot();
      } else {
        toast("לא הצלחנו לשמור את הדילוג", "error");
      }
    } catch {
      toast("לא הצלחנו לשמור את הדילוג", "error");
    } finally {
      setBusy(null);
    }
  }

  async function resetPasses() {
    const res = await fetch("/api/products/pass", { method: "DELETE" });
    if (res.ok) {
      toast("המוצרים שדילגת עליהם חזרו", "success");
      const d = await fetchJson<{ products?: Record<string, unknown>[] }>("/api/products?status=active");
      if (d) applyProducts(d);
      setIndex(0);
      setCurrentId(null);
    } else {
      toast("שגיאה באיפוס", "error");
    }
  }

  // Withdraw a heart the brand has not answered yet
  async function cancelHeart(r: Relation) {
    setBusy(r.connectionId);
    try {
      const res = await fetch(`/api/connections/${r.connectionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (res.ok) {
        toast("הלב בוטל", "info");
        setRelations((prev) => {
          const next = { ...prev };
          delete next[r.product.id];
          return next;
        });
      } else {
        const data = await res.json().catch(() => ({}));
        toast((data as { error?: string }).error || "שגיאה בביטול", "error");
      }
    } catch {
      toast("שגיאה בביטול", "error");
    } finally {
      setBusy(null);
    }
  }

  const toggleIn = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  const detailsHref = current ? `/products/${current.id}` : "/feed";

  return (
    // One screen, no page scroll (Tinder-like): header, the strip, the card, the three buttons — all inside the viewport
    <main className="h-[calc(100dvh-5rem)] flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="shrink-0 z-30 bg-white/80 backdrop-blur-xl border-b border-neutral-100">
        <div className="max-w-2xl mx-auto px-4 py-2.5">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="חיפוש מוצרים..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setIndex(0); setCurrentId(null); }}
                className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-neutral-50 border border-neutral-100 text-sm outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-500/10 transition-all"
              />
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              aria-label="סינון"
              className={`relative p-2.5 rounded-xl border text-sm transition-colors ${activeFilterCount > 0 ? "bg-pink-50 border-pink-200 text-pink-600" : "bg-neutral-50 border-neutral-100 text-neutral-500 hover:bg-neutral-100"}`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              {activeFilterCount > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-pink-500 ring-2 ring-white" aria-hidden="true" />}
            </button>
            <Link href="/notifications" className="relative p-2.5 rounded-xl bg-neutral-50 border border-neutral-100 text-neutral-500 hover:bg-neutral-100 transition-colors" aria-label="התראות">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

          <div className="flex gap-2">
            {([
              { id: "all", label: "כל המוצרים" },
              { id: "mine", label: `❤️ המוצרים שבחרתי${picks.length > 0 ? ` (${picks.length})` : ""}` },
            ] as { id: View; label: string }[]).map((v) => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  view === v.id ? "bg-pink-500 text-white" : "bg-neutral-50 text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 w-full max-w-2xl mx-auto px-4 pt-3 pb-1 flex flex-col">
        {ready && brandHearts > 0 && (
          <button
            type="button"
            onClick={() => router.push("/connections")}
            className="shrink-0 w-full text-right ig-gradient-bg text-white rounded-2xl px-3 py-2 mb-3 flex items-center gap-3 shadow-md"
          >
            <span className="text-xl">💗</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{brandHearts === 1 ? "עסק אחד מתעניין בך!" : `${brandHearts} עסקים מתעניינים בך!`}</p>
              <p className="text-[11px] text-white/90 truncate">{locked ? "השלימו 5 סרטונים בתיק כדי לאשר" : "אשרו בחיבורים ← העסק יאשר סופית ויפתח צ'אט"}</p>
            </div>
            <span className="text-sm font-medium whitespace-nowrap">לצפייה ›</span>
          </button>
        )}

        {!ready ? (
          <FeedSkeleton />
        ) : view === "mine" ? (
          <div className="flex-1 min-h-0 overflow-y-auto -mx-4 px-4 pb-4">
            {picks.length === 0 ? (
              <div className="text-center py-20 text-neutral-400">
                <span className="text-4xl block mb-4">❤️</span>
                <p>עדיין לא סימנת לב לאף מוצר</p>
                <p className="text-xs mt-1">לב מהקרוסלה יופיע כאן</p>
                <Button variant="secondary" size="sm" rounded className="mt-4" onClick={() => setView("all")}>לכל המוצרים</Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {picks.map((r) => {
                  const label = relationLabel(r);
                  const canCancel = r.status === "pending" && r.initiatedBy === "creator" && !r.mutualAt;
                  return (
                    <div key={r.connectionId} className="relative rounded-2xl overflow-hidden bg-white border border-neutral-100 shadow-sm">
                      <Link href={`/products/${r.product.id}`} className="block w-full text-right">
                        {r.product.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.product.image} alt={r.product.name} loading="lazy" className="w-full aspect-square object-cover" />
                        ) : (
                          <div className={`w-full aspect-square bg-gradient-to-br ${placeholderFor(r.product.id)} flex items-center justify-center`}>
                            <span className="text-4xl opacity-50">📦</span>
                          </div>
                        )}
                        <div className="p-2.5">
                          <p className="text-sm font-bold truncate">{r.product.name}</p>
                          <p className="text-xs text-neutral-500 truncate">{r.product.brand} · ₪{r.product.value}</p>
                          <span className={`inline-block mt-1.5 text-[10px] font-bold text-white px-2 py-0.5 rounded-full ${label.tone}`}>{label.text}</span>
                        </div>
                      </Link>
                      {/* Lit heart = a product you already chose */}
                      <span className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 shadow flex items-center justify-center text-base" aria-label="סימנת לב">❤️</span>
                      {canCancel && (
                        <button
                          type="button"
                          onClick={() => cancelHeart(r)}
                          disabled={busy === r.connectionId}
                          className="absolute top-2 left-2 px-2 py-1 rounded-full bg-white/90 text-[10px] text-neutral-500 shadow hover:text-red-500 disabled:opacity-50"
                        >
                          ביטול הלב
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : current ? (
          <>
            <div className="relative flex-1 min-h-0">
              <AnimatePresence mode="wait" initial={false} custom={direction}>
                <motion.div
                  key={current.id}
                  custom={direction}
                  initial={{ opacity: 0, x: direction * -60 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction * 60 }}
                  transition={{ duration: 0.18 }}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.6}
                  onDragStart={() => { dragging.current = true; }}
                  onDragEnd={onDragEnd}
                  className="absolute inset-0 rounded-3xl overflow-hidden bg-white shadow-xl border border-neutral-100 touch-pan-y select-none flex flex-col"
                >
                  <Link
                    href={detailsHref}
                    prefetch
                    draggable={false}
                    onClick={(e) => { if (dragging.current) e.preventDefault(); }}
                    className="relative block flex-1 min-h-[120px]"
                  >
                    {current.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={current.image} alt={current.name} draggable={false} className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
                    ) : (
                      <div className={`absolute inset-0 bg-gradient-to-br ${placeholderFor(current.id)} flex items-center justify-center`}>
                        <span className="text-6xl opacity-50">📦</span>
                      </div>
                    )}
                    <div className="absolute top-3 right-3 flex flex-wrap gap-1.5">
                      {ownFeedCategories.includes(current.category) && (
                        <span className="bg-white/90 text-pink-600 text-xs font-bold px-2.5 py-1 rounded-full">✨ מתאים לך</span>
                      )}
                      {current.categoryLabel && <span className="bg-black/50 text-white text-xs px-2.5 py-1 rounded-full">{current.categoryLabel}</span>}
                      {current.region && <span className="bg-black/50 text-white text-xs px-2.5 py-1 rounded-full">📍 {current.region}</span>}
                    </div>
                  </Link>
                  <div className="shrink-0 p-3.5 space-y-1.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="text-lg font-bold text-neutral-900 truncate leading-tight">{current.name}</h2>
                        <Link href={detailsHref} prefetch className="flex items-center gap-2 mt-1 text-sm text-neutral-500">
                          <Avatar src={current.brandAvatar} name={current.brand} size="sm" />
                          <span className="truncate">{current.brand}</span>
                        </Link>
                      </div>
                      <Badge variant="pink" size="lg">₪{current.value}</Badge>
                    </div>
                    {locked ? (
                      <p className="text-sm text-neutral-400 line-clamp-2">🔒 {MIN_PORTFOLIO} סרטונים בתיק פותחים את פרטי המוצר והבריף</p>
                    ) : (
                      <p className="text-sm text-neutral-600 line-clamp-2">{current.description || "העסק לא הוסיף תיאור — הפרטים והבריף בדף המוצר"}</p>
                    )}
                    <p className="text-xs text-neutral-400">
                      {current.productType === "digital" ? "📱 מוצר דיגיטלי" : "📦 מוצר פיזי"} · ⏱ {current.deadline} ימים לצילום
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>
              {deck.length > 1 && (
                <>
                  <button type="button" onClick={prev} aria-label="הקודם" className="absolute right-1 top-1/3 w-9 h-9 rounded-full bg-white/85 text-neutral-700 shadow flex items-center justify-center hover:bg-white">
                    <ChevronRight />
                  </button>
                  <button type="button" onClick={next} aria-label="הבא" className="absolute left-1 top-1/3 w-9 h-9 rounded-full bg-white/85 text-neutral-700 shadow flex items-center justify-center hover:bg-white">
                    <ChevronLeft />
                  </button>
                </>
              )}
            </div>

            <div className="shrink-0 flex items-center justify-center gap-5 pt-3">
              <button
                type="button"
                onClick={() => pass(current)}
                disabled={busy === current.id}
                aria-label="לא מעוניין/ת"
                title="לא מעוניין/ת — המוצר לא יוצג שוב"
                className="w-14 h-14 rounded-full bg-white border border-neutral-200 shadow-md flex items-center justify-center text-2xl text-neutral-500 hover:bg-neutral-50 active:scale-95 transition-all disabled:opacity-40"
              >
                ✕
              </button>
              <button
                type="button"
                onClick={() => heart(current)}
                disabled={busy === current.id}
                aria-label="מעוניין/ת"
                className="w-[4.5rem] h-[4.5rem] rounded-full shadow-lg flex items-center justify-center text-4xl active:scale-95 transition-all ig-gradient-bg text-white disabled:opacity-60"
              >
                {locked ? "🔒" : "❤️"}
              </button>
              <Link
                href={detailsHref}
                prefetch
                aria-label="פרטים"
                className="w-14 h-14 rounded-full bg-white border border-neutral-200 shadow-md flex items-center justify-center text-xs font-bold text-neutral-600 hover:bg-neutral-50 active:scale-95 transition-all"
              >
                פרטים
              </Link>
            </div>
            <p className="shrink-0 text-center text-[11px] text-neutral-400 pt-1.5">
              החליקו כדי לדפדף · ❤️ מעוניין/ת · ✕ לא מעוניין/ת · {currentIndex + 1}/{deck.length}
            </p>
          </>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center text-neutral-400 bg-white rounded-3xl border border-neutral-100 px-4">
            <span className="text-4xl block mb-3">🎉</span>
            <p className="font-medium text-neutral-600">{activeFilterCount > 0 || query ? "אין מוצרים שמתאימים לסינון" : "עברת על כל המוצרים"}</p>
            <p className="text-xs mt-1">{activeFilterCount > 0 || query ? "נסו סינון אחר" : "מוצרים חדשים מצטרפים כל הזמן — חזרו מחר"}</p>
            <div className="flex justify-center gap-2 mt-4">
              {(activeFilterCount > 0 || query) && (
                <Button size="sm" variant="secondary" onClick={() => { setCategoryFilter([]); setRegionFilter([]); setTypeFilter(""); setSearchQuery(""); }}>
                  ניקוי הסינון
                </Button>
              )}
              {user && <Button size="sm" variant="ghost" onClick={resetPasses}>להחזיר מוצרים שדילגת עליהם</Button>}
            </div>
          </div>
        )}
      </div>

      {/* Full filter: categories and regions that have products, product type (no counts — the deck is what it is) */}
      <Modal open={filtersOpen} onClose={() => setFiltersOpen(false)} title="סינון" size="md">
        <div className="space-y-5">
          <div>
            <p className="text-sm font-bold text-neutral-900 mb-2">קטגוריות</p>
            <div className="flex flex-wrap gap-2">
              {availableCategories.map((cat) => {
                const active = categoryFilter.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setCategoryFilter((prev) => toggleIn(prev, cat))}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-all ${active ? "bg-pink-500 border-pink-500 text-white" : "bg-neutral-50 border-neutral-200 text-neutral-600"}`}
                  >
                    {cat}
                  </button>
                );
              })}
              {availableCategories.length === 0 && <p className="text-xs text-neutral-400">אין מוצרים כרגע</p>}
            </div>
          </div>
          <div>
            <p className="text-sm font-bold text-neutral-900 mb-2">אזור בארץ</p>
            {availableRegions.length === 0 ? (
              <p className="text-xs text-neutral-400">העסקים עדיין לא ציינו אזור</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availableRegions.map((region) => {
                  const active = regionFilter.includes(region);
                  return (
                    <button
                      key={region}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setRegionFilter((prev) => toggleIn(prev, region))}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-all ${active ? "bg-pink-500 border-pink-500 text-white" : "bg-neutral-50 border-neutral-200 text-neutral-600"}`}
                    >
                      📍 {region}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div>
            <p className="text-sm font-bold text-neutral-900 mb-2">סוג מוצר</p>
            <div className="flex gap-2">
              {([
                { id: "", label: "הכל" },
                { id: "physical", label: "📦 פיזי" },
                { id: "digital", label: "📱 דיגיטלי" },
              ] as { id: "" | "physical" | "digital"; label: string }[]).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTypeFilter(t.id)}
                  className={`flex-1 py-2 rounded-xl text-sm border transition-all ${typeFilter === t.id ? "bg-pink-50 border-pink-300 text-pink-600" : "bg-neutral-50 border-neutral-200 text-neutral-600"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button fullWidth onClick={() => { setFiltersOpen(false); setIndex(0); setCurrentId(null); }}>הצגת המוצרים</Button>
            <Button variant="ghost" onClick={() => { setCategoryFilter([]); setRegionFilter([]); setTypeFilter(""); }}>ניקוי</Button>
          </div>
        </div>
      </Modal>

      {/* The 5-video gate, explained where the tap happened, with the way to the upload */}
      <Modal open={gateOpen} onClose={() => setGateOpen(false)} size="sm">
        <div className="text-center space-y-4">
          <span className="text-4xl block">🎬</span>
          <div>
            <h3 className="text-lg font-bold">כדי לסמן לב צריך {MIN_PORTFOLIO} סרטונים בתיק העבודות</h3>
            <p className="text-sm text-neutral-500 mt-1">
              יש לך {portfolioCount || 0}/{MIN_PORTFOLIO}. עסקים בוחרים יוצרים לפי התיק — עוד {Math.max(0, MIN_PORTFOLIO - (portfolioCount || 0))} סרטונים ואת/ה בפנים.
            </p>
          </div>
          <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
            <div className="h-full bg-pink-500 rounded-full" style={{ width: `${Math.min(100, ((portfolioCount || 0) / MIN_PORTFOLIO) * 100)}%` }} />
          </div>
          <Button fullWidth onClick={() => router.push("/profile?onboarding=1")}>🎬 להעלאת סרטון</Button>
          <button type="button" onClick={() => setGateOpen(false)} className="text-sm text-neutral-400">אחר כך</button>
        </div>
      </Modal>
    </main>
  );
}
