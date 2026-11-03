"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge, Button, Card, Modal, Textarea, useToast } from "@/components/ui";

type ModerationStatus = "pending" | "approved" | "rejected";
type ModerationItem = {
  id: string;
  connectionId: string;
  creator: string;
  product: string;
  brand: string;
  storagePath: string;
  status: ModerationStatus;
  flags: string[];
  createdAt: string;
};
type ChatFlag = {
  id: string;
  from: string;
  to: string;
  message: string;
  flagType: string;
  time: string;
  blocked: boolean;
};
type PortfolioItem = {
  id: string;
  creator: string;
  title: string;
  status: string;
  notes: string | null;
  thumbnail: string | null;
  createdAt: string;
};

export default function AdminModerationPage() {
  const [tab, setTab] = useState<"videos" | "portfolio" | "chat">("videos");
  const [selectedVideo, setSelectedVideo] = useState<ModerationItem | null>(null);
  const [items, setItems] = useState<ModerationItem[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [chatFlags, setChatFlags] = useState<ChatFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [revisionNotes, setRevisionNotes] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const res = await fetch("/api/admin/moderation");
      if (res.ok) {
        const data = await res.json();
        if (data.videos) {
          setItems(
            data.videos.map((v: Record<string, unknown>) => ({
              id: v.id as string,
              connectionId: v.connection_id as string,
              creator: (v as any).connections?.creator_profiles?.users?.full_name || "יוצר/ת",
              product: (v as any).connections?.products?.name || "מוצר",
              brand: (v as any).connections?.brand_profiles?.shop_name || "עסק",
              storagePath: (v.storage_path as string) || "",
              status: (v.status as ModerationStatus) || "pending",
              flags: ((v.moderation_flags as string[]) || []),
              createdAt: (v.created_at as string) || "",
            }))
          );
        }
        if (data.portfolioVideos) {
          setPortfolio(
            data.portfolioVideos.map((v: Record<string, unknown>) => ({
              id: v.id as string,
              creator: (v.creator_name as string) || "יוצר/ת",
              title: (v.title as string) || "סרטון פורטפוליו",
              status: (v.status as string) || "approved",
              notes: (v.revision_notes as string) || null,
              thumbnail: (v.thumbnail_url as string) || null,
              createdAt: (v.created_at as string) || "",
            }))
          );
        }
        if (data.flaggedMessages) {
          setChatFlags(
            data.flaggedMessages.map((m: Record<string, unknown>) => ({
              id: m.id as string,
              from: (m.sender_name as string) || "שולח",
              to: (m.receiver_name as string) || "מקבל",
              message: (m.content as string) || "",
              flagType: (m.flag_type as string) || "contact_info",
              time: (m.created_at as string) || "",
              blocked: (m.blocked as boolean) || false,
            }))
          );
        }
      }
    } catch {
      // API unavailable
    } finally {
      setLoading(false);
    }
  }

  async function loadVideoUrl(videoId: string) {
    try {
      const res = await fetch(`/api/videos/${videoId}`);
      if (res.ok) {
        const data = await res.json();
        setVideoUrl(data.viewUrl || null);
      }
    } catch {
      // failed to load
    }
  }

  async function handleAction(videoId: string, action: "approve" | "revision" | "reject", notes?: string) {
    setActing(videoId);
    try {
      const res = await fetch("/api/admin/moderation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId, action, revision_notes: notes }),
      });

      if (res.ok) {
        const newStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : "pending";
        setItems((prev) =>
          prev.map((i) => (i.id === videoId ? { ...i, status: newStatus as ModerationStatus } : i))
        );
        const msg = action === "approve" ? "הסרטון אושר" : action === "revision" ? "נשלחה בקשת תיקון" : "הסרטון נדחה";
        toast(msg, action === "approve" ? "success" : "error");
        setSelectedVideo(null);
        setRevisionNotes("");
        setVideoUrl(null);
      } else {
        const data = await res.json().catch(() => ({}));
        toast((data as any).error || "שגיאה", "error");
      }
    } catch {
      toast("שגיאה בפעולה", "error");
    } finally {
      setActing(null);
    }
  }

  // Portfolio takedown / restore (MOD-01)
  async function handlePortfolioAction(videoId: string, action: "reject" | "restore") {
    setActing(videoId);
    try {
      const res = await fetch("/api/admin/moderation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId, action }),
      });
      if (res.ok) {
        const newStatus = action === "reject" ? "rejected" : "approved";
        setPortfolio((prev) => prev.map((p) => (p.id === videoId ? { ...p, status: newStatus } : p)));
        toast(action === "reject" ? "הסרטון הוסר מתיק העבודות" : "הסרטון שוחזר", action === "reject" ? "error" : "success");
      } else {
        const data = await res.json().catch(() => ({}));
        toast((data as any).error || "שגיאה", "error");
      }
    } catch {
      toast("שגיאה בפעולה", "error");
    } finally {
      setActing(null);
    }
  }

  function formatTimeAgo(dateStr: string) {
    if (!dateStr) return "";
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "פחות משעה";
    if (hours < 24) return `${hours} שעות`;
    return `${Math.floor(hours / 24)} ימים`;
  }

  const pendingCount = items.filter((i) => i.status === "pending").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">מודרציה</h1>
          <p className="text-neutral-500 text-sm mt-1">בדיקת תכנים ושמירה על בטיחות הפלטפורמה</p>
        </div>
        <Badge variant="warning" size="lg" dot>
          {pendingCount} ממתינים
        </Badge>
      </div>

      <div className="flex gap-1 bg-neutral-100 rounded-xl p-1 mb-6 w-fit">
        <button
          onClick={() => setTab("videos")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "videos" ? "bg-white shadow-sm text-pink-500" : "text-neutral-500"
          }`}
        >
          🎬 סרטונים ({pendingCount})
        </button>
        <button
          onClick={() => setTab("portfolio")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "portfolio" ? "bg-white shadow-sm text-pink-500" : "text-neutral-500"
          }`}
        >
          🗂️ תיקי עבודות ({portfolio.length})
        </button>
        <button
          onClick={() => setTab("chat")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "chat" ? "bg-white shadow-sm text-pink-500" : "text-neutral-500"
          }`}
        >
          💬 הודעות חסומות ({chatFlags.length})
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-4 border border-neutral-100 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-24 h-16 rounded-lg bg-neutral-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-neutral-200 rounded-lg w-32" />
                  <div className="h-3 bg-neutral-100 rounded-lg w-48" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {tab === "videos" && (
            <div className="space-y-3">
              <AnimatePresence>
                {items.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                  >
                    <Card padding="md">
                      <div className="flex items-center gap-4">
                        <div className="w-24 h-16 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-400 text-xs flex-shrink-0">
                          🎬
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{item.product}</p>
                            {item.flags.length > 0 && (
                              <Badge variant="danger" size="sm">
                                ⚠ {item.flags.length} התרעות
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-neutral-400">
                            {item.creator} → {item.brand} • לפני {formatTimeAgo(item.createdAt)}
                          </p>
                          {item.flags.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {item.flags.map((flag, i) => (
                                <Badge key={i} variant="danger" size="sm">
                                  {flag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {item.status === "pending" ? (
                            <>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  setSelectedVideo(item);
                                  loadVideoUrl(item.id);
                                }}
                              >
                                צפייה
                              </Button>
                              <Button
                                size="sm"
                                variant="primary"
                                loading={acting === item.id}
                                onClick={() => handleAction(item.id, "approve")}
                              >
                                אישור
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                loading={acting === item.id}
                                onClick={() => handleAction(item.id, "reject")}
                              >
                                דחייה
                              </Button>
                            </>
                          ) : (
                            <Badge
                              variant={item.status === "approved" ? "success" : "danger"}
                              size="md"
                            >
                              {item.status === "approved" ? "✓ אושר" : "✗ נדחה"}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>

              {pendingCount === 0 && !loading && (
                <div className="text-center py-12 text-neutral-400">
                  <span className="text-4xl block mb-3">✅</span>
                  <p className="font-medium">אין סרטונים ממתינים</p>
                  <p className="text-sm mt-1">כל הסרטונים נבדקו</p>
                </div>
              )}
            </div>
          )}

          {tab === "portfolio" && (
            <div className="space-y-3">
              <p className="text-xs text-neutral-500">
                סרטוני תיק עבודות מתפרסמים מיד. הסרה מסתירה את הסרטון מעסקים ומורידה אותו מספירת 5 הסרטונים; היוצר/ת מקבל/ת התראה.
              </p>
              {portfolio.length === 0 ? (
                <div className="text-center py-12 text-neutral-400">
                  <span className="text-4xl block mb-3">🗂️</span>
                  <p className="font-medium">אין סרטוני תיק עבודות</p>
                </div>
              ) : (
                portfolio.map((item) => (
                  <Card key={item.id} padding="md">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-24 rounded-lg bg-neutral-100 overflow-hidden flex items-center justify-center text-neutral-400 flex-shrink-0">
                        {item.thumbnail ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
                        ) : (
                          "🎬"
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.title}</p>
                        <p className="text-xs text-neutral-400">{item.creator} • לפני {formatTimeAgo(item.createdAt)}</p>
                        {item.status === "rejected" && item.notes && (
                          <p className="text-xs text-red-500 mt-1">{item.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={item.status === "rejected" ? "danger" : item.status === "approved" ? "success" : "warning"} size="sm">
                          {item.status === "rejected" ? "הוסר" : item.status === "approved" ? "מוצג" : "ממתין"}
                        </Badge>
                        <Button size="sm" variant="secondary" onClick={() => { setPreviewId(item.id); loadVideoUrl(item.id); }}>
                          צפייה
                        </Button>
                        {item.status === "rejected" ? (
                          <Button size="sm" variant="primary" loading={acting === item.id} onClick={() => handlePortfolioAction(item.id, "restore")}>
                            שחזור
                          </Button>
                        ) : (
                          <Button size="sm" variant="danger" loading={acting === item.id} onClick={() => handlePortfolioAction(item.id, "reject")}>
                            הסרה
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}

          {tab === "chat" && (
            <div className="space-y-3">
              {chatFlags.length === 0 ? (
                <div className="text-center py-12 text-neutral-400">
                  <span className="text-4xl block mb-3">💬</span>
                  <p className="font-medium">אין הודעות חסומות</p>
                </div>
              ) : (
                chatFlags.map((flag) => (
                  <Card key={flag.id} padding="md">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500">
                        🛡️
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="danger" size="sm">{flag.flagType}</Badge>
                          <span className="text-xs text-neutral-400">{formatTimeAgo(flag.time)}</span>
                        </div>
                        <p className="text-sm">
                          <span className="font-medium">{flag.from}</span>
                          <span className="text-neutral-400"> → </span>
                          <span className="font-medium">{flag.to}</span>
                        </p>
                        <p className="text-sm text-neutral-500 mt-1 bg-neutral-50 px-3 py-1.5 rounded-lg">
                          &quot;{flag.message}&quot;
                        </p>
                      </div>
                      <Badge variant={flag.blocked ? "success" : "danger"} size="sm" dot>
                        {flag.blocked ? "נחסם" : "פעיל"}
                      </Badge>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}
        </>
      )}

      <Modal
        open={!!previewId}
        onClose={() => { setPreviewId(null); setVideoUrl(null); }}
        title="צפייה בסרטון תיק עבודות"
        size="lg"
      >
        <div className="aspect-[9/16] max-h-[60vh] bg-neutral-900 rounded-xl overflow-hidden mx-auto w-fit">
          {videoUrl ? (
            <video src={videoUrl} controls controlsList="nodownload" onContextMenu={(e) => e.preventDefault()} className="h-full w-auto mx-auto" />
          ) : (
            <div className="flex items-center justify-center h-full text-white/50 px-12">טוען סרטון...</div>
          )}
        </div>
      </Modal>

      <Modal
        open={!!selectedVideo}
        onClose={() => { setSelectedVideo(null); setRevisionNotes(""); setVideoUrl(null); }}
        title="סקירת סרטון"
        size="lg"
      >
        {selectedVideo && (
          <div className="space-y-4">
            <div className="aspect-[9/16] max-h-[50vh] bg-neutral-900 rounded-xl overflow-hidden mx-auto w-fit">
              {videoUrl ? (
                <video
                  src={videoUrl}
                  controls
                  controlsList="nodownload"
                  onContextMenu={(e) => e.preventDefault()}
                  className="h-full w-auto mx-auto"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-white/50 px-12">
                  <div className="text-center">
                    <span className="text-5xl block mb-4">🎬</span>
                    <p>טוען סרטון...</p>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-neutral-50 rounded-xl p-3 space-y-1">
              <p className="text-sm"><span className="text-neutral-500">יוצר:</span> {selectedVideo.creator}</p>
              <p className="text-sm"><span className="text-neutral-500">מוצר:</span> {selectedVideo.product}</p>
              <p className="text-sm"><span className="text-neutral-500">עסק:</span> {selectedVideo.brand}</p>
            </div>

            {selectedVideo.flags.length > 0 && (
              <div className="bg-red-50 rounded-xl p-3">
                <p className="text-sm font-medium text-red-700 mb-1">התרעות:</p>
                <div className="flex gap-1 flex-wrap">
                  {selectedVideo.flags.map((flag, i) => (
                    <Badge key={i} variant="danger" size="sm">{flag}</Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                fullWidth
                loading={acting === selectedVideo.id}
                onClick={() => handleAction(selectedVideo.id, "approve")}
              >
                אישור הסרטון
              </Button>
              <Button
                variant="danger"
                fullWidth
                loading={acting === selectedVideo.id}
                onClick={() => handleAction(selectedVideo.id, "reject")}
              >
                דחיית הסרטון
              </Button>
            </div>

            <div className="bg-amber-50 rounded-xl p-3 space-y-2">
              <label className="block text-xs text-amber-700 font-medium">בקשת תיקון (שולח ליוצר)</label>
              <Textarea
                placeholder="מה צריך לתקן בסרטון..."
                value={revisionNotes}
                onChange={(e) => setRevisionNotes(e.target.value)}
              />
              <Button
                variant="secondary"
                fullWidth
                loading={acting === selectedVideo.id}
                onClick={() => {
                  if (!revisionNotes.trim()) {
                    toast("יש לכתוב מה לתקן", "error");
                    return;
                  }
                  handleAction(selectedVideo.id, "revision", revisionNotes);
                }}
              >
                שליחת בקשת תיקון
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
