"use client";

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Badge, Avatar, Card, Button, Modal, useToast } from "@/components/ui";
import { ConnectionTimeline, ProfileModal } from "@/components/features";
import { useDeliverableUpload } from "@/hooks/use-deliverable-upload";
import { createClient } from "@/lib/supabase/client";
import { swrFetch, fetchJson } from "@/lib/client-cache";
import { activeDeadlineField } from "@/lib/connection-flow";
import { MAX_VIDEO_MB } from "@/lib/uploads";

type TabType = "active" | "pending" | "completed";

const statusConfig: Record<
  string,
  { label: string; variant: "info" | "warning" | "purple" | "default" | "success" | "danger" | "pink"; tab: TabType }
> = {
  pending: { label: "ממתין לאישור", variant: "default", tab: "pending" },
  approved: { label: "אושר — ממתין למשלוח", variant: "success", tab: "active" },
  rejected: { label: "נדחה", variant: "danger", tab: "completed" },
  shipped: { label: "נשלח — אשרו קבלה", variant: "info", tab: "active" },
  delivered: { label: "נמסר — הגיע הזמן לצלם!", variant: "pink", tab: "active" },
  filming: { label: "בצילום", variant: "warning", tab: "active" },
  uploaded: { label: "הועלה", variant: "purple", tab: "active" },
  in_review: { label: "בבדיקה אצל העסק", variant: "purple", tab: "active" },
  revision_requested: { label: "נדרש תיקון", variant: "warning", tab: "active" },
  completed: { label: "הושלם", variant: "success", tab: "completed" },
  cancelled: { label: "בוטל", variant: "danger", tab: "completed" },
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
  status: string;
  daysLeft: number | null;
  // The deadline that applies to the current step (ship / deliver / film / review)
  activeDeadline: string | null;
  deliveryType: "physical" | "digital";
  trackingNumber: string | null;
  trackingUrl: string | null;
  digitalAccessValue: string | null;
  revisionNotes: string | null;
}

type ConnectionsPayload = { connections?: Record<string, unknown>[] };

function mapConnection(c: Record<string, unknown>): Connection {
  const deadline = c.film_deadline as string | null;
  let daysLeft: number | null = null;
  if (deadline) {
    const diff = new Date(deadline).getTime() - Date.now();
    daysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }
  const status = (c.status as string) || "pending";
  const deadlineField = activeDeadlineField(status);
  return {
    id: c.id as string,
    productId: (c.product_id as string) || null,
    product: (c as any).products?.name || (c.product_name as string) || "",
    productImage: (c as any).products?.image_url || null,
    brand: (c as any).brand_profiles?.shop_name || (c.brand_name as string) || "",
    brandAvatar: (c as any).brand_profiles?.logo_url || (c as any).brand_profiles?.users?.avatar_url || null,
    brandUserId: (c as any).brand_profiles?.user_id || null,
    initiatedBy: (c as any).initiated_by === "brand" ? "brand" : "creator",
    status,
    daysLeft,
    activeDeadline: deadlineField ? ((c[deadlineField] as string) || null) : null,
    deliveryType: ((c as any).delivery_type as "physical" | "digital") || "physical",
    trackingNumber: (c.tracking_number as string) || null,
    trackingUrl: (c.tracking_url as string) || null,
    digitalAccessValue: (c.digital_access_value as string) || null,
    revisionNotes: (c.revision_notes as string) || null,
  };
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

function canUploadVideo(status: string) {
  return ["delivered", "filming", "revision_requested"].includes(status);
}

function canConfirmDelivery(status: string) {
  return status === "shipped";
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
  const [activeTab, setActiveTab] = useState<TabType>("active");
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [viewBrandId, setViewBrandId] = useState<string | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [portfolioCount, setPortfolioCount] = useState<number | null>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const handledOpenRef = useRef<string | null>(null);
  const focusedId = openId;
  const { toast } = useToast();
  const router = useRouter();

  // Once the list is in, switch to the tab holding the requested card and scroll it into view (once per id)
  useEffect(() => {
    if (!openId || connections.length === 0 || handledOpenRef.current === openId) return;
    const target = connections.find((c) => c.id === openId);
    if (!target) return;
    handledOpenRef.current = openId;
    const tab = statusConfig[target.status]?.tab || "pending";
    const t = setTimeout(() => {
      setActiveTab(tab);
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

  const locked = portfolioCount !== null && portfolioCount < 5;

  async function respond(connectionId: string, status: "approved" | "rejected" | "cancelled") {
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
        setConnections((prev) => prev.map((c) => (c.id === connectionId ? { ...c, status } : c)));
        if (status === "approved") {
          toast("🎉 יש מאטץ'! הצ'אט נפתח", "success");
          router.push(`/messages?connection=${connectionId}`);
        } else if (status === "rejected") {
          toast("דחית את הלב. העסק יעודכן.", "info");
        } else {
          toast("הלב בוטל", "info");
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

  // Realtime: refresh connections when status changes
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("creator-connections")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "connections" },
        () => {
          fetchJson<ConnectionsPayload>("/api/connections").then((data) => {
            if (data) applyConnections(data);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [applyConnections]);

  // Direct-to-Storage upload with progress (shared with the product page)
  const upload = useDeliverableUpload(
    useCallback((connectionId: string) => {
      setConnections((prev) => prev.map((c) => (c.id === connectionId ? { ...c, status: "uploaded" } : c)));
    }, [])
  );

  async function confirmDelivery(connectionId: string) {
    setConfirmingId(connectionId);
    try {
      const res = await fetch(`/api/connections/${connectionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "delivered" }),
      });
      if (res.ok) {
        setConnections((prev) =>
          prev.map((c) => (c.id === connectionId ? { ...c, status: "delivered" } : c))
        );
        toast("קבלת המוצר אושרה! עכשיו הגיע הזמן לצלם", "success");
      } else {
        const data = await res.json().catch(() => ({}));
        toast((data as any).error || "שגיאה בעדכון", "error");
      }
    } catch {
      toast("שגיאה בעדכון", "error");
    } finally {
      setConfirmingId(null);
    }
  }

  const getTab = (status: string): TabType => {
    return statusConfig[status]?.tab || "pending";
  };

  const filtered = connections.filter((c) => getTab(c.status) === activeTab);

  const tabCounts = {
    active: connections.filter((c) => getTab(c.status) === "active").length,
    pending: connections.filter((c) => getTab(c.status) === "pending").length,
    completed: connections.filter((c) => getTab(c.status) === "completed").length,
  };

  const tabs: { key: TabType; label: string }[] = [
    { key: "active", label: "פעילים" },
    { key: "pending", label: "ממתינים" },
    { key: "completed", label: "הסתיימו" },
  ];

  return (
    <main className="min-h-screen bg-background pb-20">
      {upload.input}

      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-neutral-100">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold mb-4">החיבורים שלי</h1>
          <div className="flex gap-1 bg-neutral-50 rounded-xl p-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.key
                    ? "bg-white text-pink-500 shadow-sm"
                    : "text-neutral-500 hover:text-neutral-700"
                }`}
              >
                {tab.label}
                <span className="mr-1 text-xs opacity-60">({tabCounts[tab.key]})</span>
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
              const status =
                conn.status === "pending" && conn.initiatedBy === "brand"
                  ? { label: "💗 סימנו אותך", variant: "pink" as const }
                  : conn.status === "pending"
                    ? { label: "❤️ לב נשלח — ממתין לעסק", variant: "default" as const }
                    : statusConfig[conn.status] || {
                        label: conn.status,
                        variant: "default" as const,
                      };
              const showUpload = canUploadVideo(conn.status);
              const isUploading = upload.uploadingId === conn.id;
              const uploadProgress = upload.progress;

              return (
                <motion.div
                  key={conn.id}
                  id={`connection-${conn.id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card hover padding="md" className={focusedId === conn.id ? "ring-2 ring-pink-300" : undefined}>
                    <button
                      className="w-full text-right"
                      onClick={() => (conn.productId ? router.push(`/products/${conn.productId}`) : router.push(`/messages?connection=${conn.id}`))}
                    >
                      <div className="flex items-center gap-4">
                        <span
                          role="button"
                          tabIndex={conn.brandUserId ? 0 : -1}
                          aria-label={`פרופיל ${conn.brand}`}
                          onClick={(e) => { if (conn.brandUserId) { e.stopPropagation(); setViewBrandId(conn.brandUserId); } }}
                          onKeyDown={(e) => { if (conn.brandUserId && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); e.stopPropagation(); setViewBrandId(conn.brandUserId); } }}
                          className={conn.brandUserId ? "rounded-full hover:ring-2 hover:ring-pink-300 transition-all" : ""}
                        >
                          <Avatar src={conn.brandAvatar} name={conn.brand} size="lg" />
                        </span>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-neutral-900 truncate">
                            {conn.product}
                          </h3>
                          <p className="text-sm text-neutral-500">
                            {conn.brand}
                            {conn.brandUserId && (
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => { e.stopPropagation(); setViewBrandId(conn.brandUserId); }}
                                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setViewBrandId(conn.brandUserId); } }}
                                className="text-xs text-pink-500 mr-2 hover:underline"
                              >
                                פרופיל העסק
                              </span>
                            )}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant={status.variant} size="sm" dot>
                              {status.label}
                            </Badge>
                            {conn.daysLeft !== null && statusConfig[conn.status]?.tab === "active" && (
                              <span className="text-xs text-neutral-400">
                                {conn.daysLeft} ימים נותרו
                              </span>
                            )}
                            {conn.productId && (
                              <span className="text-xs text-pink-500 mr-auto">לדף המוצר ›</span>
                            )}
                          </div>
                        </div>
                        <svg
                          className="text-neutral-300 flex-shrink-0"
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M15 18l-6-6 6-6" />
                        </svg>
                      </div>
                    </button>

                    {/* Where the connection stands and what happens next (matched connections only) */}
                    {!["pending", "rejected", "cancelled"].includes(conn.status) && (
                      <div className="mt-3 pt-3 border-t border-neutral-100">
                        <ConnectionTimeline
                          status={conn.status}
                          role="creator"
                          initiatedBy={conn.initiatedBy}
                          deliveryType={conn.deliveryType}
                          deadline={conn.activeDeadline}
                          compact
                        />
                      </div>
                    )}

                    {conn.status === "pending" && (
                      <div className="mt-3 pt-3 border-t border-neutral-100">
                        {conn.initiatedBy === "brand" ? (
                          <>
                            <p className="text-sm text-pink-600 font-medium mb-2">
                              💗 {conn.brand} מתעניינים בך למוצר הזה
                              {locked ? ` — השלימו ${5 - (portfolioCount || 0)} סרטונים בתיק כדי לאשר` : ""}
                            </p>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                fullWidth
                                loading={respondingId === conn.id}
                                onClick={(e) => { e.stopPropagation(); respond(conn.id, "approved"); }}
                              >
                                {locked ? "🔒 " : "💗 "}אישור — מאטץ&apos;
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                fullWidth
                                loading={respondingId === conn.id}
                                onClick={(e) => { e.stopPropagation(); respond(conn.id, "rejected"); }}
                              >
                                לא תודה
                              </Button>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-neutral-500">הלב נשלח — ממתינים לתשובת העסק (עד 7 ימים)</p>
                            <button
                              type="button"
                              className="text-xs text-neutral-400 hover:text-red-500"
                              onClick={(e) => { e.stopPropagation(); respond(conn.id, "cancelled"); }}
                            >
                              ביטול
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Delivery confirmation for shipped items */}
                    {canConfirmDelivery(conn.status) && (
                      <div className="mt-3 pt-3 border-t border-neutral-100 space-y-2">
                        {conn.trackingNumber && (
                          <p className="text-xs text-neutral-500">מספר מעקב: <span className="font-mono">{conn.trackingNumber}</span></p>
                        )}
                        {conn.digitalAccessValue && (
                          <p className="text-xs text-neutral-500">גישה: <span className="font-mono">{conn.digitalAccessValue}</span></p>
                        )}
                        <Button
                          size="sm"
                          fullWidth
                          loading={confirmingId === conn.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            confirmDelivery(conn.id);
                          }}
                        >
                          {conn.deliveryType === "digital" ? "אישור קבלת גישה" : "אישור קבלת המוצר"}
                        </Button>
                      </div>
                    )}

                    {/* Revision notes */}
                    {conn.status === "revision_requested" && conn.revisionNotes && (
                      <div className="mt-3 pt-3 border-t border-amber-100 bg-amber-50 -mx-4 -mb-4 px-4 pb-4 rounded-b-2xl">
                        <p className="text-xs text-amber-700 font-medium mb-1">הערות תיקון:</p>
                        <p className="text-xs text-amber-600">{conn.revisionNotes}</p>
                      </div>
                    )}

                    {/* Video upload */}
                    {showUpload && (
                      <div className="mt-3 pt-3 border-t border-neutral-100">
                        <Button
                          size="sm"
                          variant={isUploading ? "secondary" : "primary"}
                          fullWidth
                          loading={isUploading}
                          onClick={(e) => {
                            e.stopPropagation();
                            upload.start(conn.id);
                          }}
                        >
                          {upload.buttonLabel(conn.id, conn.status === "revision_requested" ? "📹 העלאת גרסה מתוקנת" : "📹 העלאת סרטון")}
                        </Button>
                        {isUploading && (
                          <div className="mt-2 h-1.5 bg-neutral-100 rounded-full overflow-hidden" aria-live="polite">
                            <div className="h-full bg-pink-500 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                          </div>
                        )}
                        <p className="mt-1 text-[11px] text-neutral-400 leading-relaxed">
                          <span className="block">פורמטים נתמכים: MP4, MOV, WebM</span>
                          <span className="block">גודל מקסימלי: {MAX_VIDEO_MB}MB</span>
                        </p>
                      </div>
                    )}
                  </Card>
                </motion.div>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-center py-20 text-neutral-400">
                <span className="text-4xl block mb-4">📭</span>
                <p>אין חיבורים בקטגוריה זו</p>
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
