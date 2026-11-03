"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, Badge, Button, Modal, Avatar, Input, Textarea, useToast } from "@/components/ui";
import { ConnectionTimeline, PublicProfileContent } from "@/components/features";
import { createClient } from "@/lib/supabase/client";
import { swrFetch } from "@/lib/client-cache";
import { activeDeadlineField, canBrandReview } from "@/lib/connection-flow";

interface Connection {
  id: string;
  creatorId: string | null;
  initiatedBy: "creator" | "brand";
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
  // The deadline that applies to the current step (ship / deliver / film / review)
  activeDeadline: string | null;
}

type TabId = "pending" | "active" | "completed";

const tabs: { id: TabId; label: string }[] = [
  { id: "pending", label: "ממתינים" },
  { id: "active", label: "פעילים" },
  { id: "completed", label: "הושלמו" },
];

const statusLabels: Record<string, { label: string; variant: "pink" | "success" | "warning" | "default" }> = {
  pending: { label: "ממתין לאישור", variant: "warning" },
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

const pendingStatuses = ["pending"];
const activeStatuses = ["approved", "shipped", "delivered", "filming", "uploaded", "in_review", "revision_requested"];
const completedStatuses = ["completed", "rejected", "cancelled"];
// Statuses in which a deliverable exists for the brand to watch
const videoStatuses = ["uploaded", "in_review", "revision_requested", "completed"];

interface ConnectionVideo {
  id: string;
  url: string;
  thumbnail_url?: string | null;
  status: string;
  created_at: string;
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

// useSearchParams needs a Suspense boundary for the static shell
export default function BrandConnectionsPage() {
  return (
    <Suspense>
      <BrandConnectionsPageInner />
    </Suspense>
  );
}

function tabFor(status: string): TabId {
  if (pendingStatuses.includes(status)) return "pending";
  if (activeStatuses.includes(status)) return "active";
  return "completed";
}

function BrandConnectionsPageInner() {
  const searchParams = useSearchParams();
  // `?open=<connectionId>` (from a notification) switches to its tab and opens its modal
  const openId = searchParams.get("open");
  const handledOpenRef = useRef<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("pending");
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);

  useEffect(() => {
    if (!openId || connections.length === 0 || handledOpenRef.current === openId) return;
    const target = connections.find((c) => c.id === openId);
    if (!target) return;
    handledOpenRef.current = openId;
    const t = setTimeout(() => {
      setActiveTab(tabFor(target.status));
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

  useEffect(() => {
    fetchConnections();
  }, []);

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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "connections" },
        () => {
          fetchConnections();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchConnections() {
    const apply = (data: { connections?: Record<string, unknown>[]; settings?: { max_revisions?: number } }) => {
      if (typeof data.settings?.max_revisions === "number") setMaxRevisions(data.settings.max_revisions);
      const conns = data.connections || [];
      setConnections(
        conns.map((c) => ({
          id: c.id as string,
          creatorId: (c as any).creator_profiles?.user_id || null,
          initiatedBy: (c as any).initiated_by === "brand" ? "brand" : "creator",
          creatorName: (c as any).creator_profiles?.users?.full_name || (c as any).creator?.full_name || "יוצר/ת",
          creatorAvatar: (c as any).creator_profiles?.users?.avatar_url || null,
          productName: (c as any).products?.name || "מוצר",
          productImage: (c as any).products?.image_url || null,
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
  }

  async function updateStatus(connectionId: string, newStatus: string, extra?: Record<string, unknown>) {
    setUpdating(connectionId);
    try {
      const res = await fetch(`/api/connections/${connectionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, ...extra }),
      });

      if (res.ok) {
        setConnections((prev) =>
          prev.map((c) => (c.id === connectionId ? { ...c, status: newStatus } : c))
        );
        if (newStatus === "approved") {
          toast("🎉 יש מאטץ'! הצ'אט נפתח והבריף נשלח", "success");
        } else {
          const label = statusLabels[newStatus]?.label || newStatus;
          toast(`סטטוס עודכן: ${label}`, "success");
        }
        setSelectedConnection(null);
        setShipForm({ trackingNumber: "", trackingUrl: "", digitalAccessValue: "" });
        setRevisionNotes("");
      } else {
        const data = await res.json().catch(() => ({}));
        toast((data as any).error || "שגיאה בעדכון", "error");
      }
    } catch {
      toast("שגיאה בעדכון", "error");
    } finally {
      setUpdating(null);
    }
  }

  const filtered = connections.filter((c) => {
    if (activeTab === "pending") return pendingStatuses.includes(c.status);
    if (activeTab === "active") return activeStatuses.includes(c.status);
    return completedStatuses.includes(c.status);
  });

  const tabCounts = {
    pending: connections.filter((c) => pendingStatuses.includes(c.status)).length,
    active: connections.filter((c) => activeStatuses.includes(c.status)).length,
    completed: connections.filter((c) => completedStatuses.includes(c.status)).length,
  };

  function getActions(conn: Connection) {
    const actions: { label: string; status: string; variant: "primary" | "secondary" | "danger"; needsModal?: boolean }[] = [];
    switch (conn.status) {
      case "pending":
        if (conn.initiatedBy === "brand") {
          actions.push({ label: "ביטול הלב", status: "cancelled", variant: "secondary" });
        } else {
          actions.push({ label: "💗 אישור — מאטץ'", status: "approved", variant: "primary" });
          actions.push({ label: "דחייה", status: "rejected", variant: "danger" });
        }
        break;
      case "approved":
        actions.push({ label: conn.productType === "digital" ? "שליחת גישה" : "עדכון משלוח", status: "shipped", variant: "primary", needsModal: true });
        break;
      case "uploaded":
      case "in_review":
        actions.push({ label: "סקירת סרטון", status: "completed", variant: "primary", needsModal: true });
        break;
    }
    return actions;
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("he-IL");
  }

  return (
    <main className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-neutral-100">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold mb-3">חיבורים</h1>
          <div className="flex gap-1 bg-neutral-50 rounded-xl p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-white text-pink-500 shadow-sm"
                    : "text-neutral-500"
                }`}
              >
                {tab.label}
                {tabCounts[tab.id] > 0 && (
                  <span className={`mr-1 text-xs ${
                    activeTab === tab.id ? "text-pink-400" : "text-neutral-400"
                  }`}>
                    ({tabCounts[tab.id]})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4">
        {loading ? (
          <ConnectionsSkeleton />
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-neutral-400">
            <span className="text-4xl block mb-3">
              {activeTab === "pending" ? "⏳" : activeTab === "active" ? "🔗" : "🏆"}
            </span>
            <p>אין חיבורים {activeTab === "pending" ? "ממתינים" : activeTab === "active" ? "פעילים" : "שהושלמו"}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((conn, i) => {
              const statusInfo =
                conn.status === "pending" && conn.initiatedBy === "brand"
                  ? { label: "💗 הלב נשלח — ממתין ליוצר/ת", variant: "pink" as const }
                  : conn.status === "pending"
                    ? { label: "💗 סימן/ה אתכם", variant: "warning" as const }
                    : statusLabels[conn.status] || { label: conn.status, variant: "default" as const };
              const actions = getActions(conn);
              return (
                <motion.div
                  key={conn.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
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
                          {formatDate(conn.createdAt)}
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
                              if (action.needsModal) {
                                setSelectedConnection(conn);
                              } else {
                                updateStatus(conn.id, action.status);
                              }
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

      <Modal
        open={!!selectedConnection}
        onClose={() => { setSelectedConnection(null); setShipForm({ trackingNumber: "", trackingUrl: "", digitalAccessValue: "" }); setRevisionNotes(""); }}
        title="פרטי חיבור"
        size="lg"
      >
        {selectedConnection && (() => {
          const statusInfo = statusLabels[selectedConnection.status] || { label: selectedConnection.status, variant: "default" as const };
          const isDigital = selectedConnection.productType === "digital";
          return (
            <div className="space-y-4 max-h-[75vh] overflow-y-auto -m-2 p-2">
              {/* Product being requested */}
              <div className="flex items-center gap-3 bg-pink-50 rounded-xl p-3">
                {selectedConnection.productImage ? (
                  <img src={selectedConnection.productImage} alt={selectedConnection.productName} className="w-12 h-12 rounded-lg object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-white flex items-center justify-center text-xl">{isDigital ? "📱" : "📦"}</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-neutral-500">בקשה למוצר</p>
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
                  <span className="text-neutral-500">תאריך בקשה</span>
                  <span>{formatDate(selectedConnection.createdAt)}</span>
                </div>
                {selectedConnection.approvedAt && (
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-500">תאריך אישור</span>
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
                    <span>{selectedConnection.revisionCount}/2</span>
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

              {selectedConnection.status === "pending" && selectedConnection.initiatedBy === "brand" && (
                <div className="bg-pink-50 rounded-xl p-4 space-y-3">
                  <p className="text-sm text-pink-700">💗 שלחתם לב ל{selectedConnection.creatorName}. ברגע שהיוצר/ת יאשר/תאשר ייפתח צ&apos;אט ויירד קרדיט אחד.</p>
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

              {/* Basic actions for other statuses */}
              {selectedConnection.status === "pending" && selectedConnection.initiatedBy !== "brand" && (
                <div className="flex gap-3 pt-2">
                  <Button
                    fullWidth
                    loading={updating === selectedConnection.id}
                    onClick={() => updateStatus(selectedConnection.id, "approved")}
                  >
                    אישור
                  </Button>
                  <Button
                    variant="danger"
                    fullWidth
                    loading={updating === selectedConnection.id}
                    onClick={() => updateStatus(selectedConnection.id, "rejected")}
                  >
                    דחייה
                  </Button>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>
    </main>
  );
}
