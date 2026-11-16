"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Avatar, Badge, Button, Card, useToast } from "@/components/ui";
import { displayName, formatFollowers, lastSeenLabel } from "@/lib/admin-creators";
import { formatDateHe } from "@/lib/dates";

type AdminVideo = {
  id: string;
  title: string | null;
  status: string | null;
  thumbnail_url: string | null;
  created_at: string;
  connection_id: string | null;
  revision_notes: string | null;
  play_url: string | null;
  product: string | null;
  brand: string | null;
  connection_status: string | null;
};

type Payload = {
  creator: {
    id: string;
    name: string;
    phone: string;
    is_active: boolean;
    is_admin: boolean;
    avatar_url: string | null;
    created_at: string;
    last_seen_at: string | null;
    level: string;
    categories: string[];
    city: string | null;
    bio: string | null;
    tiktok_handle: string | null;
    instagram_handle: string | null;
    tiktok_followers: number;
    instagram_followers: number;
    hearts_from_brands: number;
    matches: number;
    dual_role_allowed: boolean;
    has_brand_profile: boolean;
  };
  portfolio: AdminVideo[];
  collab: AdminVideo[];
};

const statusLabel: Record<string, { label: string; variant: "success" | "warning" | "danger" | "info" | "default" }> = {
  approved: { label: "מאושר", variant: "success" },
  pending: { label: "ממתין", variant: "warning" },
  uploaded: { label: "הועלה", variant: "info" },
  revision_requested: { label: "נדרש תיקון", variant: "warning" },
  rejected: { label: "הוסר", variant: "danger" },
};

// One creator: account facts, and every video they uploaded — portfolio vs. work for businesses — with removal /
// restore (content control, owner list 2026-11-14).
export default function AdminCreatorPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  // Fetch as a promise chain (state is set in the callbacks, never synchronously inside the effect)
  const load = useCallback(() => {
    if (!id) return Promise.resolve();
    return fetch(`/api/admin/creators/${id}`)
      .then((res) => (res.ok ? (res.json() as Promise<Payload>) : Promise.reject(new Error("API error"))))
      .then((payload) => setData(payload))
      .catch(() => toast("שגיאה בטעינת היוצר/ת", "error"))
      .finally(() => setLoading(false));
  }, [id, toast]);

  useEffect(() => {
    const p = load();
    return () => {
      void p;
    };
  }, [load]);

  async function videoAction(v: AdminVideo, action: "remove" | "restore") {
    if (action === "remove") {
      const what = v.connection_id ? "הסרטון ייעלם מהצ'אט עם העסק" : "הסרטון ייעלם מתיק העבודות ולא ייספר ב-5 הסרטונים";
      if (!window.confirm(`להסיר את הסרטון? ${what}. היוצר/ת יקבלו התראה. אפשר לשחזר אחר כך.`)) return;
    }
    setBusy(v.id);
    try {
      const res = await fetch(`/api/admin/creators/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: v.id, action }),
      });
      if (!res.ok) throw new Error("API error");
      toast(action === "remove" ? "הסרטון הוסר" : "הסרטון שוחזר", "success");
      await load();
    } catch {
      toast("הפעולה נכשלה", "error");
    } finally {
      setBusy(null);
    }
  }

  async function toggleActive() {
    if (!data) return;
    const next = !data.creator.is_active;
    if (!next && !window.confirm("להשעות את החשבון? לא יוכלו להיכנס למערכת עד שתפעילו מחדש.")) return;
    setBusy("account");
    try {
      const res = await fetch("/api/admin/creators", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: data.creator.id, is_active: next }),
      });
      if (!res.ok) throw new Error("API error");
      setData({ ...data, creator: { ...data.creator, is_active: next } });
      toast(next ? "החשבון הופעל מחדש" : "החשבון הושעה", "success");
    } catch {
      toast("שגיאה בעדכון הסטטוס", "error");
    } finally {
      setBusy(null);
    }
  }

  // Opens (or closes) the business side for this creator; the profile then offers "הוספת חשבון עסק"
  async function toggleDual() {
    if (!data) return;
    const next = !data.creator.dual_role_allowed;
    if (next && !window.confirm("לפתוח את האפשרות לחשבון עסק? היוצר/ת יראו בפרופיל \"הוספת חשבון עסק\" ויקבלו התראה.")) return;
    setBusy("dual");
    try {
      const res = await fetch("/api/admin/creators", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: data.creator.id, dual_role_allowed: next }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((payload as { error?: string }).error || "API error");
      setData({ ...data, creator: { ...data.creator, dual_role_allowed: next } });
      toast(next ? "נפתחה האפשרות לחשבון עסק" : "האפשרות נסגרה", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "שגיאה בעדכון", "error");
    } finally {
      setBusy(null);
    }
  }

  // Removes the registration completely (owner, 2026-11-15); the phone can then sign up again
  async function deleteAccount() {
    if (!data) return;
    const label = displayName(data.creator.name, data.creator.phone);
    if (!window.confirm(`למחוק את החשבון של ${label}? המשתמש, הפרופיל, הסרטונים והחיבורים שלו יימחקו ואי אפשר לבטל. אחרי המחיקה אפשר להירשם מחדש עם אותו מספר.`)) return;
    if (window.prompt("לאישור סופי כתבו: מחק") !== "מחק") return;
    setBusy("delete");
    try {
      const res = await fetch(`/api/admin/users/${data.creator.id}`, { method: "DELETE" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((payload as { error?: string }).error || "API error");
      toast("החשבון נמחק", "success");
      router.push("/admin/creators");
    } catch (err) {
      toast(err instanceof Error ? err.message : "המחיקה נכשלה", "error");
      setBusy(null);
    }
  }

  if (loading) return <p className="text-sm text-neutral-400 p-8">טוען...</p>;
  if (!data) return <p className="text-sm text-neutral-400 p-8">לא נמצא.</p>;
  const c = data.creator;
  const name = displayName(c.name, c.phone);

  return (
    <div>
      <Link href="/admin/creators" className="text-sm text-pink-500 hover:underline">‹ כל היוצרים</Link>

      <Card padding="md" className="mt-4 mb-6">
        <div className="flex items-start gap-4">
          <Avatar src={c.avatar_url} name={name} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold">{name}</h1>
              <Badge variant={c.is_active ? "success" : "danger"} size="sm" dot>{c.is_active ? "פעיל/ה" : "מושעה"}</Badge>
              {c.is_admin && <Badge variant="purple" size="sm">מנהל/ת</Badge>}
            </div>
            <p className="text-sm text-neutral-500 mt-1" dir="ltr">{c.phone}</p>
            <div className="mt-2 flex items-center gap-2 flex-wrap text-xs">
              {c.has_brand_profile ? (
                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">🏪 יש גם חשבון עסק על המספר הזה</span>
              ) : (
                <>
                  <span className="text-neutral-500">{c.dual_role_allowed ? "✅ מאושר לפתוח גם חשבון עסק (רואה \"הוספת חשבון עסק\" בפרופיל)" : "חשבון עסק מקביל: לא פתוח"}</span>
                  {!c.is_admin && (
                    <button type="button" disabled={busy === "dual"} onClick={toggleDual} className="text-pink-600 hover:underline disabled:opacity-50">
                      {busy === "dual" ? "..." : c.dual_role_allowed ? "סגירת האפשרות" : "לאפשר חשבון עסק"}
                    </button>
                  )}
                </>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-sm">
              <div><span className="text-neutral-400 text-xs block">עוקבים באינסטגרם</span>📸 {formatFollowers(c.instagram_followers)}{c.instagram_handle ? <span className="text-neutral-400 text-xs"> @{c.instagram_handle}</span> : null}</div>
              <div><span className="text-neutral-400 text-xs block">עוקבים בטיקטוק</span>🎵 {formatFollowers(c.tiktok_followers)}{c.tiktok_handle ? <span className="text-neutral-400 text-xs"> @{c.tiktok_handle}</span> : null}</div>
              <div><span className="text-neutral-400 text-xs block">לבבות מעסקים / מאטצ&apos;ים</span>💗 {c.hearts_from_brands} · 🤝 {c.matches}</div>
              <div><span className="text-neutral-400 text-xs block">כניסה אחרונה</span>{lastSeenLabel(c.last_seen_at)}</div>
            </div>
            <p className="text-xs text-neutral-400 mt-3">
              נרשם/ה {formatDateHe(c.created_at)}{c.city ? ` · ${c.city}` : ""}{c.categories.length ? ` · ${c.categories.join(", ")}` : ""}
            </p>
            {c.bio && <p className="text-sm text-neutral-600 mt-2">{c.bio}</p>}
          </div>
          <div className="flex flex-col items-stretch gap-2 shrink-0">
            <Button size="sm" variant={c.is_active ? "danger" : "primary"} loading={busy === "account"} onClick={toggleActive}>
              {c.is_active ? "השעיית חשבון" : "הפעלת חשבון"}
            </Button>
            {!c.is_admin && (
              <button type="button" disabled={busy === "delete"} onClick={deleteAccount} className="text-xs text-red-600 hover:underline disabled:opacity-50">
                {busy === "delete" ? "מוחק..." : "🗑️ מחיקת החשבון"}
              </button>
            )}
          </div>
        </div>
      </Card>

      <VideoSection title={`תיק עבודות (${data.portfolio.length})`} videos={data.portfolio} busy={busy} onAction={videoAction} empty="אין סרטונים בתיק העבודות" />
      <VideoSection title={`סרטונים לעסקים (${data.collab.length})`} videos={data.collab} busy={busy} onAction={videoAction} empty="עדיין לא הועלו סרטונים במסגרת שיתופי פעולה" />
    </div>
  );
}

function VideoSection({ title, videos, busy, onAction, empty }: { title: string; videos: AdminVideo[]; busy: string | null; onAction: (v: AdminVideo, a: "remove" | "restore") => void; empty: string }) {
  return (
    <Card padding="md" className="mb-6">
      <h2 className="font-bold mb-4">{title}</h2>
      {videos.length === 0 ? (
        <p className="text-sm text-neutral-400">{empty}</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {videos.map((v) => {
            const st = statusLabel[v.status || ""] || { label: v.status || "—", variant: "default" as const };
            const removed = v.status === "rejected";
            return (
              <div key={v.id} className={`rounded-xl border overflow-hidden ${removed ? "border-red-100 opacity-70" : "border-neutral-100"}`}>
                <a href={v.play_url || undefined} target="_blank" rel="noreferrer" className="block aspect-[9/16] bg-neutral-100 relative">
                  {v.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.thumbnail_url} alt={v.title || "סרטון"} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl">🎬</div>
                  )}
                  {v.play_url && <span className="absolute inset-0 flex items-center justify-center text-white text-3xl drop-shadow">▶</span>}
                </a>
                <div className="p-2 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant={st.variant} size="sm">{st.label}</Badge>
                    <span className="text-[10px] text-neutral-400">{formatDateHe(v.created_at)}</span>
                  </div>
                  {v.title && <p className="text-xs font-medium truncate">{v.title}</p>}
                  {v.connection_id && (
                    <p className="text-[11px] text-neutral-500 truncate">{v.product || "מוצר"}{v.brand ? ` · ${v.brand}` : ""}</p>
                  )}
                  {removed && v.revision_notes && <p className="text-[11px] text-red-600 line-clamp-2">{v.revision_notes}</p>}
                  <button
                    type="button"
                    disabled={busy === v.id}
                    onClick={() => onAction(v, removed ? "restore" : "remove")}
                    className={`w-full mt-1 px-2 py-1 rounded-lg text-xs transition-colors disabled:opacity-50 ${removed ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-red-50 text-red-600 hover:bg-red-100"}`}
                  >
                    {busy === v.id ? "..." : removed ? "שחזור" : "הסרה"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
