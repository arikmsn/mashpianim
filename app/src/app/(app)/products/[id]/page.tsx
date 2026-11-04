"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar, Badge, Button, Card, Modal, useToast, type BadgeProps } from "@/components/ui";
import { ConnectionTimeline, ProfileModal } from "@/components/features";
import { useAuth } from "@/hooks/use-auth";
import { useDeliverableUpload } from "@/hooks/use-deliverable-upload";
import { createClient } from "@/lib/supabase/client";
import { swrFetch, fetchJson } from "@/lib/client-cache";
import { FORMAT_LINES, briefDataLines, hasBriefContent, definesFormat, type BriefData } from "@/lib/brief";
import { displayCategory } from "@/lib/categories";
import { activeDeadlineField, hasChatHistory } from "@/lib/connection-flow";
import { toDirectImageUrl } from "@/lib/images";
import { MAX_VIDEO_MB } from "@/lib/uploads";

const MIN_PORTFOLIO = 5;

interface ProductDetail {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  product_type: string | null;
  shipping_policy: string | null;
  category?: string | null;
  category_custom?: string | null;
  brief?: string | null;
  brief_data?: BriefData | null;
  brand_name: string;
  brand_user_id: string | null;
  logo_url: string | null;
  max_creators: number | null;
  occupied: number;
  spots_left: number | null;
  status: string;
}

interface ConnectionDetail {
  id: string;
  status: string;
  initiated_by: string | null;
  mutual_at?: string | null;
  delivery_type: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  digital_access_value: string | null;
  revision_notes: string | null;
  revision_count: number | null;
  approved_at: string | null;
  ship_deadline: string | null;
  deliver_deadline: string | null;
  film_deadline: string | null;
  review_deadline: string | null;
}

interface Payload {
  product?: ProductDetail;
  connection?: ConnectionDetail | null;
  settings?: { shipping_days: number; filming_days: number; review_days: number };
  error?: string;
}

const STATUS_BADGE: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
  approved: { label: "מאטץ' — ממתין למשלוח", variant: "success" },
  shipped: { label: "נשלח — אשרו קבלה", variant: "info" },
  delivered: { label: "נמסר — הגיע הזמן לצלם", variant: "pink" },
  filming: { label: "בצילום", variant: "warning" },
  uploaded: { label: "הסרטון הועלה", variant: "purple" },
  in_review: { label: "בבדיקה אצל העסק", variant: "purple" },
  revision_requested: { label: "נדרש תיקון", variant: "warning" },
  completed: { label: "הושלם", variant: "success" },
  cancelled: { label: "בוטל", variant: "danger" },
  rejected: { label: "נדחה", variant: "danger" },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-neutral-100 p-4">
      <h2 className="text-sm font-bold text-neutral-900 mb-2">{title}</h2>
      {children}
    </section>
  );
}

export default function ProductPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [connection, setConnection] = useState<ConnectionDetail | null>(null);
  const [settings, setSettings] = useState<Payload["settings"] | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [portfolioCount, setPortfolioCount] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const [viewBrand, setViewBrand] = useState(false);

  const url = id ? `/api/products/${id}` : null;

  const apply = useCallback((data: Payload) => {
    if (data.product) {
      setProduct(data.product);
      setConnection(data.connection || null);
      if (data.settings) setSettings(data.settings);
    } else if (data.error) {
      setNotFound(true);
    }
  }, []);

  const reload = useCallback(() => {
    if (!url) return;
    fetchJson<Payload>(url).then((d) => d && apply(d));
  }, [url, apply]);

  useEffect(() => {
    if (!url) return;
    swrFetch<Payload>(url, apply).then((fresh) => {
      if (fresh === null) setNotFound(true);
    });
  }, [url, apply]);

  useEffect(() => {
    swrFetch<{ user?: { type?: string }; role?: string; profile?: { portfolio_count?: number } }>("/api/profile", (data) => {
      const role = data.role || data.user?.type;
      if (role === "brand") {
        router.replace("/brand/products");
        return;
      }
      if (role === "creator") {
        setPortfolioCount(typeof data.profile?.portfolio_count === "number" ? data.profile.portfolio_count : 0);
      }
    });
  }, [router]);

  // Keep the status fresh while the brand ships / reviews
  useEffect(() => {
    if (!user || !id) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`product-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "connections" }, () => reload())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, id, reload]);

  const upload = useDeliverableUpload(() => reload());

  const locked = portfolioCount !== null && portfolioCount < MIN_PORTFOLIO;

  async function putStatus(connectionId: string, status: string, successMessage: string) {
    setBusy(status);
    try {
      const res = await fetch(`/api/connections/${connectionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        // A creator's "approved" keeps the row pending (mutual) until the brand confirms — reload tells the truth
        if (status !== "approved") setConnection((prev) => (prev ? { ...prev, status } : prev));
        toast(successMessage, "success");
        reload();
      } else if ((data as { code?: string }).code === "portfolio_gate") {
        setPortfolioCount(typeof (data as { count?: number }).count === "number" ? (data as { count?: number }).count! : 0);
        setGateOpen(true);
      } else {
        toast((data as { error?: string }).error || "שגיאה בעדכון", "error");
      }
    } catch {
      toast("שגיאה בעדכון", "error");
    } finally {
      setBusy(null);
    }
  }

  async function sendHeart() {
    if (!product) return;
    if (locked) {
      setGateOpen(true);
      return;
    }
    setBusy("heart");
    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: product.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast(data.mutual ? "🎉 יש מאטץ'! העסק יאשר את החיבור ואז ייפתח הצ'אט" : "❤️ הלב נשלח! נעדכן אותך כשהעסק יאשר", "success");
        reload();
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

  if (notFound) {
    return (
      <main className="min-h-screen bg-background pb-20">
        <div className="max-w-2xl mx-auto px-4 py-20 text-center text-neutral-400">
          <span className="text-4xl block mb-4">📦</span>
          <p>המוצר לא נמצא או הוסר</p>
          <Button className="mt-6" variant="secondary" onClick={() => router.push("/feed")}>חזרה לגלו</Button>
        </div>
      </main>
    );
  }

  const image = product ? toDirectImageUrl(product.image_url) : null;
  const isDigital = product?.product_type === "digital";
  const conn = connection;
  const open = !!conn && !["cancelled", "rejected", "completed"].includes(conn.status);
  const mutual = conn?.status === "pending" && !!conn.mutual_at;
  const pendingFromBrand = conn?.status === "pending" && !mutual && conn.initiated_by === "brand";
  const pendingFromMe = conn?.status === "pending" && !mutual && conn.initiated_by !== "brand";
  const matched = !!conn && !["pending", "cancelled", "rejected"].includes(conn.status);
  const canUpload = !!conn && ["delivered", "filming", "revision_requested"].includes(conn.status);
  const deadlineField = conn ? activeDeadlineField(conn.status) : null;
  const deadline = conn && deadlineField ? conn[deadlineField] : null;
  const full = !!product && product.spots_left !== null && product.spots_left <= 0 && !open;
  const briefLines = product ? briefDataLines(product.brief_data) : [];
  const chat = conn && hasChatHistory({ status: conn.status, approved_at: conn.approved_at });

  return (
    <main className="min-h-screen bg-background pb-24">
      {upload.input}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-neutral-100">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? router.back() : router.push("/feed"))}
            className="p-2 -mr-2 rounded-lg hover:bg-neutral-100 transition-colors"
            aria-label="חזרה"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
          <h1 className="text-lg font-bold truncate flex-1">{product?.name || "מוצר"}</h1>
          {conn && STATUS_BADGE[conn.status] && (
            <Badge variant={STATUS_BADGE[conn.status].variant} size="sm" dot>
              {STATUS_BADGE[conn.status].label}
            </Badge>
          )}
        </div>
      </header>

      {!product ? (
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
          <div className="h-56 bg-gradient-to-br from-pink-100 to-pink-50 rounded-2xl animate-pulse" />
          <div className="h-5 bg-neutral-100 rounded-lg w-2/3 animate-pulse" />
          <div className="h-24 bg-white rounded-2xl border border-neutral-100 animate-pulse" />
          <div className="h-32 bg-white rounded-2xl border border-neutral-100 animate-pulse" />
        </div>
      ) : (
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
          {/* Hero */}
          <Card padding="none" className="overflow-hidden">
            {image ? (
              <div className="h-56 bg-neutral-50">
                <img src={image} alt={product.name} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="h-40 bg-gradient-to-br from-pink-200 to-purple-200 flex items-center justify-center">
                <span className="text-6xl opacity-50">📦</span>
              </div>
            )}
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-neutral-900">{product.name}</h2>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {displayCategory(product.category, product.category_custom) ? `${displayCategory(product.category, product.category_custom)} · ` : ""}
                    {isDigital ? "מוצר דיגיטלי" : "מוצר פיזי"}
                    {full ? " · המוצר מלא" : ""}
                  </p>
                </div>
                <Badge variant="pink" size="lg">₪{product.price}</Badge>
              </div>

              <button
                type="button"
                onClick={() => product.brand_user_id && setViewBrand(true)}
                disabled={!product.brand_user_id}
                className="w-full flex items-center gap-3 text-right p-2 -m-2 rounded-xl hover:bg-neutral-50 transition-colors disabled:cursor-default"
              >
                <Avatar src={product.logo_url} name={product.brand_name} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-neutral-900 truncate">{product.brand_name}</p>
                  <p className="text-xs text-neutral-400">העסק שמאחורי המוצר</p>
                </div>
                {product.brand_user_id && <span className="text-xs text-pink-500 font-medium">פרופיל העסק ›</span>}
              </button>
            </div>
          </Card>

          {/* Journey + actions */}
          {conn && (
            <Card padding="md" className="space-y-4">
              <ConnectionTimeline
                status={conn.status}
                role="creator"
                initiatedBy={conn.initiated_by}
                deliveryType={conn.delivery_type || product.product_type}
                mutual={mutual}
                deadline={deadline}
              />

              {pendingFromBrand && (
                <div className="flex gap-2">
                  <Button fullWidth loading={busy === "approved"} onClick={() => (locked ? setGateOpen(true) : putStatus(conn.id, "approved", "🎉 יש מאטץ'! העסק יאשר את החיבור ואז ייפתח הצ'אט"))}>
                    {locked ? "🔒 " : "💗 "}כן, מעוניין/ת
                  </Button>
                  <Button fullWidth variant="ghost" loading={busy === "rejected"} onClick={() => putStatus(conn.id, "rejected", "דחית את הלב. העסק יעודכן.")}>
                    לא תודה
                  </Button>
                </div>
              )}

              {mutual && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-sm text-emerald-800">
                  🎉 שניכם סימנתם לב. העסק מאשר את החיבור הסופי — ואז נפתח צ&apos;אט ונשלח המוצר. נעדכן אותך.
                </div>
              )}

              {pendingFromMe && (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-neutral-500">העסק מקבל התראה ועונה עד 7 ימים</p>
                  <button type="button" className="text-xs text-neutral-400 hover:text-red-500" onClick={() => putStatus(conn.id, "cancelled", "הלב בוטל")}>
                    ביטול הלב
                  </button>
                </div>
              )}

              {conn.status === "shipped" && (
                <div className="space-y-2">
                  {conn.tracking_number && (
                    <p className="text-xs text-neutral-500">
                      מספר מעקב: <span className="font-mono">{conn.tracking_number}</span>
                      {conn.tracking_url && (
                        <a href={conn.tracking_url} target="_blank" rel="noreferrer" className="text-pink-500 mr-2 hover:underline">מעקב ›</a>
                      )}
                    </p>
                  )}
                  {conn.digital_access_value && (
                    <p className="text-xs text-neutral-500">גישה: <span className="font-mono break-all">{conn.digital_access_value}</span></p>
                  )}
                  <Button fullWidth loading={busy === "delivered"} onClick={() => putStatus(conn.id, "delivered", "קבלת המוצר אושרה! עכשיו הגיע הזמן לצלם")}>
                    {isDigital ? "✅ אישור קבלת הגישה" : "✅ אישור קבלת המוצר"}
                  </Button>
                </div>
              )}

              {conn.status === "revision_requested" && conn.revision_notes && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <p className="text-xs text-amber-700 font-medium mb-1">הערות התיקון מהעסק:</p>
                  <p className="text-sm text-amber-800 whitespace-pre-line">{conn.revision_notes}</p>
                </div>
              )}

              {canUpload && (
                <div>
                  <Button
                    fullWidth
                    variant={upload.uploadingId === conn.id ? "secondary" : "primary"}
                    loading={upload.uploadingId === conn.id}
                    onClick={() => upload.start(conn.id)}
                  >
                    {upload.buttonLabel(conn.id, conn.status === "revision_requested" ? "📹 העלאת גרסה מתוקנת" : "📹 העלאת הסרטון למוצר הזה")}
                  </Button>
                  {upload.uploadingId === conn.id && (
                    <div className="mt-2 h-1.5 bg-neutral-100 rounded-full overflow-hidden" aria-live="polite">
                      <div className="h-full bg-pink-500 rounded-full transition-all" style={{ width: `${upload.progress}%` }} />
                    </div>
                  )}
                  <p className="mt-1 text-[11px] text-neutral-400 leading-relaxed">
                    <span className="block">פורמטים נתמכים: MP4, MOV, WebM</span>
                    <span className="block">גודל מקסימלי: {MAX_VIDEO_MB}MB · הסרטון נשמר על המוצר ונשלח לעסק לבדיקה</span>
                  </p>
                </div>
              )}

              {(conn.status === "uploaded" || conn.status === "in_review") && (
                <p className="text-xs text-neutral-500">הסרטון שלך הועלה ומחכה לבדיקת העסק. נעדכן אותך כשיאושר או אם יתבקש תיקון.</p>
              )}

              {chat && (
                <Link
                  href={`/messages?connection=${conn.id}`}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-neutral-50 text-sm font-medium text-neutral-700 hover:bg-neutral-100 transition-colors"
                >
                  💬 {matched && open ? "לצ'אט עם העסק" : "לצ'אט (לקריאה בלבד)"}
                </Link>
              )}
            </Card>
          )}

          {/* Heart when there is no open connection */}
          {!open && (
            <Card padding="md" className="space-y-2">
              {conn?.status === "completed" && (
                <p className="text-sm text-emerald-600 font-medium">✅ כבר השלמת סרטון למוצר הזה</p>
              )}
              {full ? (
                <Button fullWidth disabled variant="secondary">המוצר מלא — כל המקומות נתפסו</Button>
              ) : (
                <Button fullWidth loading={busy === "heart"} onClick={sendHeart}>
                  {locked ? "🔒 " : "❤️ "}מעוניין/ת במוצר הזה
                </Button>
              )}
              <p className="text-[11px] text-neutral-400 text-center">
                לב = בקשה לעסק. כשהעסק מסמן בחזרה ומאשר, נפתח צ&apos;אט ונשלח המוצר.
              </p>
            </Card>
          )}

          {/* Details */}
          <Section title="על המוצר">
            {locked ? (
              <div className="relative">
                <p className="text-sm text-neutral-600 blur-sm select-none" aria-hidden="true">
                  {product.description || "פרטי המוצר, הדרישות והבריף יופיעו כאן אחרי שתיק העבודות יכיל 5 סרטונים"}
                </p>
                <button type="button" onClick={() => setGateOpen(true)} className="absolute inset-0 flex items-center justify-center text-xs font-medium text-neutral-700 bg-white/60 rounded-lg">
                  🔒 5 סרטונים בתיק פותחים את הפרטים
                </button>
              </div>
            ) : (
              <p className="text-sm text-neutral-600 whitespace-pre-line">{product.description || "העסק לא הוסיף תיאור."}</p>
            )}
          </Section>

          <Section title="הבריף — מה צריך להיות בסרטון">
            {locked ? (
              <p className="text-sm text-neutral-400">הבריף נפתח עם 5 סרטונים בתיק העבודות.</p>
            ) : (
              <div className="space-y-3">
                {hasBriefContent(product.brief_data, product.brief) ? (
                  <div className="text-sm text-neutral-700 space-y-1">
                    {briefLines.map((line, i) => (
                      <p key={i} className={line.endsWith(":") ? "font-medium text-neutral-900 mt-1" : "whitespace-pre-line"}>{line}</p>
                    ))}
                    {product.brief && (
                      <>
                        {briefLines.length > 0 && <p className="font-medium text-neutral-900 mt-1">הערות מהעסק:</p>}
                        <p className="whitespace-pre-line">{product.brief}</p>
                      </>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500">העסק עדיין לא כתב בריף מפורט למוצר. הדגשים ייסגרו בצ&apos;אט אחרי המאטץ&apos;.</p>
                )}
                <ul className="text-xs text-neutral-500 space-y-1 border-t border-neutral-100 pt-3">
                  {FORMAT_LINES.slice(definesFormat(product.brief_data) ? 1 : 0).map((line) => (
                    <li key={line}>• {line}</li>
                  ))}
                </ul>
              </div>
            )}
          </Section>

          <Section title="לוח זמנים ומשלוח">
            <ul className="text-sm text-neutral-600 space-y-1">
              <li>
                {isDigital
                  ? "📲 מוצר דיגיטלי — פרטי הגישה נשלחים אחרי המאטץ'"
                  : `📦 ${product.shipping_policy === "free" || !product.shipping_policy ? "משלוח חינם מהעסק" : "משלוח מהעסק"} תוך ${settings?.shipping_days ?? 7} ימים מהמאטץ'`}
              </li>
              <li>🎬 צילום והעלאה תוך {settings?.filming_days ?? 10} ימים מקבלת המוצר</li>
              <li>👀 העסק בודק ומאשר עד {settings?.review_days ?? 7} ימים מההעלאה</li>
            </ul>
          </Section>
        </div>
      )}

      <ProfileModal userId={viewBrand ? product?.brand_user_id || null : null} onClose={() => setViewBrand(false)} title="פרופיל העסק" />

      <Modal open={gateOpen} onClose={() => setGateOpen(false)} size="sm">
        <div className="text-center space-y-4">
          <span className="text-4xl block">🎬</span>
          <div>
            <h3 className="text-lg font-bold">עוד {Math.max(0, MIN_PORTFOLIO - (portfolioCount || 0))} סרטונים ואת/ה בפנים</h3>
            <p className="text-sm text-neutral-500 mt-1">
              תיק העבודות: {portfolioCount || 0}/{MIN_PORTFOLIO}. עסקים בוחרים יוצרים לפי התיק — {MIN_PORTFOLIO} סרטונים פותחים לבבות, בריפים וצ&apos;אט.
            </p>
          </div>
          <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
            <div className="h-full bg-pink-500 rounded-full" style={{ width: `${Math.min(100, ((portfolioCount || 0) / MIN_PORTFOLIO) * 100)}%` }} />
          </div>
          <Button fullWidth onClick={() => router.push("/profile")}>להעלאת סרטונים</Button>
        </div>
      </Modal>
    </main>
  );
}
