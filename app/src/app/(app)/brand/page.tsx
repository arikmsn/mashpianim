"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, Badge, Button, Card, Modal, useToast } from "@/components/ui";
import { ProfileModal } from "@/components/features";
import { swrFetch, fetchJson } from "@/lib/client-cache";
import { createClient } from "@/lib/supabase/client";

interface CreatorCard {
  userId: string;
  profileId: string | null;
  name: string;
  avatar: string | null;
  city: string;
  bio: string;
  categories: string[];
  level: string;
  followers: number;
  completed: number;
  portfolioCount: number;
  portfolioReady: boolean;
  previewVideo: string | null;
  previewTitle: string | null;
  relation: { connectionId: string; status: string; initiatedBy: "creator" | "brand"; productId: string; productName: string } | null;
  fit: boolean;
  score: number;
}

interface BrandProduct {
  id: string;
  name: string;
  image_url: string | null;
  price: number;
  product_type: string;
  status: string;
}

type Filter = "all" | "fit" | "ready";

function formatFollowers(n: number) {
  if (!n) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

function DiscoverSkeleton() {
  return (
    <main className="min-h-screen bg-background pb-20">
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <div className="h-7 bg-neutral-200 rounded-lg w-40 animate-pulse mb-3" />
        <div className="flex gap-2 mb-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-8 w-28 rounded-full bg-neutral-100 animate-pulse" />)}
        </div>
        <div className="aspect-[3/4] max-h-[520px] rounded-3xl bg-pink-100 animate-pulse" />
      </div>
    </main>
  );
}

export default function BrandDiscoverPage() {
  const [creators, setCreators] = useState<CreatorCard[]>([]);
  const [products, setProducts] = useState<BrandProduct[]>([]);
  const [credits, setCredits] = useState<{ remaining: number; total: number }>({ remaining: 0, total: 0 });
  const [pendingFromCreators, setPendingFromCreators] = useState(0);
  const [activeMatches, setActiveMatches] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [index, setIndex] = useState(0);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [pickerFor, setPickerFor] = useState<CreatorCard | null>(null);
  const [pickedProduct, setPickedProduct] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [viewProfileId, setViewProfileId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const applyCreators = useCallback((data: { creators?: CreatorCard[] }) => {
    setCreators(data.creators || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    Promise.all([
      swrFetch("/api/creators", applyCreators),
      swrFetch<{ products?: BrandProduct[] }>("/api/products?brand=me", (d) =>
        setProducts((d.products || []).filter((p) => p.status === "active"))
      ),
      swrFetch<{ profile?: { total_credits?: number; used_credits?: number } }>("/api/profile", (d) => {
        const total = d.profile?.total_credits || 0;
        const used = d.profile?.used_credits || 0;
        setCredits({ total, remaining: Math.max(0, total - used) });
      }),
      swrFetch<{ connections?: Record<string, unknown>[] }>("/api/connections", (d) => {
        const conns = d.connections || [];
        setPendingFromCreators(conns.filter((c) => c.status === "pending" && c.initiated_by !== "brand").length);
        setActiveMatches(
          conns.filter((c) => ["approved", "shipped", "delivered", "filming", "uploaded", "in_review", "revision_requested"].includes(c.status as string)).length
        );
      }),
    ]).finally(() => setLoading(false));
  }, [applyCreators]);

  // Realtime: a creator answering a heart updates the cards
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("brand-discover")
      .on("postgres_changes", { event: "*", schema: "public", table: "connections" }, () => {
        fetchJson<{ creators?: CreatorCard[] }>("/api/creators").then((d) => d && applyCreators(d));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [applyCreators]);

  const visible = useMemo(() => {
    return creators.filter((c) => {
      if (filter === "fit" && !c.fit) return false;
      if (filter === "ready" && !c.portfolioReady) return false;
      return true;
    });
  }, [creators, filter]);

  const deck = useMemo(() => visible.filter((c) => !skipped.has(c.userId)), [visible, skipped]);
  const current = deck[Math.min(index, Math.max(0, deck.length - 1))];

  function next() {
    if (!current) return;
    setSkipped((prev) => new Set(prev).add(current.userId));
  }

  function openHeart(creator: CreatorCard) {
    if (creator.relation) {
      if (creator.relation.status === "pending" && creator.relation.initiatedBy === "creator") {
        router.push("/brand/connections");
      } else if (creator.relation.status === "pending") {
        toast(`כבר שלחתם לב ל${creator.name} על "${creator.relation.productName}"`, "info");
      } else {
        router.push(`/messages?connection=${creator.relation.connectionId}`);
      }
      return;
    }
    if (products.length === 0) {
      toast("הוסיפו מוצר ראשון כדי לשלוח לבבות", "info");
      router.push("/brand/products");
      return;
    }
    setPickedProduct(products.length === 1 ? products[0].id : null);
    setPickerFor(creator);
  }

  async function sendHeart() {
    if (!pickerFor || !pickedProduct) return;
    setSending(true);
    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: pickedProduct, creator_user_id: pickerFor.userId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const product = products.find((p) => p.id === pickedProduct);
        const relation = {
          connectionId: data.connection?.id as string,
          status: data.matched ? "approved" : "pending",
          initiatedBy: (data.matched ? "creator" : "brand") as "creator" | "brand",
          productId: pickedProduct,
          productName: product?.name || "",
        };
        setCreators((prev) => prev.map((c) => (c.userId === pickerFor.userId ? { ...c, relation } : c)));
        if (data.matched) {
          toast(`🎉 יש מאטץ' עם ${pickerFor.name}! הצ'אט נפתח`, "success");
          setCredits((c) => ({ ...c, remaining: Math.max(0, c.remaining - 1) }));
        } else {
          toast(`💗 הלב נשלח ל${pickerFor.name}. נעדכן אתכם כשיאשר/תאשר`, "success");
        }
        setPickerFor(null);
        setSkipped((prev) => new Set(prev).add(pickerFor.userId));
      } else {
        toast(data.error || "שגיאה בשליחת הלב", "error");
      }
    } catch {
      toast("שגיאה בשליחת הלב", "error");
    } finally {
      setSending(false);
    }
  }

  if (loading) return <DiscoverSkeleton />;

  const relationLabel = (c: CreatorCard) => {
    if (!c.relation) return null;
    if (c.relation.status === "pending" && c.relation.initiatedBy === "brand") return { text: "💗 הלב נשלח", tone: "bg-pink-500" };
    if (c.relation.status === "pending") return { text: "💗 סימן/ה אתכם", tone: "bg-amber-500" };
    return { text: "🎉 מאטץ'", tone: "bg-emerald-500" };
  };

  return (
    <main className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-neutral-100">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-xl font-bold">גלו יוצרים</h1>
              <p className="text-xs text-neutral-500">{creators.length} יוצרים · סמנו לב למי שמתאים לכם</p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/profile")}
              className={`text-xs font-bold px-3 py-1.5 rounded-full ${credits.remaining > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}
            >
              🎬 {credits.remaining} סרטונים
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {([
              { id: "all", label: "הכל" },
              { id: "fit", label: "✨ מתאימים לכם" },
              { id: "ready", label: "🎬 תיק מלא" },
            ] as { id: Filter; label: string }[]).map((f) => (
              <button
                key={f.id}
                onClick={() => { setFilter(f.id); setIndex(0); }}
                className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filter === f.id ? "bg-pink-500 text-white" : "bg-neutral-50 text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                {f.label}
              </button>
            ))}
            {pendingFromCreators > 0 && (
              <button
                onClick={() => router.push("/brand/connections")}
                className="whitespace-nowrap px-3.5 py-1.5 rounded-full text-sm font-bold ig-gradient-bg text-white"
              >
                💗 {pendingFromCreators} סימנו אתכם
              </button>
            )}
            {activeMatches > 0 && (
              <button
                onClick={() => router.push("/brand/connections")}
                className="whitespace-nowrap px-3.5 py-1.5 rounded-full text-sm font-medium bg-emerald-50 text-emerald-700"
              >
                🎉 {activeMatches} מאטצ&apos;ים פעילים
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4">
        {products.length === 0 && (
          <button
            type="button"
            onClick={() => router.push("/brand/products")}
            className="w-full text-right bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-4 flex items-center gap-3"
          >
            <span className="text-2xl">📦</span>
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-800">הוסיפו מוצר ראשון</p>
              <p className="text-xs text-amber-700">לב נשלח תמיד על מוצר מסוים — בלי מוצר אי אפשר לסמן</p>
            </div>
            <span className="text-amber-600 text-sm font-medium">להוספה ›</span>
          </button>
        )}

        {/* Card stack */}
        {current ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={current.userId}
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, x: -40 }}
              transition={{ duration: 0.2 }}
              className="relative rounded-3xl overflow-hidden bg-black shadow-xl aspect-[3/4] max-h-[560px] mx-auto"
            >
              {current.previewVideo ? (
                <video
                  key={current.previewVideo}
                  src={current.previewVideo}
                  className="absolute inset-0 w-full h-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                  controlsList="nodownload"
                  onContextMenu={(e) => e.preventDefault()}
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-pink-200 via-purple-200 to-amber-100 flex items-center justify-center">
                  <Avatar src={current.avatar} name={current.name} size="xl" className="w-32 h-32 text-4xl" />
                </div>
              )}

              <div className="absolute top-3 right-3 left-3 flex items-start justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {current.fit && (
                    <span className="bg-white/90 text-pink-600 text-xs font-bold px-2.5 py-1 rounded-full">✨ מתאים לכם</span>
                  )}
                  <span className={`text-white text-xs font-bold px-2.5 py-1 rounded-full ${current.portfolioReady ? "bg-emerald-500/90" : "bg-amber-500/90"}`}>
                    🎬 {current.portfolioCount} סרטונים{!current.portfolioReady ? ` · תיק בבנייה` : ""}
                  </span>
                </div>
                {relationLabel(current) && (
                  <span className={`text-white text-xs font-bold px-2.5 py-1 rounded-full ${relationLabel(current)!.tone}`}>
                    {relationLabel(current)!.text}
                  </span>
                )}
              </div>

              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-4 pt-16 text-white">
                <button type="button" onClick={() => setViewProfileId(current.userId)} className="flex items-center gap-3 text-right w-full">
                  <Avatar src={current.avatar} name={current.name} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-lg truncate">{current.name}</p>
                    <p className="text-xs text-white/80 truncate">
                      {[current.city, formatFollowers(current.followers) && `${formatFollowers(current.followers)} עוקבים`, current.completed > 0 && `${current.completed} שיתופי פעולה`]
                        .filter(Boolean)
                        .join(" · ") || "יוצר/ת חדש/ה"}
                    </p>
                  </div>
                  <span className="text-xs text-white/70">פרופיל ›</span>
                </button>
                {current.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {current.categories.slice(0, 4).map((cat) => (
                      <span key={cat} className="text-[11px] bg-white/20 px-2 py-0.5 rounded-full">{cat}</span>
                    ))}
                  </div>
                )}
                {current.bio && <p className="text-xs text-white/85 mt-2 line-clamp-2">{current.bio}</p>}
              </div>
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="text-center py-16 text-neutral-400 bg-white rounded-3xl border border-neutral-100">
            <span className="text-4xl block mb-3">🎉</span>
            <p className="font-medium text-neutral-600">עברתם על כל היוצרים בסינון הזה</p>
            <p className="text-xs mt-1">נסו סינון אחר או חזרו מחר — יוצרים חדשים מצטרפים כל הזמן</p>
            <Button size="sm" variant="secondary" className="mt-4" onClick={() => { setSkipped(new Set()); setIndex(0); }}>
              להתחיל מחדש
            </Button>
          </div>
        )}

        {current && (
          <div className="flex items-center justify-center gap-5 mt-4">
            <button
              type="button"
              onClick={next}
              aria-label="הבא"
              className="w-14 h-14 rounded-full bg-white border border-neutral-200 shadow-md flex items-center justify-center text-2xl text-neutral-500 hover:bg-neutral-50 active:scale-95 transition-all"
            >
              ✕
            </button>
            <button
              type="button"
              onClick={() => openHeart(current)}
              aria-label="לב"
              className={`w-20 h-20 rounded-full shadow-lg flex items-center justify-center text-4xl active:scale-95 transition-all ${
                current.relation ? "bg-white border-2 border-pink-300" : "ig-gradient-bg text-white"
              }`}
            >
              {current.relation ? (current.relation.status === "pending" ? "💗" : "💬") : "❤️"}
            </button>
            <button
              type="button"
              onClick={() => setViewProfileId(current.userId)}
              aria-label="פרופיל"
              className="w-14 h-14 rounded-full bg-white border border-neutral-200 shadow-md flex items-center justify-center text-xl hover:bg-neutral-50 active:scale-95 transition-all"
            >
              👤
            </button>
          </div>
        )}

        {/* Everyone, at a glance */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold">כל היוצרים ({visible.length})</h2>
            <button onClick={() => setShowAll((v) => !v)} className="text-sm text-pink-500 font-medium">
              {showAll ? "הסתרה" : "הצגה"}
            </button>
          </div>
          {showAll && (
            <div className="grid grid-cols-3 gap-2">
              {visible.map((c) => (
                <button
                  key={c.userId}
                  type="button"
                  onClick={() => {
                    setSkipped((prev) => {
                      const nextSet = new Set(prev);
                      nextSet.delete(c.userId);
                      return nextSet;
                    });
                    const pos = deck.findIndex((d) => d.userId === c.userId);
                    setIndex(pos >= 0 ? pos : 0);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="relative rounded-2xl overflow-hidden bg-neutral-100 aspect-[3/4] text-right"
                >
                  {c.previewVideo ? (
                    <video src={c.previewVideo} className="absolute inset-0 w-full h-full object-cover" muted playsInline preload="metadata" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-pink-100 to-purple-100">
                      <Avatar src={c.avatar} name={c.name} size="lg" />
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-white">
                    <p className="text-xs font-bold truncate">{c.name}</p>
                    <p className="text-[10px] text-white/80">🎬 {c.portfolioCount}{c.fit ? " · ✨" : ""}</p>
                  </div>
                  {relationLabel(c) && (
                    <span className={`absolute top-1.5 right-1.5 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ${relationLabel(c)!.tone}`}>
                      {relationLabel(c)!.text}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <Card padding="sm" className="mt-6">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-sm">🎬 {credits.remaining} מתוך {credits.total} סרטונים נותרים</span>
            <Button size="sm" variant="secondary" onClick={() => toast("רכישת סרטונים תהיה זמינה בקרוב — בינתיים פנו אלינו", "info")}>
              רכישה
            </Button>
          </div>
        </Card>
      </div>

      {/* Product picker */}
      <Modal open={!!pickerFor} onClose={() => setPickerFor(null)} title={pickerFor ? `לב ל${pickerFor.name}` : "לב"} size="sm">
        {pickerFor && (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">על איזה מוצר? היוצר/ת יראה/תראה את המוצר ואת הבריף, ובאישור ייפתח צ&apos;אט ויירד קרדיט אחד.</p>
            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {products.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPickedProduct(p.id)}
                  className={`w-full flex items-center gap-3 p-2 rounded-xl border text-right transition-colors ${
                    pickedProduct === p.id ? "border-pink-500 bg-pink-50" : "border-neutral-100 hover:border-pink-200"
                  }`}
                >
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="w-12 h-12 rounded-lg object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-neutral-100 flex items-center justify-center">{p.product_type === "digital" ? "📱" : "📦"}</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-neutral-500">₪{Number(p.price) || 0}</p>
                  </div>
                  {pickedProduct === p.id && <Badge variant="pink" size="sm">נבחר</Badge>}
                </button>
              ))}
            </div>
            {credits.remaining === 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2">
                אין לכם סרטונים נותרים — הלב יישלח, אבל המאטץ&apos; ייפתח רק אחרי שיתווספו סרטונים.
              </p>
            )}
            <div className="flex gap-2">
              <Button fullWidth loading={sending} disabled={!pickedProduct} onClick={sendHeart}>
                ❤️ שליחת לב
              </Button>
              <Button variant="ghost" onClick={() => setPickerFor(null)}>ביטול</Button>
            </div>
          </div>
        )}
      </Modal>

      <ProfileModal userId={viewProfileId} onClose={() => setViewProfileId(null)} title="פרופיל היוצר/ת" />
    </main>
  );
}
