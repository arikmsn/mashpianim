"use client";

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Badge, Avatar, Card, Button, Modal, useToast } from "@/components/ui";
import { ProfileModal } from "@/components/features";
import { createClient } from "@/lib/supabase/client";
import { swrFetch, fetchJson } from "@/lib/client-cache";
import { toDirectImageUrl } from "@/lib/images";

// "בתהליך": brands that chose the creator and no final match yet; "הסתיימו": everything that was matched
type TabType = "process" | "done";

const matchedStatusLabels: Record<string, { label: string; variant: "info" | "warning" | "purple" | "default" | "success" | "danger" | "pink" }> = {
  approved: { label: "מאטץ' — ממתינים למוצר", variant: "success" },
  shipped: { label: "המוצר בדרך", variant: "info" },
  delivered: { label: "הגיע הזמן לצלם", variant: "pink" },
  filming: { label: "בצילום", variant: "warning" },
  uploaded: { label: "הסרטון בבדיקה", variant: "purple" },
  in_review: { label: "הסרטון בבדיקה", variant: "purple" },
  revision_requested: { label: "נדרש שינוי", variant: "warning" },
  completed: { label: "הושלם ✓", variant: "success" },
  cancelled: { label: "בוטל", variant: "danger" },
};

interface Connection {
  id: string;
  productId: string | null;
  product: string;
  productImage: string | null;
  brand: string;
  brandAvatar: string | null;
  brandUserId: string | null;
  initiatedBy: "creator" | "brand";
  mutualAt: string | null;
  approvedAt: string | null;
  status: string;
  createdAt: string;
}

type ConnectionsPayload = { connections?: Record<string, unknown>[] };

function mapConnection(c: Record<string, unknown>): Connection {
  return {
    id: c.id as string,
    productId: (c.product_id as string) || null,
    product: (c as any).products?.name || "",
    productImage: toDirectImageUrl(((c as any).products?.image_url as string) || null),
    brand: (c as any).brand_profiles?.shop_name || "",
    brandAvatar: (c as any).brand_profiles?.logo_url || (c as any).brand_profiles?.users?.avatar_url || null,
    brandUserId: (c as any).brand_profiles?.user_id || null,
    initiatedBy: (c as any).initiated_by === "brand" ? "brand" : "creator",
    mutualAt: (c.mutual_at as string) || null,
    approvedAt: (c.approved_at as string) || null,
    status: (c.status as string) || "pending",
    createdAt: (c.created_at as string) || "",
  };
}

function tabOf(c: Connection): TabType | null {
  if (c.status === "pending") {
    // A brand that chose me (or answered my heart) — waiting on me or on its final confirmation
    return c.initiatedBy === "brand" || c.mutualAt ? "process" : null;
  }
  if (c.status === "rejected") return null;
  if (c.status === "cancelled" && !c.approvedAt) return null;
  return "done";
}

function ConnectionSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-neutral-100 p-4">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-pink-100 animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-neutral-100 rounded-lg w-1/2 animate-pulse" />
          <div className="h-3 bg-neutral-100 rounded-lg w-1/3 animate-pulse" />
          <div className="h-5 bg-pink-100 rounded-full w-24 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

// useSearchParams needs a Suspense boundary for the static shell
export default function ConnectionsPage() {
  return (
    <Suspense>
      <ConnectionsPageInner />
    </Suspense>
  );
}

function ConnectionsPageInner() {
  const searchParams = useSearchParams();
  // `?open=<connectionId>` (from a notification) lands on the right tab and highlights that card
  const openId = searchParams.get("open");
  const [activeTab, setActiveTab] = useState<TabType>("process");
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewBrandId, setViewBrandId] = useState<string | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [portfolioCount, setPortfolioCount] = useState<number | null>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const handledOpenRef = useRef<string | null>(null);
  const tabPickedRef = useRef(false);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (!openId || connections.length === 0 || handledOpenRef.current === openId) return;
    const target = connections.find((c) => c.id === openId);
    if (!target) return;
    handledOpenRef.current = openId;
    const tab = tabOf(target) || "process";
    const t = setTimeout(() => {
      setActiveTab(tab);
      tabPickedRef.current = true;
      requestAnimationFrame(() => {
        document.getElementById(`connection-${openId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }, 0);
    return () => clearTimeout(t);
  }, [openId, connections]);

  const applyConnections = useCallback((data: ConnectionsPayload) => {
    if (!data.connections) return;
    setConnections(data.connections.map(mapConnection));
    setLoading(false);
  }, []);

  useEffect(() => {
    swrFetch("/api/connections", applyConnections).finally(() => setLoading(false));
  }, [applyConnections]);

  useEffect(() => {
    swrFetch<{ user?: { type?: string }; role?: string; profile?: { portfolio_count?: number } }>("/api/profile", (data) => {
      if ((data.role || data.user?.type) === "creator") {
        setPortfolioCount(typeof data.profile?.portfolio_count === "number" ? data.profile.portfolio_count : 0);
      }
    });
  }, []);

  // Realtime: refresh connections when status changes
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("creator-connections")
      .on("postgres_changes", { event: "*", schema: "public", table: "connections" }, () => {
        fetchJson<ConnectionsPayload>("/api/connections").then((data) => {
          if (data) applyConnections(data);
        });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [applyConnections]);

  const locked = portfolioCount !== null && portfolioCount < 5;

  async function respond(connectionId: string, status: "approved" | "rejected") {
    if (status === "approved" && locked) {
      setGateOpen(true);
      return;
    }
    setRespondingId(connectionId);
    try {
      const res = await fetch(`/api/connections/${connectionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (status === "approved") {
          // The creator's yes makes the pair mutual; the chat opens when the brand confirms (and pays)
          setConnections((prev) => prev.map((c) => (c.id === connectionId ? { ...c, mutualAt: new Date().toISOString() } : c)));
          toast("🎉 אישרת! העסק יאשר סופית ואז ייפתח הצ'אט", "success");
        } else {
          setConnections((prev) => prev.map((c) => (c.id === connectionId ? { ...c, status: "rejected" } : c)));
          toast("דחית את הלב. העסק יעודכן.", "info");
        }
      } else if ((data as any).code === "portfolio_gate") {
        setPortfolioCount(typeof (data as any).count === "number" ? (data as any).count : 0);
        setGateOpen(true);
      } else {
        toast((data as any).error || "שגיאה בעדכון", "error");
      }
    } catch {
      toast("שגיאה בעדכון", "error");
    } finally {
      setRespondingId(null);
    }
  }

  const filtered = connections.filter((c) => tabOf(c) === activeTab);
  const counts = {
    process: connections.filter((c) => tabOf(c) === "process").length,
    done: connections.filter((c) => tabOf(c) === "done").length,
  };
  // Hearts that wait for the creator's answer (badge on the tab)
  const needsMe = connections.filter((c) => c.status === "pending" && c.initiatedBy === "brand" && !c.mutualAt).length;

  // First visit: open the list that has something in it
  useEffect(() => {
    if (loading || openId || tabPickedRef.current) return;
    tabPickedRef.current = true;
    if (counts.process === 0 && counts.done > 0) {
      const t = setTimeout(() => setActiveTab("done"), 0);
      return () => clearTimeout(t);
    }
  }, [loading, openId, counts.process, counts.done]);

  const tabs: { key: TabType; label: string }[] = [
    { key: "process", label: "בתהליך" },
    { key: "done", label: "הסתיימו" },
  ];

  return (
    <main className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-neutral-100">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold mb-4">החיבורים שלי</h1>
          <div className="flex gap-1 bg-neutral-50 rounded-xl p-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => { tabPickedRef.current = true; setActiveTab(tab.key); }}
                className={`relative flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.key ? "bg-white text-pink-500 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
                }`}
              >
                {tab.label}
                {tab.key === "process" && needsMe > 0 ? (
                  <span className="mr-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white ig-gradient-bg">{needsMe}</span>
                ) : counts[tab.key] > 0 ? (
                  <span className="mr-1 text-xs opacity-60">({counts[tab.key]})</span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {loading ? (
          <>
            {[1, 2, 3].map((i) => (
              <ConnectionSkeleton key={i} />
            ))}
          </>
        ) : (
          <>
            {filtered.map((conn) => {
              const pendingBrand = conn.status === "pending" && conn.initiatedBy === "brand" && !conn.mutualAt;
              const mutual = conn.status === "pending" && !!conn.mutualAt;
              const status = mutual
                ? { label: "✅ אישרת — ממתין לאישור הסופי של העסק", variant: "success" as const }
                : pendingBrand
                  ? { label: "💗 העסק בחר בך", variant: "pink" as const }
                  : matchedStatusLabels[conn.status] || { label: conn.status, variant: "default" as const };
              const matched = tabOf(conn) === "done";

              return (
                <motion.div key={conn.id} id={`connection-${conn.id}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <Card hover padding="md" className={openId === conn.id ? "ring-2 ring-pink-300" : undefined}>
                    <button
                      className="w-full text-right"
                      onClick={() => (matched ? router.push(`/messages?connection=${conn.id}`) : conn.productId ? router.push(`/products/${conn.productId}`) : undefined)}
                    >
                      <div className="flex items-center gap-4">
                        {conn.productImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={conn.productImage} alt={conn.product} className="w-14 h-14 rounded-xl object-cover shrink-0" />
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-pink-50 flex items-center justify-center text-2xl shrink-0">📦</div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-neutral-900 truncate">{conn.product}</h3>
                          <p className="text-sm text-neutral-500 flex items-center gap-2">
                            <Avatar src={conn.brandAvatar} name={conn.brand} size="sm" />
                            <span className="truncate">{conn.brand}</span>
                          </p>
                          <div className="mt-2">
                            <Badge variant={status.variant} size="sm" dot>{status.label}</Badge>
                          </div>
                        </div>
                      </div>
                    </button>

                    <div className="mt-3 pt-3 border-t border-neutral-100 space-y-2">
                      {pendingBrand && (
                        <>
                          <p className="text-xs text-neutral-500">
                            {locked ? `השלימו ${5 - (portfolioCount || 0)} סרטונים בתיק כדי לאשר` : "אם מתאים לך — אשרי; העסק יאשר סופית (ויחויב) ואז ייפתח צ'אט עם הבריף"}
                          </p>
                          <div className="flex gap-2">
                            <Button size="sm" fullWidth loading={respondingId === conn.id} onClick={() => respond(conn.id, "approved")}>
                              {locked ? "🔒 " : "💗 "}כן, מעוניין/ת
                            </Button>
                            <Button size="sm" variant="ghost" fullWidth loading={respondingId === conn.id} onClick={() => respond(conn.id, "rejected")}>
                              לא תודה
                            </Button>
                          </div>
                        </>
                      )}
                      {mutual && (
                        <p className="text-xs text-emerald-700">🎉 שניכם סימנתם לב. ברגע שהעסק יאשר סופית ייפתח צ&apos;אט עם הבריף ויישלח המוצר — נעדכן אותך.</p>
                      )}
                      <div className="flex gap-2">
                        {matched && (
                          <Button size="sm" fullWidth onClick={() => router.push(`/messages?connection=${conn.id}`)}>
                            💬 לצ&apos;אט
                          </Button>
                        )}
                        {conn.brandUserId && (
                          <Button size="sm" variant="secondary" fullWidth onClick={() => setViewBrandId(conn.brandUserId)}>
                            פרופיל העסק
                          </Button>
                        )}
                        {conn.productId && !matched && (
                          <Button size="sm" variant="ghost" onClick={() => router.push(`/products/${conn.productId}`)}>
                            למוצר ›
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-center py-20 text-neutral-400">
                <span className="text-4xl block mb-4">{activeTab === "process" ? "💗" : "🏆"}</span>
                <p>{activeTab === "process" ? "אין עסקים שבחרו בך כרגע" : "עדיין אין חיבורים שהסתיימו"}</p>
                <p className="text-xs mt-1">
                  {activeTab === "process" ? "הלבבות ששלחת נמצאים בגלו ← ״המוצרים שבחרתי״" : "מאטץ' מאושר יופיע כאן ובצ'אט"}
                </p>
                <Button variant="secondary" size="sm" className="mt-4" onClick={() => router.push("/feed")}>לגלות מוצרים</Button>
              </div>
            )}
          </>
        )}
      </div>

      <ProfileModal userId={viewBrandId} onClose={() => setViewBrandId(null)} title="פרופיל העסק" />

      <Modal open={gateOpen} onClose={() => setGateOpen(false)} size="sm">
        <div className="text-center space-y-4">
          <span className="text-4xl block">🎬</span>
          <div>
            <h3 className="text-lg font-bold">עוד {Math.max(0, 5 - (portfolioCount || 0))} סרטונים ואת/ה בפנים</h3>
            <p className="text-sm text-neutral-500 mt-1">
              תיק העבודות: {portfolioCount || 0}/5. כדי לאשר מאטץ&apos; ולפתוח צ&apos;אט צריך 5 סרטונים בתיק.
            </p>
          </div>
          <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
            <div className="h-full bg-pink-500 rounded-full" style={{ width: `${Math.min(100, ((portfolioCount || 0) / 5) * 100)}%` }} />
          </div>
          <Button fullWidth onClick={() => router.push("/profile")}>להעלאת סרטונים</Button>
        </div>
      </Modal>
    </main>
  );
}
