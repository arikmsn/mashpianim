"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, Badge, Button, Modal, Avatar, useToast } from "@/components/ui";

interface Connection {
  id: string;
  creatorName: string;
  creatorAvatar: string | null;
  productName: string;
  productImage: string | null;
  status: string;
  createdAt: string;
  approvedAt: string | null;
  shippedAt: string | null;
  completedAt: string | null;
}

const mockConnections: Connection[] = [
  { id: "1", creatorName: "נועה כהן", creatorAvatar: null, productName: "סרום ויטמין C", productImage: null, status: "pending", createdAt: "2024-01-15T10:00:00Z", approvedAt: null, shippedAt: null, completedAt: null },
  { id: "2", creatorName: "דנה לוי", creatorAvatar: null, productName: "שעון ספורט חכם", productImage: null, status: "approved", createdAt: "2024-01-14T09:00:00Z", approvedAt: "2024-01-14T12:00:00Z", shippedAt: null, completedAt: null },
  { id: "3", creatorName: "שרה אברהם", creatorAvatar: null, productName: "תיק גב עור טבעוני", productImage: null, status: "filming", createdAt: "2024-01-13T08:00:00Z", approvedAt: "2024-01-13T10:00:00Z", shippedAt: "2024-01-13T15:00:00Z", completedAt: null },
  { id: "4", creatorName: "מיכל דוד", creatorAvatar: null, productName: "ערכת בישול שף", productImage: null, status: "in_review", createdAt: "2024-01-12T07:00:00Z", approvedAt: "2024-01-12T09:00:00Z", shippedAt: "2024-01-12T14:00:00Z", completedAt: null },
  { id: "5", creatorName: "יעל גרין", creatorAvatar: null, productName: "סט יוגה פרימיום", productImage: null, status: "completed", createdAt: "2024-01-11T06:00:00Z", approvedAt: "2024-01-11T08:00:00Z", shippedAt: "2024-01-11T12:00:00Z", completedAt: "2024-01-18T16:00:00Z" },
];

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
  filming: { label: "בצילום", variant: "pink" },
  uploaded: { label: "סרטון הועלה", variant: "pink" },
  in_review: { label: "בבדיקה", variant: "warning" },
  revision_requested: { label: "דרוש תיקון", variant: "warning" },
  completed: { label: "הושלם", variant: "success" },
  cancelled: { label: "בוטל", variant: "default" },
};

const pendingStatuses = ["pending"];
const activeStatuses = ["approved", "shipped", "filming", "uploaded", "in_review", "revision_requested"];
const completedStatuses = ["completed", "rejected", "cancelled"];

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

export default function BrandConnectionsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("pending");
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchConnections();
  }, []);

  async function fetchConnections() {
    try {
      const res = await fetch("/api/connections");
      if (res.ok) {
        const data = await res.json();
        const conns = data.connections || [];
        if (conns.length > 0) {
          setConnections(
            conns.map((c: Record<string, unknown>) => ({
              id: c.id as string,
              creatorName: (c as any).creator?.full_name || (c.creator_name as string) || "יוצר/ת",
              creatorAvatar: (c as any).creator?.avatar_url || null,
              productName: (c as any).products?.name || (c.product_name as string) || "מוצר",
              productImage: (c as any).products?.image_url || null,
              status: c.status as string,
              createdAt: c.created_at as string,
              approvedAt: (c.approved_at as string) || null,
              shippedAt: (c.shipped_at as string) || null,
              completedAt: (c.completed_at as string) || null,
            }))
          );
          setLoading(false);
          return;
        }
      }
    } catch {
      // Fall through to mock
    }
    setConnections(mockConnections);
    setLoading(false);
  }

  async function updateStatus(connectionId: string, newStatus: string) {
    setUpdating(connectionId);
    try {
      const res = await fetch(`/api/connections/${connectionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        setConnections((prev) =>
          prev.map((c) => (c.id === connectionId ? { ...c, status: newStatus } : c))
        );
        const label = statusLabels[newStatus]?.label || newStatus;
        toast(`סטטוס עודכן: ${label}`, "success");
        setSelectedConnection(null);
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
    const actions: { label: string; status: string; variant: "primary" | "secondary" | "danger" }[] = [];
    switch (conn.status) {
      case "pending":
        actions.push({ label: "אישור", status: "approved", variant: "primary" });
        actions.push({ label: "דחייה", status: "rejected", variant: "danger" });
        break;
      case "approved":
        actions.push({ label: "סמן כנשלח", status: "shipped", variant: "primary" });
        actions.push({ label: "ביטול", status: "cancelled", variant: "danger" });
        break;
      case "in_review":
        actions.push({ label: "אישור סרטון", status: "completed", variant: "primary" });
        actions.push({ label: "בקשת תיקון", status: "revision_requested", variant: "secondary" });
        break;
    }
    return actions;
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("he-IL");
  }

  return (
    <main className="min-h-screen bg-background">
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
              const statusInfo = statusLabels[conn.status] || { label: conn.status, variant: "default" as const };
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
                      <Avatar name={conn.creatorName} size="md" />
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
                              updateStatus(conn.id, action.status);
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
        onClose={() => setSelectedConnection(null)}
        title="פרטי חיבור"
      >
        {selectedConnection && (() => {
          const statusInfo = statusLabels[selectedConnection.status] || { label: selectedConnection.status, variant: "default" as const };
          const actions = getActions(selectedConnection);
          return (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar name={selectedConnection.creatorName} size="lg" />
                <div>
                  <p className="font-bold text-lg">{selectedConnection.creatorName}</p>
                  <p className="text-sm text-pink-500">{selectedConnection.productName}</p>
                </div>
              </div>

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
                    <span className="text-neutral-500">תאריך משלוח</span>
                    <span>{formatDate(selectedConnection.shippedAt)}</span>
                  </div>
                )}
                {selectedConnection.completedAt && (
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-500">תאריך סיום</span>
                    <span>{formatDate(selectedConnection.completedAt)}</span>
                  </div>
                )}
              </div>

              {actions.length > 0 && (
                <div className="flex gap-3 pt-2">
                  {actions.map((action) => (
                    <Button
                      key={action.status}
                      fullWidth
                      variant={action.variant === "primary" ? "primary" : action.variant === "danger" ? "danger" : "secondary"}
                      loading={updating === selectedConnection.id}
                      onClick={() => updateStatus(selectedConnection.id, action.status)}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </Modal>
    </main>
  );
}
