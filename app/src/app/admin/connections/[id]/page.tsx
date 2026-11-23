"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Avatar, Badge, Button, Card, useToast } from "@/components/ui";
import { BriefFull } from "@/components/features/brief-view";
import { connectionStatusLabel, isMatchedStatus, type MessageSide } from "@/lib/admin-connections";
import { isBriefSnapshot, isVideoCard } from "@/lib/chat";
import type { BriefData, BriefSnapshot } from "@/lib/brief";
import { formatDateHe } from "@/lib/dates";
import { toDirectImageUrl } from "@/lib/images";

type AdminMessage = {
  id: string;
  sender_id: string | null;
  text: string;
  is_system: boolean;
  kind: string;
  data: Record<string, unknown> | null;
  created_at: string;
  side: MessageSide;
  warnings: string[];
};

type AdminVideo = {
  id: string;
  status: string | null;
  thumbnail_url: string | null;
  created_at: string;
  revision_notes: string | null;
  play_url: string | null;
};

type Payload = {
  connection: {
    id: string;
    status: string | null;
    initiated_by: string | null;
    mutual_at: string | null;
    created_at: string;
    approved_at: string | null;
    shipped_at: string | null;
    delivered_at: string | null;
    completed_at: string | null;
    brief_posted_at: string | null;
    brief_approved_at: string | null;
    revision_count: number;
    revision_notes: string | null;
    tracking_number: string | null;
    tracking_url: string | null;
    delivery_proof_url: string | null;
    delivery_type: string | null;
    blocked_at: string | null;
    blocked_reason: string | null;
    blocked_by_name: string | null;
    product: { id: string; name: string; image_url: string | null; product_type: string | null; brief: string | null; brief_data: BriefData | null } | null;
    creator: { user_id: string | null; profile_id: string | null; name: string; phone: string | null; avatar_url: string | null };
    brand: { user_id: string | null; profile_id: string | null; name: string; contact_name: string | null; phone: string | null; logo_url: string | null };
  };
  messages: AdminMessage[];
  videos: AdminVideo[];
  warnings_total: number;
};

const videoStatus: Record<string, { label: string; variant: "success" | "warning" | "danger" | "info" | "default" }> = {
  approved: { label: "אושר", variant: "success" },
  pending: { label: "ממתין לעסק", variant: "warning" },
  revision_requested: { label: "נדרש תיקון", variant: "warning" },
  rejected: { label: "הוסר", variant: "danger" },
};

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("he-IL", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// One connection for the admin (owner list 2026-11-14, item 5): who and what, the files (brief, videos, delivery),
// the transcript with contact-sharing warnings, and the chat block.
export default function AdminConnectionPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [onlyWarnings, setOnlyWarnings] = useState(false);
  const { toast } = useToast();

  // Fetch as a promise chain (state is set in the callbacks, never synchronously inside the effect)
  const load = useCallback(() => {
    if (!id) return Promise.resolve();
    return fetch(`/api/admin/connections/${id}`)
      .then((res) => (res.ok ? (res.json() as Promise<Payload>) : Promise.reject(new Error("API error"))))
      .then((payload) => setData(payload))
      .catch(() => toast("שגיאה בטעינת החיבור", "error"))
      .finally(() => setLoading(false));
  }, [id, toast]);

  useEffect(() => {
    const p = load();
    return () => {
      void p;
    };
  }, [load]);

  async function toggleBlock() {
    if (!data) return;
    const blocked = !!data.connection.blocked_at;
    let reason = "";
    if (!blocked) {
      const answer = window.prompt("סיבת העצירה (פנימי — לא מוצג למשתמשים):", "");
      if (answer === null) return;
      reason = answer.trim();
      if (!window.confirm("לעצור את ההתקשרות? שני הצדדים יראו \"המערכת עצרה את ההתקשרות, יש לפנות לבירור\" ולא יוכלו לכתוב, לשלוח בריף, להעלות סרטון או להתקדם בתהליך עד לשחרור.")) return;
    } else if (!window.confirm("לשחרר את ההתקשרות? שני הצדדים יוכלו להמשיך בצ'אט ובתהליך.")) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/connections/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: blocked ? "unblock" : "block", reason }),
      });
      if (!res.ok) throw new Error("API error");
      toast(blocked ? "ההתקשרות שוחררה" : "ההתקשרות נעצרה — שני הצדדים עודכנו", "success");
      await load();
    } catch {
      toast("הפעולה נכשלה", "error");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-sm text-neutral-400 p-8">טוען...</p>;
  if (!data) return <p className="text-sm text-neutral-400 p-8">לא נמצא.</p>;
  const c = data.connection;
  const blocked = !!c.blocked_at;
  const productImage = toDirectImageUrl(c.product?.image_url || null);
  const shownMessages = onlyWarnings ? data.messages.filter((m) => m.warnings.length > 0) : data.messages;
  const dates: { label: string; at: string | null }[] = [
    { label: "נוצר", at: c.created_at },
    { label: "מאטץ'", at: c.mutual_at },
    { label: "אושר", at: c.approved_at },
    { label: "בריף נשלח", at: c.brief_posted_at },
    { label: "בריף אושר", at: c.brief_approved_at },
    { label: "נשלח", at: c.shipped_at },
    { label: "הגיע", at: c.delivered_at },
    { label: "הושלם", at: c.completed_at },
  ];

  return (
    <div>
      <Link href="/admin/connections" className="text-sm text-pink-600 hover:underline">‹ כל החיבורים</Link>

      <Card padding="md" className="mt-4 mb-6">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-16 h-16 rounded-xl bg-neutral-100 overflow-hidden shrink-0 flex items-center justify-center text-2xl">
            {productImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={productImage} alt={c.product?.name || ""} className="w-full h-full object-cover" />
            ) : (
              "🎁"
            )}
          </div>
          <div className="flex-1 min-w-[240px]">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold">{c.product?.name || "ללא מוצר"}</h1>
              <Badge variant={blocked ? "danger" : isMatchedStatus(c.status) ? (c.status === "completed" ? "default" : "success") : "warning"} size="sm" dot>
                {connectionStatusLabel(c.status, c.initiated_by, c.mutual_at)}
              </Badge>
              {blocked && <Badge variant="danger" size="sm">ההתקשרות נעצרה</Badge>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <div className="flex items-center gap-3 rounded-xl border border-neutral-100 px-3 py-2">
                <Avatar src={c.creator.avatar_url} name={c.creator.name} size="sm" />
                <div className="min-w-0">
                  <span className="text-[11px] text-neutral-400 block">יוצר/ת</span>
                  {c.creator.user_id ? (
                    <Link href={`/admin/creators/${c.creator.user_id}`} className="text-sm font-medium hover:text-pink-600 truncate block">{c.creator.name}</Link>
                  ) : (
                    <span className="text-sm font-medium truncate block">{c.creator.name}</span>
                  )}
                  {c.creator.phone && <span className="text-xs text-neutral-500 block" dir="ltr">{c.creator.phone}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-neutral-100 px-3 py-2">
                <Avatar src={c.brand.logo_url} name={c.brand.name} size="sm" />
                <div className="min-w-0">
                  <span className="text-[11px] text-neutral-400 block">עסק</span>
                  <span className="text-sm font-medium truncate block">
                    {c.brand.name}
                    {c.brand.contact_name && c.brand.contact_name !== c.brand.name ? <span className="text-neutral-400 font-normal"> · {c.brand.contact_name}</span> : null}
                  </span>
                  {c.brand.phone && <span className="text-xs text-neutral-500 block" dir="ltr">{c.brand.phone}</span>}
                </div>
              </div>
            </div>
            <p className="text-xs text-neutral-400 mt-3 flex flex-wrap gap-x-3 gap-y-1">
              {dates.filter((d) => d.at).map((d) => (
                <span key={d.label}>{d.label} {formatDateHe(d.at as string)}</span>
              ))}
              {c.revision_count > 0 && <span>תיקונים {c.revision_count}</span>}
            </p>
          </div>
          <Button size="sm" variant={blocked ? "primary" : "danger"} loading={busy} onClick={toggleBlock}>
            {blocked ? "🔓 שחרור ההתקשרות" : "⛔ עצירת ההתקשרות"}
          </Button>
        </div>
        {blocked && (
          <div className="mt-4 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
            <p className="font-semibold">⛔ שני הצדדים רואים: &quot;המערכת עצרה את ההתקשרות, יש לפנות לבירור&quot;</p>
            <p className="text-xs mt-1 text-red-600">
              נעצר {when(c.blocked_at as string)}{c.blocked_by_name ? ` על ידי ${c.blocked_by_name}` : ""}{c.blocked_reason ? ` · סיבה (פנימי): ${c.blocked_reason}` : ""}
            </p>
          </div>
        )}
      </Card>

      {/* Files: the brief, the deliverables, the delivery */}
      <Card padding="md" className="mb-6">
        <h2 className="font-bold mb-4">קבצים</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-semibold text-neutral-700 mb-2">
              📋 הבריף
              <span className="text-xs font-normal text-neutral-400 mr-2">
                {c.brief_approved_at ? `אושר על ידי היוצר/ת ${formatDateHe(c.brief_approved_at)}` : c.brief_posted_at ? `נשלח לצ'אט ${formatDateHe(c.brief_posted_at)} · טרם אושר` : "עדיין לא נשלח לצ'אט"}
              </span>
            </h3>
            {c.product && (c.product.brief_data || c.product.brief) ? (
              <div className="rounded-xl border border-neutral-100 p-3 text-sm">
                <BriefFull data={c.product.brief_data} notes={c.product.brief} productName={c.product.name} />
              </div>
            ) : (
              <p className="text-sm text-neutral-400">העסק לא מילא בריף למוצר הזה.</p>
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-700 mb-2">🎬 סרטונים ({data.videos.length})</h3>
            {data.videos.length === 0 ? (
              <p className="text-sm text-neutral-400">עדיין לא הועלו סרטונים לחיבור הזה.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {data.videos.map((v, i) => {
                  const st = videoStatus[v.status || ""] || { label: v.status || "—", variant: "default" as const };
                  return (
                    <div key={v.id} className="rounded-xl border border-neutral-100 overflow-hidden">
                      <a href={v.play_url || undefined} target="_blank" rel="noreferrer" className="block aspect-[9/16] bg-neutral-100 relative">
                        {v.thumbnail_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={v.thumbnail_url} alt={`סרטון ${i + 1}`} className="w-full h-full object-cover" />
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
                        {v.revision_notes && <p className="text-[11px] text-amber-700 line-clamp-2">{v.revision_notes}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {(c.tracking_number || c.tracking_url || c.delivery_proof_url) && (
              <div className="mt-4 text-sm space-y-1">
                <h3 className="text-sm font-semibold text-neutral-700">📦 משלוח</h3>
                {c.tracking_number && <p className="text-neutral-600">מספר מעקב: <span dir="ltr">{c.tracking_number}</span></p>}
                {c.tracking_url && <a href={c.tracking_url} target="_blank" rel="noreferrer" className="text-pink-600 hover:underline block truncate" dir="ltr">{c.tracking_url}</a>}
                {c.delivery_proof_url && <a href={c.delivery_proof_url} target="_blank" rel="noreferrer" className="text-pink-600 hover:underline">אישור מסירה ›</a>}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* The transcript, with warnings where contact details may have changed hands */}
      <Card padding="md" className="mb-6">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h2 className="font-bold">
            ההתכתבות <span className="text-neutral-400 font-normal text-sm">({data.messages.length})</span>
          </h2>
          <div className="flex items-center gap-3">
            {data.warnings_total > 0 ? (
              <span className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1">⚠️ {data.warnings_total} הודעות עם חשד לשיתוף פרטי קשר</span>
            ) : (
              <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-1">✓ לא זוהה שיתוף פרטי קשר</span>
            )}
            {data.warnings_total > 0 && (
              <label className="text-xs text-neutral-500 flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={onlyWarnings} onChange={(e) => setOnlyWarnings(e.target.checked)} />
                רק אזהרות
              </label>
            )}
          </div>
        </div>
        {shownMessages.length === 0 ? (
          <p className="text-sm text-neutral-400">{data.messages.length === 0 ? "עדיין לא נכתב דבר בצ'אט הזה." : "אין הודעות עם אזהרה."}</p>
        ) : (
          <div className="space-y-2">
            {shownMessages.map((m) => <TranscriptRow key={m.id} m={m} creatorName={c.creator.name} brandName={c.brand.name} />)}
          </div>
        )}
      </Card>
    </div>
  );
}

const sideStyle: Record<MessageSide, { label: (creator: string, brand: string) => string; pill: string; box: string }> = {
  creator: { label: (creator) => `יוצר/ת · ${creator}`, pill: "bg-pink-50 text-pink-700", box: "border-neutral-100 bg-white" },
  brand: { label: (_c, brand) => `עסק · ${brand}`, pill: "bg-blue-50 text-blue-700", box: "border-neutral-100 bg-white" },
  system: { label: () => "המערכת", pill: "bg-neutral-100 text-neutral-500", box: "border-neutral-100 bg-neutral-50" },
  admin: { label: () => "מנהל/ת", pill: "bg-purple-50 text-purple-700", box: "border-neutral-100 bg-neutral-50" },
};

function TranscriptRow({ m, creatorName, brandName }: { m: AdminMessage; creatorName: string; brandName: string }) {
  const style = sideStyle[m.side];
  const warn = m.warnings.length > 0;
  const brief = m.kind === "brief" && isBriefSnapshot(m.data) ? (m.data as unknown as BriefSnapshot) : null;
  const video = m.kind === "video" && isVideoCard(m.data) ? m.data : null;
  return (
    <div className={`rounded-xl border px-3 py-2 ${warn ? "border-amber-200 bg-amber-50/50" : style.box} ${m.side === "brand" ? "mr-0 ml-8 sm:ml-24" : m.side === "creator" ? "ml-0 mr-8 sm:mr-24" : ""}`}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className={`text-[11px] px-2 py-0.5 rounded-full ${style.pill}`}>{style.label(creatorName, brandName)}</span>
        <span className="text-[11px] text-neutral-400" dir="ltr">{when(m.created_at)}</span>
      </div>
      {brief ? (
        <p className="text-sm text-neutral-700">📋 בריף — גרסה {brief.version}{brief.product_name ? ` · ${brief.product_name}` : ""}</p>
      ) : video ? (
        <div className="flex items-center gap-3">
          <a href={(video.url as string | null) || undefined} target="_blank" rel="noreferrer" className="block w-14 h-20 rounded-lg bg-neutral-900 overflow-hidden relative shrink-0">
            {video.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={video.thumbnail_url as string} alt="" className="w-full h-full object-cover" />
            ) : null}
            <span className="absolute inset-0 flex items-center justify-center text-white text-lg">▶</span>
          </a>
          <p className="text-sm text-neutral-700">{m.text}</p>
        </div>
      ) : (
        <p className={`text-sm whitespace-pre-wrap break-words ${m.side === "system" ? "text-neutral-500" : "text-neutral-800"}`}>{m.text}</p>
      )}
      {warn && (
        <p className="text-[11px] text-amber-800 mt-1.5 flex items-start gap-1">
          <span aria-hidden="true">⚠️</span>
          <span>{m.warnings.join(" · ")}</span>
        </p>
      )}
    </div>
  );
}
