"use client";

import { useState, useEffect, useRef, useCallback, Fragment, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatMessageTime, sameDay, dayLabel } from "@/lib/chat-time";
import { motion } from "framer-motion";
import { Avatar, Button, Input, Modal, Textarea, useToast } from "@/components/ui";
import { ProfileModal, ConnectionTimeline } from "@/components/features";
import { BriefCard, BriefFull } from "@/components/features/brief-view";
import { useAuth } from "@/hooks/use-auth";
import { useDeliverableUpload } from "@/hooks/use-deliverable-upload";
import { createClient } from "@/lib/supabase/client";
import { swrFetch, readCache, emitUnreadChanged } from "@/lib/client-cache";
import { toDirectImageUrl } from "@/lib/images";
import { isChatOpen, hasChatHistory, activeDeadlineField, flowNextAction } from "@/lib/connection-flow";
import { CHAT_EVENT_TEXTS, isBriefSnapshot, isVideoCard, type MessageKind } from "@/lib/chat";
import type { BriefSnapshot } from "@/lib/brief";

type Role = "creator" | "brand";

interface Conversation {
  id: string;
  name: string;
  avatar: string | null;
  otherUserId: string | null;
  lastMessage: string;
  time: string;
  unread: number;
  product: string | null;
  productImage: string | null;
  status: string;
  // completed / cancelled connections keep their chat, read-only
  closed: boolean;
}

interface Message {
  id: string;
  text: string;
  senderId: string;
  isSystem: boolean;
  createdAt: string;
  kind: MessageKind;
  data: Record<string, unknown> | null;
}

// The connection behind the open chat: status, brief flags, deadlines and the two parties
interface ConnectionDetail {
  id: string;
  status: string;
  productId: string | null;
  productName: string;
  productImage: string | null;
  productType: string;
  deliveryType: string | null;
  initiatedBy: string | null;
  briefPostedAt: string | null;
  briefApprovedAt: string | null;
  revisionCount: number;
  revisionNotes: string | null;
  trackingNumber: string | null;
  deadline: string | null;
  brandName: string;
  brandAvatar: string | null;
  brandUserId: string | null;
  creatorName: string;
  creatorAvatar: string | null;
  creatorUserId: string | null;
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "עכשיו";
  if (diffMins < 60) return `לפני ${diffMins} דקות`;
  if (diffHours < 24) return `לפני ${diffHours} שעות`;
  if (diffDays === 1) return "אתמול";
  return `לפני ${diffDays} ימים`;
}

// "נותרו 3 ימים" / "נותרו 5 שעות" / "המועד עבר" for the clock of the current step
function deadlineLabel(iso: string | null): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  if (ms <= 0) return "המועד עבר";
  if (ms < 86400000) {
    const h = Math.max(1, Math.round(ms / 3600000));
    return h === 1 ? "נותרה שעה" : `נותרו ${h} שעות`;
  }
  const days = Math.ceil(ms / 86400000);
  return days === 1 ? "נותר יום" : `נותרו ${days} ימים`;
}

function mapMessage(m: Record<string, unknown>): Message {
  const kind = (m.kind as MessageKind) || "text";
  return {
    id: m.id as string,
    text: (m.text as string) || "",
    senderId: m.sender_id as string,
    isSystem: (m.is_system as boolean) || false,
    createdAt: m.created_at as string,
    kind: ["text", "brief", "video", "event"].includes(kind) ? kind : "text",
    data: (m.data as Record<string, unknown> | null) || null,
  };
}

function mapConnection(c: Record<string, unknown>): ConnectionDetail {
  const prod = (c.products as Record<string, unknown> | null) || {};
  const bp = (c.brand_profiles as Record<string, unknown> | null) || {};
  const cp = (c.creator_profiles as Record<string, unknown> | null) || {};
  const brandUser = (bp.users as Record<string, unknown> | null) || {};
  const creatorUser = (cp.users as Record<string, unknown> | null) || {};
  const status = (c.status as string) || "";
  const field = activeDeadlineField(status);
  return {
    id: c.id as string,
    status,
    productId: (c.product_id as string) || null,
    productName: (prod.name as string) || "",
    productImage: toDirectImageUrl((prod.image_url as string) || null),
    productType: (prod.product_type as string) || "physical",
    deliveryType: (c.delivery_type as string) || null,
    initiatedBy: (c.initiated_by as string) || null,
    briefPostedAt: (c.brief_posted_at as string) || null,
    briefApprovedAt: (c.brief_approved_at as string) || null,
    revisionCount: (c.revision_count as number) || 0,
    revisionNotes: (c.revision_notes as string) || null,
    trackingNumber: (c.tracking_number as string) || null,
    deadline: field ? ((c[field] as string) || null) : null,
    brandName: (bp.shop_name as string) || (brandUser.full_name as string) || "",
    brandAvatar: (bp.logo_url as string) || (brandUser.avatar_url as string) || null,
    brandUserId: (bp.user_id as string) || null,
    creatorName: (creatorUser.full_name as string) || "",
    creatorAvatar: (creatorUser.avatar_url as string) || null,
    creatorUserId: (cp.user_id as string) || null,
  };
}

export default function MessagesPage() {
  return (
    <Suspense>
      <MessagesContent />
    </Suspense>
  );
}

function MessagesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialConnection = searchParams.get("connection");
  const [selectedId, setSelectedId] = useState<string | null>(initialConnection);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [connection, setConnection] = useState<ConnectionDetail | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  // Why the last message was refused (contact details / links), shown under the composer until the next send
  const [blockedNotice, setBlockedNotice] = useState<string | null>(null);
  const [viewProfileId, setViewProfileId] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(() => {
    const cached = readCache<{ role?: string; user?: { type?: string } }>("/api/profile");
    const r = cached?.role || cached?.user?.type;
    return r === "brand" || r === "creator" ? r : null;
  });
  const [maxRevisions, setMaxRevisions] = useState(1);
  const [acting, setActing] = useState(false);
  // The brand's "דרוש שינוי": the composer carries the request and sending it files the revision
  const [revisionMode, setRevisionMode] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const [shipOpen, setShipOpen] = useState(false);
  const [shipForm, setShipForm] = useState({ trackingNumber: "", trackingUrl: "", digitalAccessValue: "" });
  const [playing, setPlaying] = useState<{ url: string; poster: string | null } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLInputElement>(null);
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const fetchConversationsRef = useRef<() => void>(() => {});
  const fetchMessagesRef = useRef<(id: string) => void>(() => {});

  useEffect(() => {
    swrFetch<{ role?: string; user?: { type?: string } }>("/api/profile", (data) => {
      const r = data.role || data.user?.type;
      if (r === "brand" || r === "creator") setRole(r);
    });
  }, []);

  const fetchConversations = useCallback(async () => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    const apply = (data: { connections?: Record<string, unknown>[]; settings?: { max_revisions?: number } }) => {
      if (!data.connections) return;
      if (typeof data.settings?.max_revisions === "number") setMaxRevisions(data.settings.max_revisions);
      // Open chats plus closed ones that were matched (their history stays readable)
      const active = data.connections.filter((c) =>
        hasChatHistory({ status: c.status, approved_at: (c.approved_at as string | null) ?? null })
      );
      const mapped: Conversation[] = active.map((c) => {
        const d = mapConnection(c);
        // The other party: a brand sees the creator, a creator sees the business
        const showCreator = role === "brand";
        return {
          id: d.id,
          name: showCreator ? d.creatorName : d.brandName,
          avatar: showCreator ? d.creatorAvatar : d.brandAvatar,
          otherUserId: showCreator ? d.creatorUserId : d.brandUserId,
          lastMessage: (c.last_message as string) || "התחילו שיחה...",
          time: (c.last_message_at as string) || (c.created_at as string) ? formatTime(((c.last_message_at as string) || (c.created_at as string)) as string) : "",
          unread: (c.unread_count as number) || 0,
          product: d.productName || null,
          productImage: d.productImage,
          status: d.status,
          closed: !isChatOpen(d.status),
        };
      });
      setConversations(mapped);
      setLoading(false);
    };
    try {
      await swrFetch("/api/connections", apply);
    } finally {
      setLoading(false);
    }
  }, [user, authLoading, role]);

  function openConversation(conv: Conversation) {
    if (conv.unread > 0) {
      setConversations((prev) => prev.map((c) => (c.id === conv.id ? { ...c, unread: 0 } : c)));
      emitUnreadChanged(-conv.unread);
    }
    // A fresh chat: no stale connection details, no half-written revision request
    setConnection(null);
    setRevisionMode(false);
    setNewMessage("");
    setSelectedId(conv.id);
  }

  function markRead(connectionId: string) {
    fetch("/api/messages/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connection_id: connectionId }),
    })
      .then(() => emitUnreadChanged())
      .catch(() => {});
  }

  fetchConversationsRef.current = fetchConversations;

  useEffect(() => {
    const t = setTimeout(() => fetchConversations(), 0);
    return () => clearTimeout(t);
  }, [fetchConversations]);

  const fetchMessages = useCallback(async (connectionId: string) => {
    try {
      const res = await fetch(`/api/connections/${connectionId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.connection) setConnection(mapConnection(data.connection));
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages.map((m: Record<string, unknown>) => mapMessage(m)));
          markRead(connectionId);
          return;
        }
      }
    } catch {
      // Fall through to empty
    }
    setMessages([
      {
        id: "system-1",
        text: "ברוכים הבאים לשיחה! כל התקשורת עוברת דרך הפלטפורמה.",
        senderId: "system",
        isSystem: true,
        createdAt: new Date().toISOString(),
        kind: "text",
        data: null,
      },
    ]);
  }, []);
  fetchMessagesRef.current = fetchMessages;

  useEffect(() => {
    if (selectedId) fetchMessagesRef.current(selectedId);
  }, [selectedId]);

  // Realtime subscription for new messages in the open chat
  useEffect(() => {
    if (!selectedId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`messages:${selectedId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `connection_id=eq.${selectedId}`,
        },
        (payload) => {
          const newMsg = payload.new as Record<string, unknown>;
          const mapped = mapMessage(newMsg);
          if (mapped.kind === "video" || mapped.kind === "brief" || mapped.kind === "event") {
            // Cards need the signed URL / the connection flags that come with the full fetch
            fetchMessagesRef.current(selectedId);
          } else {
            setMessages((prev) => (prev.some((m) => m.id === mapped.id) ? prev : [...prev, mapped]));
            markRead(selectedId);
          }
          setConversations((prev) =>
            prev.map((c) => (c.id === selectedId ? { ...c, lastMessage: mapped.text, time: "עכשיו" } : c))
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "connections", filter: `id=eq.${selectedId}` },
        () => fetchMessagesRef.current(selectedId)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedId]);

  // Realtime subscription for the conversations list (new connections, status changes, new messages anywhere)
  useEffect(() => {
    if (!user) return;

    const supabase = createClient();
    const channel = supabase
      .channel("connections-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "connections" }, () => {
        fetchConversationsRef.current();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        fetchConversationsRef.current();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const upload = useDeliverableUpload((connectionId) => {
    fetchMessagesRef.current(connectionId);
    fetchConversationsRef.current();
  });

  async function handleSendMessage() {
    if (!newMessage.trim() || !selectedId) return;
    const msgText = newMessage.trim();

    // "דרוש שינוי: …" from the brand files the (single) revision request
    if (revisionMode) {
      const notes = msgText.replace(new RegExp(`^${CHAT_EVENT_TEXTS.revisionPrefix.trim()}\\s*`), "").trim();
      if (!notes) {
        toast("כתבו מה צריך לשנות בסרטון", "error");
        return;
      }
      await updateStatus("revision_requested", { revision_notes: notes });
      setRevisionMode(false);
      setNewMessage("");
      return;
    }

    setNewMessage("");
    const optimisticMsg: Message = {
      id: `local-${Date.now()}`,
      text: msgText,
      senderId: user?.id || "me",
      isSystem: false,
      createdAt: new Date().toISOString(),
      kind: "text",
      data: null,
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    setSendingMessage(true);
    try {
      const res = await fetch(`/api/connections/${selectedId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: msgText }),
      });
      if (res.ok) {
        setBlockedNotice(null);
        setConversations((prev) => {
          const idx = prev.findIndex((c) => c.id === selectedId);
          if (idx < 0) return prev;
          const updated = { ...prev[idx], lastMessage: msgText, time: "עכשיו" };
          return [updated, ...prev.filter((_, i) => i !== idx)];
        });
      } else {
        const data = await res.json().catch(() => null);
        if (res.status === 400 && data?.error) {
          toast(data.error, "error");
          // Keep the reason on screen under the composer and give the text back for editing
          setBlockedNotice(data.error);
          setNewMessage(msgText);
          setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
        }
      }
    } catch {
      // Message shows locally
    } finally {
      setSendingMessage(false);
    }
  }

  // Status moves from the chat (delivered / shipped / completed / revision_requested)
  async function updateStatus(status: string, extra: Record<string, unknown> = {}) {
    if (!selectedId) return false;
    setActing(true);
    try {
      const res = await fetch(`/api/connections/${selectedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...extra }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast((data as { error?: string }).error || "שגיאה בעדכון", "error");
        return false;
      }
      await fetchMessages(selectedId);
      fetchConversationsRef.current();
      return true;
    } catch {
      toast("שגיאה בעדכון", "error");
      return false;
    } finally {
      setActing(false);
    }
  }

  async function approveBrief() {
    if (!selectedId) return;
    setActing(true);
    try {
      const res = await fetch(`/api/connections/${selectedId}/brief`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast("הבריף אושר — העסק יקבל עדכון וישלח את המוצר", "success");
        await fetchMessages(selectedId);
      } else {
        toast((data as { error?: string }).error || "שגיאה באישור הבריף", "error");
      }
    } catch {
      toast("שגיאה באישור הבריף", "error");
    } finally {
      setActing(false);
    }
  }

  function startRevision() {
    setRevisionMode(true);
    setNewMessage(CHAT_EVENT_TEXTS.revisionPrefix);
    setTimeout(() => composerRef.current?.focus(), 0);
  }

  async function submitShipped() {
    if (!connection) return;
    const digital = connection.deliveryType === "digital" || connection.productType === "digital";
    if (digital && !shipForm.digitalAccessValue.trim()) {
      toast("הזינו את פרטי הגישה למוצר הדיגיטלי", "error");
      return;
    }
    const ok = await updateStatus("shipped", {
      tracking_number: shipForm.trackingNumber.trim() || undefined,
      tracking_url: shipForm.trackingUrl.trim() || undefined,
      digital_access_value: shipForm.digitalAccessValue.trim() || undefined,
    });
    if (ok) {
      setShipOpen(false);
      setShipForm({ trackingNumber: "", trackingUrl: "", digitalAccessValue: "" });
      toast(digital ? "פרטי הגישה נשלחו ליוצר/ת" : "עדכנו את היוצר/ת שהמוצר בדרך", "success");
    }
  }

  const selectedConversation = conversations.find((c) => c.id === selectedId);
  const otherName = selectedConversation?.name || (role === "brand" ? connection?.creatorName : connection?.brandName) || "";
  const otherAvatar = selectedConversation?.avatar ?? (role === "brand" ? connection?.creatorAvatar : connection?.brandAvatar) ?? null;
  const otherUserId = selectedConversation?.otherUserId || (role === "brand" ? connection?.creatorUserId : connection?.brandUserId) || null;
  const chatOpen = connection ? isChatOpen(connection.status) : !selectedConversation?.closed;
  const briefMessages = messages.filter((m) => m.kind === "brief" && isBriefSnapshot(m.data));
  const latestBriefVersion = briefMessages.reduce((max, m) => Math.max(max, (m.data as unknown as BriefSnapshot).version || 0), 0);
  const latestBrief = briefMessages.find((m) => (m.data as unknown as BriefSnapshot).version === latestBriefVersion)?.data as unknown as BriefSnapshot | undefined;
  const briefApproved = !!connection?.briefApprovedAt;
  const creatorCanApprove = role === "creator" && !!connection && connection.status === "approved" && !!connection.briefPostedAt && !briefApproved;
  const deadlineText = connection ? deadlineLabel(connection.deadline) : null;
  const nextAction = connection && role ? flowNextAction(connection.status, role, { initiatedBy: connection.initiatedBy, deliveryType: connection.deliveryType || connection.productType }) : null;
  const isDigital = connection ? connection.deliveryType === "digital" || connection.productType === "digital" : false;
  const finalRound = !!connection && connection.revisionCount >= maxRevisions;

  // The action strip above the composer: what this side does now
  function renderActions() {
    if (!connection || !role || !chatOpen) return null;
    const s = connection.status;
    if (role === "creator") {
      if (s === "approved") {
        if (!connection.briefPostedAt) return <Hint icon="📋" text="העסק יעלה את הבריף לסרטון — אפשר לכתוב לו בינתיים" />;
        if (!briefApproved) {
          return (
            <div className="space-y-1.5">
              <Button fullWidth loading={acting} onClick={approveBrief}>✅ אישור הבריף</Button>
              <p className="text-[11px] text-neutral-500 text-center">רוצה לשנות משהו? כתבי לעסק בצ&apos;אט והוא יעדכן את הבריף</p>
            </div>
          );
        }
        return <Hint icon="📦" text={`${isDigital ? "העסק ישלח את פרטי הגישה" : "העסק שולח את המוצר"}${deadlineText ? ` · ${deadlineText}` : ""}`} />;
      }
      if (s === "shipped") {
        return (
          <div className="space-y-1.5">
            <Button fullWidth loading={acting} onClick={() => updateStatus("delivered")}>
              {isDigital ? "✅ אישור קבלת הגישה" : "📦 אישור קבלת החבילה"}
            </Button>
            <p className="text-[11px] text-neutral-500 text-center">
              {connection.trackingNumber ? `מספר מעקב: ${connection.trackingNumber} · ` : ""}מרגע האישור מתחיל זמן הצילום
            </p>
          </div>
        );
      }
      if (s === "delivered" || s === "filming" || s === "revision_requested") {
        return (
          <div className="space-y-1.5">
            {s === "revision_requested" && connection.revisionNotes && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                ✏️ העסק ביקש: {connection.revisionNotes}
              </p>
            )}
            <Button fullWidth loading={upload.uploadingId === connection.id} onClick={() => upload.start(connection.id)}>
              {upload.buttonLabel(connection.id, s === "revision_requested" ? "🎬 העלאת הגרסה המתוקנת" : "🎬 העלאת הסרטון")}
            </Button>
            <p className="text-[11px] text-neutral-500 text-center">
              {deadlineText ? `זמן לצילום ולהעלאה: ${deadlineText}` : "צלמו לפי הבריף והעלו כאן"}
            </p>
          </div>
        );
      }
      if (s === "uploaded" || s === "in_review") {
        return <Hint icon="👀" text={`הסרטון אצל העסק לבדיקה${deadlineText ? ` · ${deadlineText}` : ""}${finalRound ? " · ללא תשובה החיבור יושלם אוטומטית" : ""}`} />;
      }
      return null;
    }

    // brand
    if (s === "approved") {
      if (!connection.briefPostedAt) {
        return (
          <Button fullWidth onClick={() => router.push(`/brand/products/${connection.productId}/brief?connection=${connection.id}`)}>
            📋 העלאת הבריף לצ&apos;אט
          </Button>
        );
      }
      if (!briefApproved) {
        return (
          <div className="space-y-1.5">
            <Hint icon="⏳" text="ממתינים לאישור הבריף מהיוצר/ת" />
            <button
              type="button"
              onClick={() => router.push(`/brand/products/${connection.productId}/brief?connection=${connection.id}`)}
              className="w-full text-xs text-pink-600 font-medium py-1"
            >
              ✏️ עדכון הבריף
            </button>
          </div>
        );
      }
      return (
        <div className="space-y-1.5">
          <Button fullWidth loading={acting} onClick={() => setShipOpen(true)}>
            {isDigital ? "📲 שליחת פרטי הגישה" : "📦 המוצר נשלח"}
          </Button>
          <p className="text-[11px] text-neutral-500 text-center">{deadlineText ? `זמן למשלוח: ${deadlineText}` : "עדכנו כשהמוצר יוצא"}</p>
        </div>
      );
    }
    if (s === "shipped") return <Hint icon="🚚" text={isDigital ? "ממתינים לאישור קבלת הגישה" : "המוצר בדרך — ממתינים לאישור קבלה"} />;
    if (s === "delivered" || s === "filming") return <Hint icon="🎬" text={`היוצר/ת מצלם/ת${deadlineText ? ` · ${deadlineText}` : ""}`} />;
    if (s === "revision_requested") return <Hint icon="⏳" text="ממתינים לגרסה המתוקנת" />;
    if (s === "uploaded" || s === "in_review") {
      return (
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <Button fullWidth loading={acting} onClick={() => updateStatus("completed")}>✅ מאשר סרטון</Button>
            {!finalRound && (
              <Button fullWidth variant="secondary" disabled={acting || revisionMode} onClick={startRevision}>✏️ דרוש שינוי</Button>
            )}
          </div>
          <p className="text-[11px] text-neutral-500 text-center">
            {finalRound
              ? `זו הגרסה המתוקנת${deadlineText ? ` · ${deadlineText}` : ""} · ללא תשובה הסרטון יאושר אוטומטית`
              : `אפשר לבקש שינוי פעם אחת${deadlineText ? ` · ${deadlineText}` : ""}`}
          </p>
        </div>
      );
    }
    return null;
  }

  return (
    <main className="min-h-screen bg-background pb-20">
      {upload.input}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-neutral-100">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">הודעות</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto">
        {loading ? (
          <div className="space-y-0">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b border-neutral-50">
                <div className="w-10 h-10 rounded-full bg-pink-100 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-neutral-100 rounded-lg w-32 animate-pulse" />
                  <div className="h-3 bg-neutral-100 rounded-lg w-full animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-20 text-neutral-400">
            <span className="text-4xl block mb-4">💬</span>
            <p>אין שיחות פעילות</p>
            <p className="text-sm mt-1">הצ&apos;אט נפתח כשיש מאטץ&apos; מאושר — עם הבריף לסרטון</p>
          </div>
        ) : (
          conversations.map((conv) => (
            <motion.button
              key={conv.id}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-pink-50/50 transition-colors border-b border-neutral-50 text-right"
              onClick={() => openConversation(conv)}
              whileTap={{ scale: 0.98 }}
            >
              <div className="relative">
                <Avatar src={conv.avatar} name={conv.name} size="md" />
                {conv.unread > 0 && (
                  <span className="absolute -top-0.5 -left-0.5 w-4 h-4 rounded-full bg-pink-500 text-white text-[9px] flex items-center justify-center font-bold ring-2 ring-white">
                    {conv.unread}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`font-medium text-sm ${conv.unread > 0 ? "text-neutral-900" : "text-neutral-600"}`}>{conv.name}</span>
                  <span className="text-xs text-neutral-400">{conv.time}</span>
                </div>
                {conv.product && <span className="text-xs text-pink-500 block mb-0.5">{conv.product}{conv.closed ? " · הסתיים" : ""}</span>}
                <p className={`text-sm truncate ${conv.unread > 0 ? "text-neutral-700 font-medium" : "text-neutral-400"}`}>{conv.lastMessage}</p>
              </div>
            </motion.button>
          ))
        )}
      </div>

      {selectedId && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-100">
            <button
              onClick={() => {
                setSelectedId(null);
                fetchConversationsRef.current();
              }}
              className="p-2 -mr-2 rounded-lg hover:bg-neutral-100"
              aria-label="חזרה"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
            <button
              type="button"
              className="flex items-center gap-3 flex-1 min-w-0 text-right disabled:cursor-default"
              disabled={!otherUserId}
              onClick={() => otherUserId && setViewProfileId(otherUserId)}
              aria-label="צפייה בפרופיל"
            >
              <Avatar src={otherAvatar} name={otherName} size="sm" />
              {(selectedConversation?.productImage || connection?.productImage) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={(selectedConversation?.productImage || connection?.productImage) as string}
                  alt={selectedConversation?.product || connection?.productName || ""}
                  className="w-8 h-8 rounded-lg object-cover -mr-1 ring-2 ring-white"
                />
              )}
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">
                  {otherName}
                  {otherUserId && <span className="text-[10px] text-neutral-400 mr-1.5">· פרופיל</span>}
                </p>
                <p className="text-xs text-pink-500 truncate">{selectedConversation?.product || connection?.productName}</p>
              </div>
            </button>
            {(latestBrief || connection?.productId) && (
              <button
                type="button"
                onClick={() => setBriefOpen(true)}
                className="px-2.5 py-1.5 rounded-lg bg-pink-50 text-pink-600 text-xs font-bold whitespace-nowrap"
                aria-label="הבריף"
              >
                📋 הבריף
              </button>
            )}
          </header>

          {/* Where we are: the five milestones, the running clock and what happens next */}
          {connection && role && (
            <div className="px-4 py-2.5 border-b border-neutral-100 bg-neutral-50/60">
              <ConnectionTimeline
                status={connection.status}
                role={role}
                initiatedBy={connection.initiatedBy}
                deliveryType={connection.deliveryType || connection.productType}
                deadline={connection.deadline}
                compact
                showNext={false}
              />
              {nextAction?.text && (
                <p className={`text-[11px] mt-1.5 ${nextAction.mine ? "text-pink-600 font-medium" : "text-neutral-500"}`}>
                  {connection.status === "approved" && connection.briefPostedAt && !briefApproved
                    ? role === "creator" ? "אשרי את הבריף כדי שהעסק ישלח את המוצר" : "היוצר/ת מאשר/ת את הבריף ואז שולחים את המוצר"
                    : nextAction.text}
                  {deadlineText && connection.status !== "approved" ? ` · ${deadlineText}` : ""}
                </p>
              )}
            </div>
          )}

          <ProfileModal userId={viewProfileId} onClose={() => setViewProfileId(null)} as={role === "brand" ? "creator" : "brand"} />

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-neutral-400 text-sm h-full">
                <div className="text-center">
                  <span className="text-4xl block mb-3">💬</span>
                  <p>התחילו שיחה</p>
                  <p className="text-xs mt-1">כל התקשורת עוברת דרך הפלטפורמה</p>
                </div>
              </div>
            ) : (
              messages.map((msg, i) => {
                const isMe = msg.senderId === (user?.id || "me");
                const prev = messages[i - 1];
                // A day separator before the first message of each day (QA 14)
                const daySeparator = !prev || !sameDay(prev.createdAt, msg.createdAt) ? (
                  <div className="text-center pt-1">
                    <span className="text-[11px] text-neutral-400">{dayLabel(msg.createdAt)}</span>
                  </div>
                ) : null;
                const time = formatMessageTime(msg.createdAt);

                if (msg.kind === "brief" && isBriefSnapshot(msg.data)) {
                  const snap = msg.data as unknown as BriefSnapshot;
                  const isLatest = snap.version === latestBriefVersion;
                  return (
                    <Fragment key={msg.id}>
                      {daySeparator}
                      <div className={`flex ${isMe ? "justify-start" : "justify-end"}`}>
                        {isLatest ? (
                          <BriefCard
                            snapshot={snap}
                            approved={briefApproved}
                            canApprove={creatorCanApprove}
                            approving={acting}
                            onApprove={approveBrief}
                          />
                        ) : (
                          <div className="max-w-[75%] px-4 py-2.5 rounded-2xl text-xs bg-neutral-50 text-neutral-400 border border-neutral-100">
                            📋 בריף גרסה {snap.version} — הוחלף בגרסה חדשה
                          </div>
                        )}
                      </div>
                      <p className={`text-[10px] text-neutral-400 ${isMe ? "text-right" : "text-left"} -mt-2 px-1`} dir="ltr">{time}</p>
                    </Fragment>
                  );
                }

                if (msg.kind === "video" && isVideoCard(msg.data)) {
                  const v = msg.data;
                  const round = typeof v.round === "number" ? v.round : 1;
                  const vStatus = (v as Record<string, unknown>).status as string | null;
                  const poster = (v.thumbnail_url as string | null) || null;
                  const url = (v.url as string | null) || null;
                  return (
                    <Fragment key={msg.id}>
                      {daySeparator}
                      <div className={`flex ${isMe ? "justify-start" : "justify-end"}`}>
                        <div className="max-w-[80%] w-64 bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
                          <button
                            type="button"
                            disabled={!url}
                            onClick={() => url && setPlaying({ url, poster })}
                            className="relative block w-full aspect-[9/12] bg-neutral-900"
                            aria-label="הפעלת הסרטון"
                          >
                            {poster ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={poster} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-5xl text-white/60">🎬</div>
                            )}
                            <span className="absolute inset-0 flex items-center justify-center">
                              <span className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center text-2xl text-pink-500 shadow">▶</span>
                            </span>
                          </button>
                          <div className="px-3 py-2">
                            <p className="text-sm font-bold text-neutral-900">{round > 1 ? "🎬 הגרסה המתוקנת" : "🎬 הסרטון"}</p>
                            <p className="text-[11px] text-neutral-500">
                              {vStatus === "approved" ? "✅ אושר" : vStatus === "revision_requested" ? "✏️ נדרש שינוי" : round > 1 ? "סופי — לאישור העסק" : "ממתין לאישור העסק"}
                            </p>
                          </div>
                        </div>
                      </div>
                      <p className={`text-[10px] text-neutral-400 ${isMe ? "text-right" : "text-left"} -mt-2 px-1`} dir="ltr">{time}</p>
                    </Fragment>
                  );
                }

                if (msg.isSystem) {
                  return (
                    <Fragment key={msg.id}>
                      {daySeparator}
                      <div className="text-center">
                        <span className="text-xs text-neutral-400 bg-neutral-50 px-3 py-1 rounded-full">{msg.text}</span>
                      </div>
                    </Fragment>
                  );
                }

                // text and "event" messages written in a person's name ("אישרתי את הבריף", "קיבלתי את החבילה", "דרוש שינוי: …")
                const event = msg.kind === "event";
                return (
                  <Fragment key={msg.id}>
                    {daySeparator}
                    <div className={`flex ${isMe ? "justify-start" : "justify-end"}`}>
                      <div
                        className={`max-w-[75%] px-4 pt-2.5 pb-1.5 rounded-2xl text-sm ${
                          isMe
                            ? `${event ? "bg-pink-600" : "bg-pink-500"} text-white rounded-br-md`
                            : `${event ? "bg-pink-50 border border-pink-100 text-neutral-800" : "bg-neutral-100 text-neutral-800"} rounded-bl-md`
                        }`}
                      >
                        <span className="whitespace-pre-wrap break-words">{event ? (msg.text.startsWith(CHAT_EVENT_TEXTS.revisionPrefix.trim()) ? "✏️ " : "✓ ") : ""}{msg.text}</span>
                        <span
                          className={`block text-[10px] leading-none mt-1.5 text-left ${isMe ? "text-pink-100" : "text-neutral-400"}`}
                          dir="ltr"
                          title={new Date(msg.createdAt).toLocaleString("he-IL")}
                        >
                          {time}
                        </span>
                      </div>
                    </div>
                  </Fragment>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 border-t border-neutral-100 pb-[calc(0.75rem+env(safe-area-inset-bottom))] space-y-2">
            {!chatOpen ? (
              <div className="text-center text-sm text-neutral-500 bg-neutral-50 rounded-xl px-4 py-3">
                {(connection?.status || selectedConversation?.status) === "completed" ? "✅ החיבור הושלם — הצ'אט סגור לקריאה בלבד" : "החיבור הסתיים — הצ'אט סגור לקריאה בלבד"}
              </div>
            ) : (
              <>
                {renderActions()}
                <div className="flex gap-2">
                  <input
                    ref={composerRef}
                    type="text"
                    placeholder={revisionMode ? "מה צריך לשנות בסרטון?" : "כתבו הודעה..."}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    className={`flex-1 px-4 py-3 rounded-xl border text-sm outline-none focus:ring-1 ${revisionMode ? "bg-amber-50 border-amber-200 focus:border-amber-400 focus:ring-amber-200" : "bg-neutral-50 border-neutral-100 focus:border-pink-300 focus:ring-pink-200"}`}
                  />
                  {revisionMode && (
                    <button type="button" onClick={() => { setRevisionMode(false); setNewMessage(""); }} className="px-3 rounded-xl text-neutral-400 hover:text-neutral-600 text-sm" aria-label="ביטול בקשת השינוי">✕</button>
                  )}
                  <button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || sendingMessage || acting}
                    className={`px-5 py-3 rounded-xl text-white text-sm font-medium disabled:opacity-50 transition-opacity ${revisionMode ? "bg-amber-500 active:bg-amber-600" : "bg-pink-500 active:bg-pink-600"}`}
                  >
                    {revisionMode ? "שליחת הבקשה" : "שלחו"}
                  </button>
                </div>
                {blockedNotice ? (
                  // The server refused the message (contact details / links): say so where the user is looking (QA 14)
                  <div role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-700">
                    <span aria-hidden="true">🚫</span>
                    <span className="flex-1">
                      <span className="font-semibold block">ההודעה לא נשלחה</span>
                      {blockedNotice}
                    </span>
                    <button onClick={() => setBlockedNotice(null)} className="text-red-400 hover:text-red-600 leading-none" aria-label="סגירה">✕</button>
                  </div>
                ) : revisionMode ? (
                  <p className="text-[11px] text-amber-700 text-center">הבקשה תישלח ליוצר/ת כ&quot;דרוש שינוי&quot; — אפשר לבקש שינוי פעם אחת בלבד</p>
                ) : (
                  <p className="text-[11px] text-neutral-500 text-center">🔒 כל התקשורת נשארת בפלטפורמה — הודעה עם טלפון, אימייל או קישור לא תישלח</p>
                )}
              </>
            )}
          </div>

          {/* The agreed brief, any time */}
          <Modal open={briefOpen} onClose={() => setBriefOpen(false)} title="📋 הבריף שסיכמנו" size="md" className="max-h-[90vh] overflow-y-auto">
            {latestBrief ? (
              <>
                <BriefFull data={latestBrief.brief_data} notes={latestBrief.brief} productName={latestBrief.product_name} />
                <p className="text-[11px] text-neutral-400 mt-3 text-center">
                  {briefApproved ? "✅ הבריף אושר על ידי היוצר/ת" : "ממתין לאישור היוצר/ת"}
                  {latestBrief.version > 1 ? ` · גרסה ${latestBrief.version}` : ""}
                </p>
                {creatorCanApprove && (
                  <Button fullWidth className="mt-3" loading={acting} onClick={() => { setBriefOpen(false); approveBrief(); }}>✅ אישור הבריף</Button>
                )}
              </>
            ) : (
              <p className="text-sm text-neutral-500 text-center py-4">{role === "brand" ? "עדיין לא הועלה בריף לצ'אט הזה" : "העסק עדיין לא העלה בריף"}</p>
            )}
            {role === "brand" && connection?.productId && chatOpen && (
              <Button variant="secondary" fullWidth className="mt-3" onClick={() => router.push(`/brand/products/${connection.productId}/brief?connection=${connection.id}`)}>
                ✏️ {latestBrief ? "עדכון הבריף" : "מילוי הבריף"}
              </Button>
            )}
          </Modal>

          {/* Brand: the product left (tracking) / digital access details */}
          <Modal open={shipOpen} onClose={() => setShipOpen(false)} title={isDigital ? "📲 שליחת פרטי גישה" : "📦 המוצר נשלח"} size="sm">
            <div className="space-y-3">
              {isDigital ? (
                <Textarea
                  label="פרטי הגישה"
                  value={shipForm.digitalAccessValue}
                  onChange={(e) => setShipForm((p) => ({ ...p, digitalAccessValue: e.target.value }))}
                  placeholder="קוד קופון / קישור / פרטי התחברות"
                  rows={3}
                />
              ) : (
                <>
                  <Input
                    label="מספר מעקב (אופציונלי)"
                    value={shipForm.trackingNumber}
                    onChange={(e) => setShipForm((p) => ({ ...p, trackingNumber: e.target.value }))}
                    placeholder="RR123456789IL"
                    dir="ltr"
                  />
                  <Input
                    label="קישור למעקב (אופציונלי)"
                    value={shipForm.trackingUrl}
                    onChange={(e) => setShipForm((p) => ({ ...p, trackingUrl: e.target.value }))}
                    placeholder="https://"
                    dir="ltr"
                  />
                </>
              )}
              <p className="text-[11px] text-neutral-500">היוצר/ת יקבל/תקבל הודעה בצ&apos;אט ויאשר/תאשר קבלה — ואז יתחיל זמן הצילום.</p>
              <div className="flex gap-2">
                <Button fullWidth loading={acting} onClick={submitShipped}>שליחה</Button>
                <Button fullWidth variant="ghost" onClick={() => setShipOpen(false)}>ביטול</Button>
              </div>
            </div>
          </Modal>

          {/* The deliverable, full screen */}
          <Modal open={!!playing} onClose={() => setPlaying(null)} size="md" className="bg-black">
            {playing && (
              <video controls autoPlay playsInline src={playing.url} poster={playing.poster || undefined} className="w-full max-h-[75vh] rounded-xl bg-black" />
            )}
          </Modal>
        </div>
      )}
    </main>
  );
}

function Hint({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-neutral-600 bg-neutral-50 border border-neutral-100 rounded-xl px-3 py-2">
      <span aria-hidden="true">{icon}</span>
      <span className="flex-1">{text}</span>
    </div>
  );
}
