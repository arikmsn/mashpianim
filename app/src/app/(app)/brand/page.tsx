"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import { Avatar, Badge, Button, Card, Modal, useToast } from "@/components/ui";
import { ProfileModal, CreditsAccess } from "@/components/features";
import { swrFetch, fetchJson } from "@/lib/client-cache";
import { CREDITS_CONTACT_NOTICE, creditsCardHint } from "@/lib/credits";
import { toDirectImageUrl } from "@/lib/images";
import { createClient } from "@/lib/supabase/client";

interface Relation {
  connectionId: string;
  status: string;
  initiatedBy: "creator" | "brand";
  mutualAt: string | null;
  productId: string;
  productName: string;
}

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
  previewPoster: string | null;
  previewTitle: string | null;
  relation: Relation | null;
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

type Filter = "all" | "fit" | "liked";

const SWIPE_THRESHOLD = 70;

function formatFollowers(n: number) {
  if (!n) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

// A creator the brand already acted on (hearted, mutual, matched) leaves the deck — like a swipe app
function likedByBrand(c: CreatorCard): boolean {
  const r = c.relation;
  if (!r) return false;
  if (r.status !== "pending") return true;
  return r.initiatedBy === "brand" || !!r.mutualAt;
}

function relationLabel(c: CreatorCard): { text: string; tone: string } | null {
  const r = c.relation;
  if (!r) return null;
  if (r.status === "pending" && r.mutualAt) return { text: "🎉 מאטץ' — ממתין לאישורכם", tone: "bg-emerald-500" };
  if (r.status === "pending" && r.initiatedBy === "brand") return { text: "💗 הלב נשלח", tone: "bg-pink-500" };
  if (r.status === "pending") return { text: "💗 בחר/ה בכם", tone: "bg-amber-500" };
  return { text: "🎉 מאטץ' פעיל", tone: "bg-emerald-600" };
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

function Thumb({ c, onClick }: { c: CreatorCard; onClick: () => void }) {
  const label = relationLabel(c);
  return (
    <button type="button" onClick={onClick} className="relative rounded-2xl overflow-hidden bg-neutral-100 aspect-[3/4] text-right">
      {c.previewPoster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.previewPoster} alt="" loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-pink-100 to-purple-100">
          <Avatar src={c.avatar} name={c.name} size="lg" />
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-white">
        <p className="text-xs font-bold truncate">{c.name}</p>
        <p className="text-[10px] text-white/80 truncate">{[c.city, c.fit ? "✨ מתאים" : ""].filter(Boolean).join(" · ") || "יוצר/ת"}</p>
      </div>
      {label && (
        <span className={`absolute top-1.5 right-1.5 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ${label.tone}`}>{label.text}</span>
      )}
    </button>
  );
}

export default function BrandDiscoverPage() {
  const [creators, setCreators] = useState<CreatorCard[]>([]);
  const [products, setProducts] = useState<BrandProduct[]>([]);
  const [credits, setCredits] = useState<{ remaining: number; total: number }>({ remaining: 0, total: 0 });
  const [choseYou, setChoseYou] = useState(0);
  const [matchesWaiting, setMatchesWaiting] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [index, setIndex] = useState(0);
  // Deck position is kept by creator id, so a refresh (realtime) never jumps to another card
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [pickerFor, setPickerFor] = useState<CreatorCard | null>(null);
  const [pickedProduct, setPickedProduct] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [passing, setPassing] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [viewProfileId, setViewProfileId] = useState<string | null>(null);
  const [allOpen, setAllOpen] = useState(false);
  const [direction, setDirection] = useState<1 | -1>(1);
  const router = useRouter();
  const { toast } = useToast();
  const dragging = useRef(false);

  const applyCreators = useCallback((data: { creators?: CreatorCard[] }) => {
    setCreators(data.creators || []);
    setLoading(false);
  }, []);

  const applyCounts = useCallback((data: { chose_you?: number; match?: number }) => {
    setChoseYou(data.chose_you || 0);
    setMatchesWaiting(data.match || 0);
  }, []);

  useEffect(() => {
    Promise.all([
      swrFetch("/api/creators", applyCreators),
      swrFetch<{ products?: BrandProduct[] }>("/api/products?brand=me", (d) =>
        setProducts((d.products || []).filter((p) => p.status === "active"))
      ),
      swrFetch<{ role?: string; user?: { type?: string }; profile?: { total_credits?: number; used_credits?: number } }>("/api/profile", (d) => {
        // Brand home — a session signed in as a creator belongs on the feed
        if ((d.role || d.user?.type) === "creator") {
          router.replace("/feed");
          return;
        }
        const total = d.profile?.total_credits || 0;
        const used = d.profile?.used_credits || 0;
        setCredits({ total, remaining: Math.max(0, total - used) });
      }),
      swrFetch("/api/connections/counts", applyCounts),
    ]).finally(() => setLoading(false));
  }, [applyCreators, applyCounts, router]);

  // Realtime: a creator answering a heart updates the cards and the quick counters
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("brand-discover")
      .on("postgres_changes", { event: "*", schema: "public", table: "connections" }, () => {
        fetchJson<{ creators?: CreatorCard[] }>("/api/creators").then((d) => d && applyCreators(d));
        fetchJson<{ chose_you?: number; match?: number }>("/api/connections/counts").then((d) => d && applyCounts(d));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [applyCreators, applyCounts]);

  // The deck: creators the brand has not liked or skipped yet (skips never come back from the server)
  const liked = useMemo(() => creators.filter(likedByBrand), [creators]);
  const deck = useMemo(() => {
    if (filter === "liked") return liked;
    return creators.filter((c) => !likedByBrand(c) && (filter !== "fit" || c.fit));
  }, [creators, liked, filter]);

  // Resolve the current card from its id; fall back to the position when the card left the deck
  const currentIndex = (() => {
    if (deck.length === 0) return 0;
    const byId = currentId ? deck.findIndex((c) => c.userId === currentId) : -1;
    return byId >= 0 ? byId : Math.min(index, deck.length - 1);
  })();
  const current = deck[currentIndex];

  function goTo(nextIndex: number, dir: 1 | -1) {
    if (deck.length === 0) return;
    const wrapped = ((nextIndex % deck.length) + deck.length) % deck.length;
    setDirection(dir);
    setIndex(wrapped);
    setCurrentId(deck[wrapped]?.userId ?? null);
  }
  const next = () => goTo(currentIndex + 1, 1);
  const prev = () => goTo(currentIndex - 1, -1);

  function onDragEnd(_: unknown, info: PanInfo) {
    dragging.current = false;
    if (info.offset.x < -SWIPE_THRESHOLD) next();
    else if (info.offset.x > SWIPE_THRESHOLD) prev();
  }

  function removeFromDeck(userId: string) {
    // Keep the position: the next card slides into this slot
    setCurrentId(null);
    setIndex(currentIndex);
    setCreators((prev) => prev.filter((c) => c.userId !== userId));
  }

  // "X": the creator is skipped for good (server-side), like a swipe app
  async function pass(creator: CreatorCard) {
    if (passing) return;
    setPassing(true);
    try {
      const res = await fetch("/api/creators/pass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creator_user_id: creator.userId }),
      });
      if (res.ok) {
        removeFromDeck(creator.userId);
      } else {
        toast("לא הצלחנו לשמור את הדילוג", "error");
      }
    } catch {
      toast("לא הצלחנו לשמור את הדילוג", "error");
    } finally {
      setPassing(false);
    }
  }

  async function resetPasses() {
    const res = await fetch("/api/creators/pass", { method: "DELETE" });
    if (res.ok) {
      toast("הדילוגים אופסו — כל היוצרים חוזרים לקרוסלה", "success");
      const d = await fetchJson<{ creators?: CreatorCard[] }>("/api/creators");
      if (d) applyCreators(d);
      setIndex(0);
      setCurrentId(null);
    } else {
      toast("שגיאה באיפוס", "error");
    }
  }

  function openHeart(creator: CreatorCard) {
    const r = creator.relation;
    if (r) {
      if (r.status === "pending" && !r.mutualAt && r.initiatedBy === "creator") {
        heartBack(creator);
        return;
      }
      if (r.status === "pending" && r.mutualAt) {
        router.push("/brand/connections?tab=match");
        return;
      }
      if (r.status === "pending") {
        toast(`כבר שלחתם לב ל${creator.name} על "${r.productName}"`, "info");
        return;
      }
      router.push(`/messages?connection=${r.connectionId}`);
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

  // The creator hearted first: hearting back makes it a match that waits for the brand's confirmation
  async function heartBack(creator: CreatorCard) {
    if (!creator.relation) return;
    setSending(true);
    try {
      const res = await fetch(`/api/connections/${creator.relation.connectionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "mutual" }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast(`🎉 יש מאטץ' עם ${creator.name}! אשרו את החיבור בלשונית מאטץ'`, "success");
        setMatchesWaiting((n) => n + 1);
        setChoseYou((n) => Math.max(0, n - 1));
        setCreators((prev) =>
          prev.map((c) => (c.userId === creator.userId && c.relation ? { ...c, relation: { ...c.relation, mutualAt: new Date().toISOString() } } : c))
        );
        setCurrentId(null);
        setIndex(currentIndex);
      } else {
        toast(data.error || "שגיאה בשליחת הלב", "error");
      }
    } catch {
      toast("שגיאה בשליחת הלב", "error");
    } finally {
      setSending(false);
    }
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
        const relation: Relation = {
          connectionId: data.connection?.id as string,
          status: "pending",
          initiatedBy: data.mutual ? "creator" : "brand",
          mutualAt: data.mutual ? new Date().toISOString() : null,
          productId: pickedProduct,
          productName: product?.name || "",
        };
        setCreators((prev) => prev.map((c) => (c.userId === pickerFor.userId ? { ...c, relation } : c)));
        if (data.mutual) {
          toast(`🎉 יש מאטץ' עם ${pickerFor.name}! אשרו את החיבור בלשונית מאטץ'`, "success");
          setMatchesWaiting((n) => n + 1);
        } else {
          toast(`💗 הלב נשלח ל${pickerFor.name}. נעדכן אתכם כשיאשר/תאשר`, "success");
        }
        setPickerFor(null);
        setCurrentId(null);
        setIndex(currentIndex);
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

  // "✨ מתאימים לכם" (the `fit` filter) is hidden until the creator↔business matching rule is defined
  // (owner, 2026-11-09); the filtering code stays so it can come back with a one-line change.
  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "הכל" },
    { id: "liked", label: `💗 אהבתי${liked.length > 0 ? ` (${liked.length})` : ""}` },
  ];
  const heartIcon = current?.relation
    ? current.relation.status === "pending"
      ? current.relation.mutualAt ? "🎉" : current.relation.initiatedBy === "creator" ? "💗" : "💗"
      : "💬"
    : "❤️";
  const canPass = !!current && !likedByBrand(current) && !current.relation;

  return (
    <main className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-neutral-100">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-xl font-bold">גלו יוצרים</h1>
              <p className="text-xs text-neutral-500">החליקו כדי לדפדף · לב למי שמתאים לכם · ✕ למי שלא</p>
            </div>
            <button
              type="button"
              onClick={() => setPurchaseOpen(true)}
              title="סרטונים בחבילה"
              className={`text-xs font-bold px-3 py-1.5 rounded-full ${credits.remaining > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}
            >
              🎬 {credits.remaining} סרטונים
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {filters.map((f) => (
              <button
                key={f.id}
                onClick={() => { setFilter(f.id); setIndex(0); setCurrentId(null); }}
                className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filter === f.id ? "bg-pink-500 text-white" : "bg-neutral-50 text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                {f.label}
              </button>
            ))}
            {matchesWaiting > 0 && (
              <button
                onClick={() => router.push("/brand/connections?tab=match")}
                className="whitespace-nowrap px-3.5 py-1.5 rounded-full text-sm font-bold bg-emerald-500 text-white animate-pulse"
              >
                🎉 {matchesWaiting} מאטץ&apos; לאישור
              </button>
            )}
            {choseYou > 0 && (
              <button
                onClick={() => router.push("/brand/connections?tab=chose_you")}
                className="whitespace-nowrap px-3.5 py-1.5 rounded-full text-sm font-bold ig-gradient-bg text-white"
              >
                💗 {choseYou} בחרו בך
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

        {/* Carousel: one card, swipe or arrows to browse, nothing is skipped until ✕ */}
        {current ? (
          <div className="relative">
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.div
                key={current.userId}
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
                className="relative rounded-3xl overflow-hidden bg-black shadow-xl aspect-[3/4] max-h-[560px] mx-auto touch-pan-y select-none"
              >
                {current.previewVideo ? (
                  <video
                    key={current.previewVideo}
                    src={current.previewVideo}
                    poster={current.previewPoster || undefined}
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="auto"
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
                      🎬 {current.portfolioReady ? "תיק עבודות מלא" : "תיק בבנייה"}
                    </span>
                  </div>
                  {relationLabel(current) && (
                    <span className={`text-white text-xs font-bold px-2.5 py-1 rounded-full ${relationLabel(current)!.tone}`}>
                      {relationLabel(current)!.text}
                    </span>
                  )}
                </div>

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-4 pt-16 text-white">
                  <button
                    type="button"
                    onClick={() => { if (!dragging.current) setViewProfileId(current.userId); }}
                    className="flex items-center gap-3 text-right w-full"
                  >
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

            {deck.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={prev}
                  aria-label="הקודם"
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 text-neutral-700 shadow flex items-center justify-center hover:bg-white"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
                </button>
                <button
                  type="button"
                  onClick={next}
                  aria-label="הבא"
                  className="absolute left-1 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 text-neutral-700 shadow flex items-center justify-center hover:bg-white"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="text-center py-16 text-neutral-400 bg-white rounded-3xl border border-neutral-100">
            <span className="text-4xl block mb-3">{filter === "liked" ? "💗" : "🎉"}</span>
            <p className="font-medium text-neutral-600">
              {filter === "liked" ? "עדיין לא סימנתם לב לאף יוצר/ת" : "עברתם על כל היוצרים בסינון הזה"}
            </p>
            <p className="text-xs mt-1">
              {filter === "liked" ? "לב מהקרוסלה יופיע כאן ובלשונית ״הרשימה שלי״" : "נסו סינון אחר או חזרו מחר — יוצרים חדשים מצטרפים כל הזמן"}
            </p>
            {filter !== "liked" && (
              <Button size="sm" variant="secondary" className="mt-4" onClick={resetPasses}>
                להחזיר יוצרים שדילגתם עליהם
              </Button>
            )}
          </div>
        )}

        {current && (
          <div className="flex items-center justify-center gap-5 mt-4">
            <button
              type="button"
              onClick={() => canPass && pass(current)}
              disabled={!canPass || passing}
              aria-label="לא מתאים"
              title="לא מתאים — לא יוצג שוב"
              className="w-14 h-14 rounded-full bg-white border border-neutral-200 shadow-md flex items-center justify-center text-2xl text-neutral-500 hover:bg-neutral-50 active:scale-95 transition-all disabled:opacity-30"
            >
              ✕
            </button>
            <button
              type="button"
              onClick={() => openHeart(current)}
              disabled={sending}
              aria-label="לב"
              className={`w-20 h-20 rounded-full shadow-lg flex items-center justify-center text-4xl active:scale-95 transition-all ${
                current.relation ? "bg-white border-2 border-pink-300" : "ig-gradient-bg text-white"
              }`}
            >
              {heartIcon}
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
        {current?.relation?.status === "pending" && !current.relation.mutualAt && current.relation.initiatedBy === "creator" && (
          <p className="text-center text-xs text-amber-700 mt-3">💗 {current.name} בחר/ה בכם על ״{current.relation.productName}״ — לב בחזרה פותח מאטץ&apos;</p>
        )}

        <div className="mt-8 flex items-center justify-between">
          <h2 className="font-bold">כל היוצרים</h2>
          <Button size="sm" variant="secondary" onClick={() => setAllOpen(true)}>
            לצפייה בכולם
          </Button>
        </div>

        <Card padding="sm" className="mt-4">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-sm">🎬 {credits.remaining} מתוך {credits.total} סרטונים נותרים</span>
            <Button size="sm" variant="secondary" onClick={() => setPurchaseOpen(true)}>
              רכישה
            </Button>
          </div>
          {creditsCardHint(credits.total, credits.total - credits.remaining) && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5 mx-2 mb-1">
              {creditsCardHint(credits.total, credits.total - credits.remaining)}
            </p>
          )}
        </Card>
      </div>

      {/* Everyone at a glance: thumbnails in a popup (the list can grow to hundreds) */}
      <Modal open={allOpen} onClose={() => setAllOpen(false)} title="כל היוצרים" size="lg">
        <div className="max-h-[70vh] overflow-y-auto -m-1 p-1">
          {creators.length === 0 ? (
            <p className="text-sm text-neutral-400 text-center py-8">אין יוצרים להצגה</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {creators.map((c) => (
                <Thumb
                  key={c.userId}
                  c={c}
                  onClick={() => {
                    setAllOpen(false);
                    if (likedByBrand(c)) {
                      setViewProfileId(c.userId);
                      return;
                    }
                    // Jump the carousel to this creator
                    if (filter === "liked" || (filter === "fit" && !c.fit)) setFilter("all");
                    setCurrentId(c.userId);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Product picker */}
      <Modal open={!!pickerFor} onClose={() => setPickerFor(null)} title={pickerFor ? `לב ל${pickerFor.name}` : "לב"} size="sm">
        {pickerFor && (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">על איזה מוצר? שליחת לב תעביר הודעה ליוצר.ת לאישור יצירת סרטון עבורך</p>
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
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={toDirectImageUrl(p.image_url) || ""} alt={p.name} className="w-12 h-12 rounded-lg object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-neutral-100 flex items-center justify-center">{p.product_type === "digital" ? "📱" : "📦"}</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-neutral-500">שווי ₪{Number(p.price) || 0}</p>
                  </div>
                  {pickedProduct === p.id && <Badge variant="pink" size="sm">נבחר</Badge>}
                </button>
              ))}
            </div>
            {credits.remaining === 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2">
                אין לכם סרטונים בחבילה. אפשר לשלוח לבבות, אבל אישור החיבור (שמחייב סרטון אחד) יחכה לטעינת סרטונים. {CREDITS_CONTACT_NOTICE}
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

      <ProfileModal userId={viewProfileId} onClose={() => setViewProfileId(null)} title="פרופיל היוצר/ת" as="creator" />
      {/* No online purchase yet: the owner's notice, then the in-app contact form; the team loads credits from the admin */}
      <CreditsAccess open={purchaseOpen} onClose={() => setPurchaseOpen(false)} total={credits.total} used={credits.total - credits.remaining} />
    </main>
  );
}
