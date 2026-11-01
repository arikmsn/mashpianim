"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Badge, Avatar, Card, Button, useToast } from "@/components/ui";
import { useAuth } from "@/hooks/use-auth";

type TabType = "active" | "pending" | "completed";

const statusConfig: Record<
  string,
  { label: string; variant: "info" | "warning" | "purple" | "default" | "success" | "danger" | "pink"; tab: TabType }
> = {
  pending: { label: "ממתין לאישור", variant: "default", tab: "pending" },
  approved: { label: "אושר", variant: "success", tab: "active" },
  rejected: { label: "נדחה", variant: "danger", tab: "completed" },
  shipped: { label: "נשלח", variant: "info", tab: "active" },
  filming: { label: "בצילום", variant: "warning", tab: "active" },
  uploaded: { label: "הועלה", variant: "purple", tab: "active" },
  in_review: { label: "בבדיקה", variant: "purple", tab: "active" },
  revision_requested: { label: "נדרש תיקון", variant: "warning", tab: "active" },
  completed: { label: "הושלם", variant: "success", tab: "completed" },
  cancelled: { label: "בוטל", variant: "danger", tab: "completed" },
};

interface Connection {
  id: string;
  product: string;
  brand: string;
  status: string;
  daysLeft: number | null;
}

const mockConnections: Connection[] = [
  { id: "1", product: "סרום ויטמין C", brand: "GlowUp Skincare", status: "filming", daysLeft: 7 },
  { id: "2", product: "שעון ספורט חכם", brand: "TechFit", status: "shipped", daysLeft: 5 },
  { id: "3", product: "תיק גב עור טבעוני", brand: "UrbanStyle", status: "in_review", daysLeft: 3 },
  { id: "4", product: "ערכת בישול שף", brand: "ChefHome", status: "pending", daysLeft: null },
  { id: "5", product: "סט יוגה פרימיום", brand: "ZenLife", status: "pending", daysLeft: null },
  { id: "6", product: "מנורת לד דקורטיבית", brand: "LightHouse", status: "completed", daysLeft: null },
];

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
  return ["shipped", "filming", "revision_requested"].includes(status);
}

export default function ConnectionsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("active");
  const [connections, setConnections] = useState<Connection[]>(mockConnections);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadConnectionIdRef = useRef<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    async function fetchConnections() {
      try {
        const res = await fetch("/api/connections");
        if (res.ok) {
          const data = await res.json();
          if (data.connections && data.connections.length > 0) {
            setConnections(
              data.connections.map((c: Record<string, unknown>) => {
                const deadline = c.film_deadline as string | null;
                let daysLeft: number | null = null;
                if (deadline) {
                  const diff = new Date(deadline).getTime() - Date.now();
                  daysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
                }
                return {
                  id: c.id as string,
                  product: (c.product_name as string) || "",
                  brand: (c.brand_name as string) || (c.shop_name as string) || "",
                  status: (c.status as string) || "pending",
                  daysLeft,
                };
              })
            );
          }
        }
      } catch {
        // Keep mock data
      } finally {
        setLoading(false);
      }
    }
    fetchConnections();
  }, []);

  function handleUploadClick(connectionId: string) {
    uploadConnectionIdRef.current = connectionId;
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const connectionId = uploadConnectionIdRef.current;
    if (!file || !connectionId) return;

    e.target.value = "";

    if (!file.type.startsWith("video/")) {
      toast("יש לבחור קובץ וידאו", "error");
      return;
    }

    if (file.size > 500 * 1024 * 1024) {
      toast("הקובץ גדול מדי (מקסימום 500MB)", "error");
      return;
    }

    setUploadingId(connectionId);

    try {
      const formData = new FormData();
      formData.append("video", file);
      formData.append("connectionId", connectionId);

      const res = await fetch("/api/videos", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        toast("הסרטון הועלה בהצלחה! 🎬", "success");
        setConnections((prev) =>
          prev.map((c) =>
            c.id === connectionId ? { ...c, status: "uploaded" } : c
          )
        );
      } else {
        const data = await res.json();
        toast(data.error || "שגיאה בהעלאת הסרטון", "error");
      }
    } catch {
      toast("שגיאה בהעלאת הסרטון", "error");
    } finally {
      setUploadingId(null);
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
    { key: "completed", label: "הושלמו" },
  ];

  return (
    <main className="min-h-screen bg-background">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFileSelected}
      />

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
              const status = statusConfig[conn.status] || {
                label: conn.status,
                variant: "default" as const,
              };
              const showUpload = canUploadVideo(conn.status);
              const isUploading = uploadingId === conn.id;

              return (
                <motion.div
                  key={conn.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card hover padding="md">
                    <button
                      className="w-full text-right"
                      onClick={() => router.push(`/messages?connection=${conn.id}`)}
                    >
                      <div className="flex items-center gap-4">
                        <Avatar name={conn.brand} size="lg" />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-neutral-900 truncate">
                            {conn.product}
                          </h3>
                          <p className="text-sm text-neutral-500">{conn.brand}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant={status.variant} size="sm" dot>
                              {status.label}
                            </Badge>
                            {conn.daysLeft !== null && (
                              <span className="text-xs text-neutral-400">
                                {conn.daysLeft} ימים נותרו
                              </span>
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

                    {showUpload && (
                      <div className="mt-3 pt-3 border-t border-neutral-100">
                        <Button
                          size="sm"
                          variant={isUploading ? "secondary" : "primary"}
                          fullWidth
                          loading={isUploading}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUploadClick(conn.id);
                          }}
                        >
                          {isUploading ? "מעלה סרטון..." : "📹 העלאת סרטון"}
                        </Button>
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
    </main>
  );
}
