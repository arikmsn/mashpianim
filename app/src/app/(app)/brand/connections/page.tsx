"use client";

import { Suspense, useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, Badge, Button, Modal, Avatar, Input, Textarea, useToast } from "@/components/ui";
import { ConnectionTimeline, PublicProfileContent, FeedbackModal } from "@/components/features";
import { createClient } from "@/lib/supabase/client";
import { swrFetch, fetchJson } from "@/lib/client-cache";
import { activeDeadlineField, canBrandReview, brandBoardTab, brandTask, boardTabFromParam, BRAND_BOARD_TABS, type BrandBoardTab, type BrandTask } from "@/lib/connection-flow";
import { toDirectImageUrl } from "@/lib/images";

interface Connection {
  id: string;
  creatorId: string | null;
  initiatedBy: "creator" | "brand";
  mutualAt: string | null;
  creatorName: string;
  creatorAvatar: string | null;
  productName: string;
  productImage: string | null;
  productType: "physical" | "digital";
  status: string;
  createdAt: string;
  approvedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  completedAt: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  digitalAccessValue: string | null;
  revisionCount: number;
  productId: string | null;
  briefPostedAt: string | null;
  briefApprovedAt: string | null;
  // The deadline that applies to the current step (ship / deliver / film / review)
  activeDeadline: string | null;
}

const statusLabels: Record<string, { label: string; variant: "pink" | "success" | "warning" | "default" }> = {
  pending: { label: "ממתין", variant: "warning" },
  approved: { label: "אושר — ממתין למשלוח", variant: "pink" },
  rejected: { label: "נדחה", variant: "default" },
  shipped: { label: "נשלח", variant: "pink" },
  delivered: { label: "נמסר — ממתין לצילום", variant: "pink" },
  filming: { label: "בצילום", variant: "pink" },
  uploaded: { label: "סרטון הועלה", variant: "pink" },
  in_review: { label: "בבדיקה", variant: "warning" },
  revision_requested: { label: "דרוש תיקון", variant: "warning" },
  completed: { label: "הושלם", variant: "success" },
  cancelled: { label: "בוטל", variant: "default" },
};

const activeStatuses = ["approved", "shipped", "delivered", "filming", "uploaded", "in_review", "revision_requested"];
// Statuses in which a deliverable exists for the brand to watch
const videoStatuses = ["uploaded", "in_review", "revision_requested", "completed"];

interface ConnectionVideo {
  id: string;
  url: string;
  thumbnail_url?: string | null;
  status: string;
  created_at: string;
}

// The business's own next step on a connection (drives "⚡ לטיפול" and the CTA on each card)
function taskOf(conn: Connection): BrandTask | null {
  return brandTask({
    status: conn.status,
    mutual_at: conn.mutualAt,
    brief_posted_at: conn.briefPostedAt,
    brief_approved_at: conn.briefApprovedAt,
    product_type: conn.productType,
  });
}

function stateTabOf(conn: Connection) {
  return brandBoardTab({ status: conn.status, initiated_by: conn.initiatedBy, mutual_at: conn.mutualAt });
}

// The hearts inbox is grouped: matches to confirm, creators who chose the business, the business's own hearts
type HeartGroup = "match" | "chose_you" | "my_list";
const HEART_GROUP_ORDER: HeartGroup[] = ["match", "chose_you", "my_list"];
const HEART_GROUP_TITLES: Record<HeartGroup, string> = {
  match: "🎉 מאטץ' — שני הצדדים סימנו לב, האישור שלכם פותח את החיבור",
  chose_you: "💗 בחרו בך — יוצרים שסימנו את המוצרים שלכם · לב בחזרה = מאטץ'",
  my_list: "💗 שלחתם לב — ממתינים לתשובת היוצר/ת",
};
function heartGroupOf(conn: Connection): HeartGroup {
  if (conn.mutualAt) return "match";
  return conn.initiatedBy === "brand" ? "my_list" : "chose_you";
}

function ConnectionsSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-2xl p-4 border border-neutral-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-pink-100 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-neutral-200 rounded-lg w-32 animate-pulse" />
              <div className="h-3 bg-neutral-100 rounded-lg w-48 animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// The badge on a pending card, by who hearted whom
function pendingInfo(conn: Connection): { label: string; variant: "pink" | "success" | "warning" } {
  if (conn.mutualAt) return { label: "🎉 מאטץ' — ממתין לאישורכם", variant: "success" };
  if (conn.initiatedBy === "brand") return { label: "💗 הלב נשלח — ממתין ליוצר/ת", variant: "pink" };
  return { label: "💗 בחר/ה בכם", variant: "warning" };
}

// useSearchParams needs a Suspense boundary for the static shell
export default function BrandConnectionsPage() {
  return (
    <Suspense>
      <BrandConnectionsPageInner />
    </Suspense>
  );
}

function BrandConnectionsPageInner() {
  const searchParams = useSearchParams();
  // `?open=<connectionId>` (from a notification) switches to its tab and opens its modal; `?tab=` lands on a list
  const openId = searchParams.get("open");
  const tabParam = searchParams.get("tab");
  const handledOpenRef = useRef<string | null>(null);
  const [activeTab, setActiveTab] = useState<BrandBoardTab>(boardTabFromParam(tabParam) || "tasks");
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [confirmFor, setConfirmFor] = useState<Connection | null>(null);
  const [credits, setCredits] = useState<{ remaining: number; total: number } | null>(null);
  const [purchaseOpen, setPurchaseOpen] = useState(false);

  useEffect(() => {
    if (!openId || connections.length === 0 || handledOpenRef.current === openId) return;
    const target = connections.find((c) => c.id === openId);
    if (!target) return;
    handledOpenRef.current = openId;
    const t = setTimeout(() => {
      setActiveTab(taskOf(target) ? "tasks" : stateTabOf(target));
      setSelectedConnection(target);
    }, 0);
    return () => clearTimeout(t);
  }, [openId, connections]);
  const [updating, setUpdating] = useState<string | null>(null);
  const [shipForm, setShipForm] = useState({ trackingNumber: "", trackingUrl: "", digitalAccessValue: "" });
  const [revisionNotes, setRevisionNotes] = useState("");
  // Deliverable of the connection currently open in the modal (kept with its id so another connection's
  // videos are never shown while a new fetch is in flight)
  const [connectionVideos, setConnectionVideos] = useState<{ forId: string; videos: ConnectionVideo[] } | null>(null);
  // Revision allowance configured by the admin (comes with /api/connections)
  const [maxRevisions, setMaxRevisions] = useState(2);
  const { toast } = useToast();
  const router = useRouter();

  const fetchConnections = useCallback(async () => {
    const apply = (data: { connections?: Record<string, unknown>[]; settings?: { max_revisions?: number } }) => {
      if (typeof data.settings?.max_revisions === "number") setMaxRevisions(data.settings.max_revisions);
      const conns = data.connections || [];
      setConnections(
        conns.map((c) => ({
          id: c.id as string,
          creatorId: (c as any).creator_profiles?.user_id || null,
          initiatedBy: (c as any).initiated_by === "brand" ? "brand" : "creator",
          mutualAt: (c.mutual_at as string) || null,
          creatorName: (c as any).creator_profiles?.users?.full_name || (c as any).creator?.full_name || "יוצר/ת",
          creatorAvatar: (c as any).creator_profiles?.users?.avatar_url || null,
          productName: (c as any).products?.name || "מוצר",
          productImage: toDirectImageUrl((c as any).products?.image_url),
          productType: ((c as any).products?.product_type as "physical" | "digital") || (c.delivery_type as "physical" | "digital") || "physical",
          status: c.status as string,
          createdAt: c.created_at as string,
          approvedAt: (c.approved_at as string) || null,
          shippedAt: (c.shipped_at as string) || null,
          deliveredAt: (c.delivered_at as string) || null,
          completedAt: (c.completed_at as string) || null,
          trackingNumber: (c.tracking_number as string) || null,
          trackingUrl: (c.tracking_url as string) || null,
          digitalAccessValue: (c.digital_access_value as string) || null,
          revisionCount: (c.revision_count as number) || 0,
          productId: (c.product_id as string) || null,
          briefPostedAt: (c.brief_posted_at as string) || null,
          briefApprovedAt: (c.brief_approved_at as string) || null,
          activeDeadline: (() => {
            const field = activeDeadlineField(c.status as string);
            return field ? ((c[field] as string) || null) : null;
          })(),
        }))
      );
      setLoading(false);
    };
    await swrFetch("/api/connections", apply);
    setLoading(false);
  }, []);

  const fetchCredits = useCallback(() => {
    return swrFetch<{ profile?: { total_credits?: number; used_credits?: number } }>("/api/profile", (d) => {
      const total = d.profile?.total_credits || 0;
      const used = d.profile?.used_credits || 0;
      setCredits({ total, remaining: Math.max(0, total - used) });
    });
  }, []);

  useEffect(() => {
    // Deferred so a cached response never sets state synchronously inside the effect
    const t = setTimeout(() => {
      fetchConnections();
      fetchCredits();
    }, 0);
    return () => clearTimeout(t);
  }, [fetchConnections, fetchCredits]);

  // Load the uploaded deliverable when a connection with a video is opened
  const selectedId = selectedConnection?.id ?? null;
  const selectedStatus = selectedConnection?.status ?? null;
  const selectedHasVideo = !!selectedStatus && videoStatuses.includes(selectedStatus);
  useEffect(() => {
    if (!selectedId || !selectedHasVideo) return;
    let cancelled = false;
    fetch(`/api/videos?connectionId=${selectedId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setConnectionVideos({ forId: selectedId, videos: (d?.videos as ConnectionVideo[]) || [] });
      })
      .catch(() => {
        if (!cancelled) setConnectionVideos({ forId: selectedId, videos: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, selectedHasVideo]);
  const visibleVideos = selectedHasVideo && connectionVideos?.forId === selectedId ? connectionVideos.videos : [];

  // Realtime: refresh connections on any change
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("brand-connections")
      .on("postgres_changes", { event: "*", schema: "public", table: "connections" }, () => {
        fetchJson("/api/connections").then((d) => d && fetchConnections());
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchConnections]);

  async function updateStatus(connectionId: string, newStatus: string, extra?: Record<string, unknown>) {
    setUpdating(connectionId);
    try {
      const res = await fetch(`/api/connections/${connectionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, ...extra }),
      });

      if (res.ok) {
        if (newStatus === "mutual") {
          setConnections((prev) => prev.map((c) => (c.id === connectionId ? { ...c, mutualAt: new Date().toISOString() } : c)));
          toast("🎉 יש מאטץ'! אשרו את החיבור כדי להתחיל", "success");
          setActiveTab("tasks");
        } else {
          setConnections((prev) => prev.map((c) => (c.id === connectionId ? { ...c, status: newStatus } : c)));
          if (newStatus === "approved") {
            toast("🎉 החיבור אושר! הצ'אט נפתח והבריף נשלח ליוצר/ת", "success");
            setCredits((c) => (c ? { ...c, remaining: Math.max(0, c.remaining - 1) } : c));
            setActiveTab("active");
          } else {
            const label = statusLabels[newStatus]?.label || newStatus;
            toast(`סטטוס עודכן: ${label}`, "success");
          }
        }
        setSelectedConnection(null);
        setConfirmFor(null);
        setShipForm({ trackingNumber: "", trackingUrl: "", digitalAccessValue: "" });
        setRevisionNotes("");
      } else {
        const data = await res.json().catch(() => ({}));
        toast((data as any).error || "שגיאה בעדכון", "error");
        if ((data as any).error && /סרטונים|קרדיט/.test((data as any).error)) {
          setConfirmFor(null);
          setPurchaseOpen(true);
        }
      }
    } catch {
      toast("שגיאה בעדכון", "error");
    } finally {
      setUpdating(null);
    }
  }

  // "⚡ לטיפול" is a cross-cut: everything whose next step is the business's own. The other views are states.
  const counts: Record<BrandBoardTab, number> = { tasks: 0, active: 0, hearts: 0, done: 0 };
  for (const c of connections) {
    if (taskOf(c)) counts.tasks++;
    counts[stateTabOf(c)]++;
  }
  const byDeadline = (a: Connection, b: Connection) => {
    const da = a.activeDeadline ? Date.parse(a.activeDeadline) : Infinity;
    const db = b.activeDeadline ? Date.parse(b.activeDeadline) : Infinity;
    if (da !== db) return da - db;
    return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  };
  const filtered = connections
    .filter((c) => (activeTab === "tasks" ? !!taskOf(c) : stateTabOf(c) === activeTab))
    .sort((a, b) => {
      if (activeTab === "tasks") return (taskOf(a)!.order - taskOf(b)!.order) || byDeadline(a, b);
      if (activeTab === "hearts") {
        return HEART_GROUP_ORDER.indexOf(heartGroupOf(a)) - HEART_GROUP_ORDER.indexOf(heartGroupOf(b)) || Date.parse(b.createdAt) - Date.parse(a.createdAt);
      }
      if (activeTab === "active") return Number(!taskOf(a)) - Number(!taskOf(b)) || byDeadline(a, b);
      return Date.parse(b.completedAt || b.createdAt) - Date.parse(a.completedAt || a.createdAt);
    });

  // First visit: what waits for the business, else what is in motion, else the hearts inbox; a tab the user
  // taps, or one named in the URL, is never overridden
  const tabPickedRef = useRef(!!boardTabFromParam(tabParam));
  const { tasks: taskCount, active: activeCount, hearts: heartCount, done: doneCount } = counts;
  useEffect(() => {
    if (loading || openId || tabPickedRef.current) return;
    tabPickedRef.current = true;
    const first: BrandBoardTab = taskCount > 0 ? "tasks" : activeCount > 0 ? "active" : heartCount > 0 ? "hearts" : doneCount > 0 ? "done" : "hearts";
    const t = setTimeout(() => setActiveTab(first), 0);
    return () => clearTimeout(t);
  }, [loading, openId, taskCount, activeCount, heartCount, doneCount]);

  function getActions(conn: Connection) {
    const actions: { label: string; status: string; variant: "primary" | "secondary" | "danger"; needsModal?: boolean; confirm?: boolean; route?: string }[] = [];
    switch (conn.status) {
      case "pending":
        if (conn.mutualAt) {
          actions.push({ label: "✅ אישור החיבור", status: "approved", variant: "primary", confirm: true });
          actions.push({ label: "ביטול", status: "cancelled", variant: "secondary" });
        } else if (conn.initiatedBy === "brand") {
          actions.push({ label: "ביטול הלב", status: "cancelled", variant: "secondary" });
        } else {
          actions.push({ label: "💗 לב בחזרה", status: "mutual", variant: "primary" });
          actions.push({ label: "לא מתאים", status: "rejected", variant: "danger" });
        }
        break;
      case "approved":
        // The brief goes first; shipping waits for the creator's approval of it (same order as the chat)
        if (!conn.briefPostedAt && conn.productId) {
          actions.push({ label: "📋 שליחת הבריף", status: "brief", variant: "primary", route: `/brand/products/${conn.productId}/brief?connection=${conn.id}` });
        } else if (conn.briefApprovedAt) {
          actions.push({ label: conn.productType === "digital" ? "📲 שליחת גישה" : "📦 עדכון משלוח", status: "shipped", variant: "primary", needsModal: true });
        } else {
          actions.push({ label: "💬 לצ'אט", status: "chat", variant: "secondary", route: `/messages?connection=${conn.id}` });
        }
        break;
      case "uploaded":
      case "in_review":
        actions.push({ label: "סקירת סרטון", status: "completed", variant: "primary", needsModal: true });
        break;
    }
    return actions;
  }

  function runAction(conn: Connection, action: ReturnType<typeof getActions>[number]) {
    if (action.route) {
      router.push(action.route);
    } else if (action.confirm) {
      setConfirmFor(conn);
    } else if (action.needsModal) {
      setSelectedConnection(conn);
    } else {
      updateStatus(conn.id, action.status);
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("he-IL");
  }

  const emptyText = BRAND_BOARD_TABS.find((b) => b.id === activeTab)?.empty || "אין חיבורים";

  return (
    <main className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-neutral-100">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">חיבורים</h1>
          <p className="text-xs text-neutral-500 mt-0.5 mb-3">ניהול החיבורים עם היוצרים: מה מחכה לכם, מה בתהליך, הלבבות והארכיון</p>
          <div className="flex gap-1 bg-neutral-50 rounded-xl p-1 overflow-x-auto scrollbar-hide">
            {BRAND_BOARD_TABS.map((tab) => {
              const count = counts[tab.id];
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    tabPickedRef.current = true;
                    setActiveTab(tab.id);
                  }}
                  className={`relative flex-1 min-w-fit whitespace-nowrap py-2 px-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.id ? "bg-white text-pink-500 shadow-sm" : "text-neutral-500"
                  }`}
                >
                  {tab.label}
                  {count > 0 && tab.id === "tasks" ? (
                    // What waits for the business gets the loud badge; the state views a quiet count
                    <span className="mr-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white bg-emerald-500">
                      {count}
                    </span>
                  ) : count > 0 ? (
                    <span className={`mr-1 text-xs ${activeTab === tab.id ? "text-pink-400" : "text-neutral-400"}`}>({count})</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4">
        {activeTab === "tasks" && filtered.some((c) => taskOf(c)?.kind === "confirm_match") && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 mb-4 text-sm text-emerald-800">
            🎉 שני הצדדים סימנו לב. אישור החיבור פותח צ&apos;אט, שולח ליוצר/ת את הבריף ומחייב סרטון אחד מהחבילה
            {credits ? ` (נותרו ${credits.remaining})` : ""}.
          </div>
        )}
        {loading ? (
          <ConnectionsSkeleton />
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-neutral-400">
            <span className="text-4xl block mb-3">
              {activeTab === "tasks" ? "✅" : activeTab === "hearts" ? "💗" : activeTab === "active" ? "🔗" : "🏆"}
            </span>
            <p>{emptyText}</p>
            {(activeTab === "hearts" || activeTab === "active") && (
              <Button size="sm" variant="secondary" className="mt-4" onClick={() => router.push("/brand")}>
                לגלות יוצרים
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((conn, i) => {
              const statusInfo = conn.status === "pending" ? pendingInfo(conn) : statusLabels[conn.status] || { label: conn.status, variant: "default" as const };
              const actions = getActions(conn);
              const task = taskOf(conn);
              // The hearts inbox is grouped: a title before the first card of each group
              const group = activeTab === "hearts" ? heartGroupOf(conn) : null;
              const groupTitle = group && (i === 0 || heartGroupOf(filtered[i - 1]) !== group) ? HEART_GROUP_TITLES[group] : null;
              return (
                <motion.div
                  key={conn.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 8) * 0.04 }}
                >
                  {groupTitle && <p className="text-xs font-bold text-neutral-500 mb-2 mt-1">{groupTitle}</p>}
                  <Card hover padding="md" onClick={() => setSelectedConnection(conn)}>
                    <div className="flex items-center gap-3">
                      <Avatar src={conn.creatorAvatar} name={conn.creatorName} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <p className="font-medium text-sm truncate">{conn.creatorName}</p>
                          <Badge variant={statusInfo.variant} size="sm">
                            {statusInfo.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-pink-500">{conn.productName}</p>
                        <p className="text-xs text-neutral-400 mt-0.5">
                          {conn.mutualAt ? `מאטץ' מ-${formatDate(conn.mutualAt)}` : formatDate(conn.createdAt)}
                        </p>
                      </div>
                    </div>
                    {/* Where the connection stands and what the brand has to do next */}
                    {activeStatuses.includes(conn.status) && (
                      <div className="mt-3 pt-3 border-t border-neutral-100">
                        <ConnectionTimeline
                          status={conn.status}
                          role="brand"
                          initiatedBy={conn.initiatedBy}
                          deliveryType={conn.productType}
                          deadline={conn.activeDeadline}
                          compact
                        />
                      </div>
                    )}
                    {task && (
                      <p className="mt-3 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-1.5">⚡ {task.label}</p>
                    )}
                    {actions.length > 0 && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-neutral-100">
                        {actions.map((action) => (
                          <Button
                            key={action.status}
                            size="sm"
                            variant={action.variant === "primary" ? "primary" : action.variant === "danger" ? "danger" : "secondary"}
                            loading={updating === conn.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              runAction(conn, action);
                            }}
                          >
                            {action.label}
                          </Button>
                        ))}
                      </div>
                    )}
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* The paid step: confirming a mutual match */}
      <Modal open={!!confirmFor} onClose={() => !updating && setConfirmFor(null)} size="sm">
        {confirmFor && (
          <div className="text-center space-y-4">
            <span className="text-4xl block">🎉</span>
            <div>
              <h3 className="text-lg font-bold">לאשר את החיבור עם {confirmFor.creatorName}?</h3>
              <p className="text-sm text-neutral-600 mt-2">
                על ״{confirmFor.productName}״. האישור פותח צ&apos;אט, שולח ליוצר/ת את הבריף, ומחייב{" "}
                <span className="font-bold text-neutral-900">סרטון אחד מהחבילה</span>
                {credits ? ` (נותרו ${credits.remaining}${credits.remaining === 1 ? " — זה האחרון" : ""})` : ""}.
              </p>
            </div>
            {credits && credits.remaining === 0 ? (
              <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-700 space-y-2">
                <p>אין סרטונים נותרים בחבילה — כדי לאשר צריך לרכוש.</p>
                <Button size="sm" fullWidth onClick={() => { setConfirmFor(null); setPurchaseOpen(true); }}>לרכישת סרטונים</Button>
              </div>
            ) : (
              <Button fullWidth loading={updating === confirmFor.id} onClick={() => updateStatus(confirmFor.id, "approved")}>
                ✅ אישור וחיוב סרטון אחד
              </Button>
            )}
            <Button variant="ghost" fullWidth disabled={!!updating} onClick={() => setConfirmFor(null)}>
              עוד לא
            </Button>
          </div>
        )}
      </Modal>

      <Modal
        open={!!selectedConnection}
        onClose={() => { setSelectedConnection(null); setShipForm({ trackingNumber: "", trackingUrl: "", digitalAccessValue: "" }); setRevisionNotes(""); }}
        title="פרטי חיבור"
        size="lg"
      >
        {selectedConnection && (() => {
          const statusInfo = selectedConnection.status === "pending" ? pendingInfo(selectedConnection) : statusLabels[selectedConnection.status] || { label: selectedConnection.status, variant: "default" as const };
          const isDigital = selectedConnection.productType === "digital";
          return (
            <div className="space-y-4 max-h-[75vh] overflow-y-auto -m-2 p-2">
              {/* Product being requested */}
              <div className="flex items-center gap-3 bg-pink-50 rounded-xl p-3">
                {selectedConnection.productImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedConnection.productImage} alt={selectedConnection.productName} className="w-12 h-12 rounded-lg object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-white flex items-center justify-center text-xl">{isDigital ? "📱" : "📦"}</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-neutral-500">המוצר</p>
                  <p className="font-bold text-sm truncate">{selectedConnection.productName}</p>
                </div>
                <Badge variant={isDigital ? "pink" : "default"} size="sm">
                  {isDigital ? "📱 דיגיטלי" : "📦 פיזי"}
                </Badge>
              </div>

              {/* Creator's full public profile */}
              {selectedConnection.creatorId ? (
                <PublicProfileContent userId={selectedConnection.creatorId} />
              ) : (
                <div className="flex items-center gap-3">
                  <Avatar src={selectedConnection.creatorAvatar} name={selectedConnection.creatorName} size="lg" expandable />
                  <p className="font-bold text-lg">{selectedConnection.creatorName}</p>
                </div>
              )}

              {activeStatuses.includes(selectedConnection.status) && (
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => router.push(`/messages?connection=${selectedConnection.id}`)}
                >
                  💬 שליחת הודעה ל{selectedConnection.creatorName}
                </Button>
              )}

              {!["pending", "rejected", "cancelled"].includes(selectedConnection.status) && (
                <div className="bg-white border border-neutral-100 rounded-xl p-4">
                  <ConnectionTimeline
                    status={selectedConnection.status}
                    role="brand"
                    initiatedBy={selectedConnection.initiatedBy}
                    deliveryType={selectedConnection.productType}
                    deadline={selectedConnection.activeDeadline}
                  />
                </div>
              )}

              <div className="bg-neutral-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">סטטוס</span>
                  <Badge variant={statusInfo.variant} size="sm">{statusInfo.label}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">תאריך הלב</span>
                  <span>{formatDate(selectedConnection.createdAt)}</span>
                </div>
                {selectedConnection.mutualAt && (
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-500">מאטץ&apos;</span>
                    <span>{formatDate(selectedConnection.mutualAt)}</span>
                  </div>
                )}
                {selectedConnection.approvedAt && (
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-500">אישור החיבור</span>
                    <span>{formatDate(selectedConnection.approvedAt)}</span>
                  </div>
                )}
                {selectedConnection.shippedAt && (
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-500">תאריך {isDigital ? "מסירה" : "משלוח"}</span>
                    <span>{formatDate(selectedConnection.shippedAt)}</span>
                  </div>
                )}
                {selectedConnection.deliveredAt && (
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-500">אישור קבלה</span>
                    <span>{formatDate(selectedConnection.deliveredAt)}</span>
                  </div>
                )}
                {selectedConnection.trackingNumber && (
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-500">מספר מעקב</span>
                    <span className="font-mono text-xs">{selectedConnection.trackingNumber}</span>
                  </div>
                )}
                {selectedConnection.completedAt && (
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-500">תאריך סיום</span>
                    <span>{formatDate(selectedConnection.completedAt)}</span>
                  </div>
                )}
                {selectedConnection.revisionCount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-500">בקשות תיקון</span>
                    <span>{selectedConnection.revisionCount}/{maxRevisions}</span>
                  </div>
                )}
              </div>

              {/* Uploaded deliverable */}
              {visibleVideos.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">🎬 הסרטון שהועלה</p>
                  {visibleVideos.map((v) => (
                    <video
                      key={v.id}
                      src={v.url}
                      poster={v.thumbnail_url || undefined}
                      controls
                      preload={v.thumbnail_url ? "none" : "metadata"}
                      className="w-full rounded-xl max-h-72 bg-black"
                      controlsList="nodownload"
                      onContextMenu={(e) => e.preventDefault()}
                    />
                  ))}
                </div>
              )}

              {/* Shipping / Digital access form */}
              {selectedConnection.status === "approved" && (
                <div className="bg-pink-50 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-medium text-pink-700">
                    {isDigital ? "📱 שליחת גישה דיגיטלית" : "📦 פרטי משלוח"}
                  </p>
                  {isDigital ? (
                    <div>
                      <label className="block text-xs text-neutral-500 mb-1">קישור / קוד גישה *</label>
                      <Input
                        placeholder="הכניסו קישור או קוד..."
                        value={shipForm.digitalAccessValue}
                        onChange={(e) => setShipForm((p) => ({ ...p, digitalAccessValue: e.target.value }))}
                      />
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-xs text-neutral-500 mb-1">מספר מעקב</label>
                        <Input
                          placeholder="מספר מעקב למשלוח"
                          value={shipForm.trackingNumber}
                          onChange={(e) => setShipForm((p) => ({ ...p, trackingNumber: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-500 mb-1">קישור מעקב (אופציונלי)</label>
                        <Input
                          placeholder="https://..."
                          value={shipForm.trackingUrl}
                          onChange={(e) => setShipForm((p) => ({ ...p, trackingUrl: e.target.value }))}
                        />
                      </div>
                    </>
                  )}
                  <Button
                    fullWidth
                    loading={updating === selectedConnection.id}
                    onClick={() => {
                      if (isDigital && !shipForm.digitalAccessValue.trim()) {
                        toast("חובה להזין גישה דיגיטלית", "error");
                        return;
                      }
                      updateStatus(selectedConnection.id, "shipped", {
                        tracking_number: shipForm.trackingNumber || undefined,
                        tracking_url: shipForm.trackingUrl || undefined,
                        digital_access_value: shipForm.digitalAccessValue || undefined,
                      });
                    }}
                  >
                    {isDigital ? "שליחת גישה" : "סמן כנשלח"}
                  </Button>
                </div>
              )}

              {/* Video review actions — available as soon as the creator uploaded (FLOW-01) */}
              {canBrandReview(selectedConnection.status) && (
                <div className="space-y-3">
                  <Button
                    fullWidth
                    loading={updating === selectedConnection.id}
                    onClick={() => updateStatus(selectedConnection.id, "completed")}
                  >
                    אישור סרטון — סיום החיבור
                  </Button>
                  {selectedConnection.revisionCount < maxRevisions && (
                    <div className="bg-amber-50 rounded-xl p-4 space-y-2">
                      <label className="block text-xs text-amber-700 font-medium">בקשת תיקון ({selectedConnection.revisionCount}/{maxRevisions} נוצלו)</label>
                      <Textarea
                        placeholder="מה צריך לתקן בסרטון..."
                        value={revisionNotes}
                        onChange={(e) => setRevisionNotes(e.target.value)}
                      />
                      <Button
                        variant="secondary"
                        fullWidth
                        loading={updating === selectedConnection.id}
                        onClick={() => {
                          if (!revisionNotes.trim()) {
                            toast("יש לכתוב מה לתקן", "error");
                            return;
                          }
                          updateStatus(selectedConnection.id, "revision_requested", { revision_notes: revisionNotes });
                        }}
                      >
                        שליחת בקשת תיקון
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Pending hearts: the three states */}
              {selectedConnection.status === "pending" && selectedConnection.mutualAt && (
                <div className="bg-emerald-50 rounded-xl p-4 space-y-3">
                  <p className="text-sm text-emerald-800">
                    🎉 שני הצדדים סימנו לב. אישור החיבור פותח צ&apos;אט, שולח את הבריף ומחייב סרטון אחד מהחבילה.
                  </p>
                  <div className="flex gap-2">
                    <Button fullWidth loading={updating === selectedConnection.id} onClick={() => setConfirmFor(selectedConnection)}>
                      ✅ אישור החיבור
                    </Button>
                    <Button variant="ghost" fullWidth loading={updating === selectedConnection.id} onClick={() => updateStatus(selectedConnection.id, "cancelled")}>
                      ביטול
                    </Button>
                  </div>
                </div>
              )}
              {selectedConnection.status === "pending" && !selectedConnection.mutualAt && selectedConnection.initiatedBy === "brand" && (
                <div className="bg-pink-50 rounded-xl p-4 space-y-3">
                  <p className="text-sm text-pink-700">💗 שלחתם לב ל{selectedConnection.creatorName}. כשהיוצר/ת יאשר/תאשר, החיבור יעבור ללשונית ״מאטץ&apos;״ לאישורכם.</p>
                  <Button
                    variant="secondary"
                    fullWidth
                    loading={updating === selectedConnection.id}
                    onClick={() => updateStatus(selectedConnection.id, "cancelled")}
                  >
                    ביטול הלב
                  </Button>
                </div>
              )}
              {selectedConnection.status === "pending" && !selectedConnection.mutualAt && selectedConnection.initiatedBy !== "brand" && (
                <div className="space-y-2 pt-2">
                  <p className="text-sm text-amber-700">💗 {selectedConnection.creatorName} בחר/ה בכם. לב בחזרה פותח מאטץ&apos; — החיוב רק באישור החיבור.</p>
                  <div className="flex gap-3">
                    <Button fullWidth loading={updating === selectedConnection.id} onClick={() => updateStatus(selectedConnection.id, "mutual")}>
                      💗 לב בחזרה
                    </Button>
                    <Button variant="danger" fullWidth loading={updating === selectedConnection.id} onClick={() => updateStatus(selectedConnection.id, "rejected")}>
                      לא מתאים
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      <FeedbackModal
        key="purchase"
        open={purchaseOpen}
        onClose={() => setPurchaseOpen(false)}
        title="רכישת סרטונים"
        initialKind="contact"
        initialSubject="רכישת סרטונים (קרדיטים)"
        intro="תשלום אונליין יתווסף בקרוב. כתבו כמה סרטונים תרצו ונחזור אליכם עם הצעה ואישור הטעינה — בדרך כלל באותו יום."
      />
    </main>
  );
}
