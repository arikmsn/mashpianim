"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { motion } from "framer-motion";
import { Avatar, Badge, useToast } from "@/components/ui";
import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";

interface Conversation {
  id: string;
  name: string;
  avatar: string | null;
  lastMessage: string;
  time: string;
  unread: number;
  product: string | null;
}

interface Message {
  id: string;
  text: string;
  senderId: string;
  isSystem: boolean;
  createdAt: string;
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

export default function MessagesPage() {
  return (
    <Suspense>
      <MessagesContent />
    </Suspense>
  );
}

function MessagesContent() {
  const searchParams = useSearchParams();
  const initialConnection = searchParams.get("connection");
  const [selectedId, setSelectedId] = useState<string | null>(initialConnection);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const fetchConversationsRef = useRef<() => void>(() => {});

  const fetchConversations = useCallback(async () => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    const activeStatuses = new Set(["approved", "shipped", "delivered", "filming", "uploaded", "in_review", "revision_requested"]);
    try {
      const res = await fetch("/api/connections");
      if (res.ok) {
        const data = await res.json();
        if (data.connections && data.connections.length > 0) {
          const active = data.connections.filter(
            (c: Record<string, unknown>) => activeStatuses.has(c.status as string)
          );
          const mapped: Conversation[] = active.map(
            (c: Record<string, unknown>) => {
              const bp = c.brand_profiles as Record<string, unknown> | null;
              const cp = c.creator_profiles as Record<string, unknown> | null;
              const prod = c.products as Record<string, unknown> | null;
              const brandName = (bp?.shop_name as string) || "";
              const brandUser = bp?.users as Record<string, unknown> | null;
              const brandAvatar = (bp?.logo_url as string) || (brandUser?.avatar_url as string) || null;
              const creatorUser = cp?.users as Record<string, unknown> | null;
              const creatorName = (creatorUser?.full_name as string) || "";
              const creatorAvatar = (creatorUser?.avatar_url as string) || null;
              const showBrand = !!brandName;
              return {
                id: c.id as string,
                name: showBrand ? brandName : creatorName || "",
                avatar: showBrand ? brandAvatar : creatorAvatar,
                lastMessage: (c.last_message as string) || "התחילו שיחה...",
                time: c.created_at ? formatTime(c.created_at as string) : "",
                unread: (c.unread_count as number) || 0,
                product: (prod?.name as string) || null,
              };
            }
          );
          if (mapped.length > 0) {
            setConversations(mapped);
          }
        }
      }
    } catch {
      // API unavailable
    } finally {
      setLoading(false);
    }
  }, [user, authLoading]);

  fetchConversationsRef.current = fetchConversations;

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (selectedId) {
      fetchMessages(selectedId);
    }
  }, [selectedId]);

  // Realtime subscription for new messages
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
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [
              ...prev,
              {
                id: newMsg.id as string,
                text: newMsg.text as string,
                senderId: newMsg.sender_id as string,
                isSystem: (newMsg.is_system as boolean) || false,
                createdAt: newMsg.created_at as string,
              },
            ];
          });
          // Mark as read since conversation is open
          fetch("/api/messages/read", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ connection_id: selectedId }),
          }).catch(() => {});
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedId]);

  // Realtime subscription for conversations list (new connections or status changes)
  useEffect(() => {
    if (!user) return;

    const supabase = createClient();
    const channel = supabase
      .channel("connections-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "connections",
        },
        () => {
          // Refetch conversations on any connection change
          fetchConversationsRef.current();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function fetchMessages(connectionId: string) {
    try {
      const res = await fetch(`/api/connections/${connectionId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.messages && data.messages.length > 0) {
          setMessages(
            data.messages.map((m: Record<string, unknown>) => ({
              id: m.id as string,
              text: m.text as string,
              senderId: m.sender_id as string,
              isSystem: (m.is_system as boolean) || false,
              createdAt: m.created_at as string,
            }))
          );
          // Mark as read
          fetch("/api/messages/read", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ connection_id: connectionId }),
          }).catch(() => {});
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
      },
    ]);
  }

  async function handleSendMessage() {
    if (!newMessage.trim() || !selectedId) return;

    const msgText = newMessage.trim();
    setNewMessage("");

    const optimisticMsg: Message = {
      id: `local-${Date.now()}`,
      text: msgText,
      senderId: user?.id || "me",
      isSystem: false,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    setSendingMessage(true);
    try {
      const res = await fetch(`/api/connections/${selectedId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: msgText }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        if (res.status === 400 && data?.error) {
          toast(data.error, "error");
          setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
        }
      }
    } catch {
      // Message shows locally
    } finally {
      setSendingMessage(false);
    }
  }

  const selectedConversation = conversations.find((c) => c.id === selectedId);

  return (
    <main className="min-h-screen bg-background pb-20">
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
            <p className="text-sm mt-1">שיחות יופיעו כאן כשתתחילו לעבוד עם מותג או יוצר</p>
          </div>
        ) : (
          conversations.map((conv) => (
            <motion.button
              key={conv.id}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-pink-50/50 transition-colors border-b border-neutral-50 text-right"
              onClick={() => setSelectedId(conv.id)}
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
                  <span
                    className={`font-medium text-sm ${
                      conv.unread > 0 ? "text-neutral-900" : "text-neutral-600"
                    }`}
                  >
                    {conv.name}
                  </span>
                  <span className="text-xs text-neutral-400">{conv.time}</span>
                </div>
                {conv.product && (
                  <span className="text-xs text-pink-500 block mb-0.5">
                    {conv.product}
                  </span>
                )}
                <p
                  className={`text-sm truncate ${
                    conv.unread > 0
                      ? "text-neutral-700 font-medium"
                      : "text-neutral-400"
                  }`}
                >
                  {conv.lastMessage}
                </p>
              </div>
            </motion.button>
          ))
        )}
      </div>

      {selectedId && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-100">
            <button
              onClick={() => setSelectedId(null)}
              className="p-2 -mr-2 rounded-lg hover:bg-neutral-100"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
            <Avatar src={selectedConversation?.avatar} name={selectedConversation?.name || ""} size="sm" />
            <div>
              <p className="font-medium text-sm">{selectedConversation?.name}</p>
              <p className="text-xs text-pink-500">
                {selectedConversation?.product}
              </p>
            </div>
          </header>

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
              messages.map((msg) => {
                const isMe = msg.senderId === (user?.id || "me");
                if (msg.isSystem) {
                  return (
                    <div key={msg.id} className="text-center">
                      <span className="text-xs text-neutral-400 bg-neutral-50 px-3 py-1 rounded-full">
                        {msg.text}
                      </span>
                    </div>
                  );
                }
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMe ? "justify-start" : "justify-end"}`}
                  >
                    <div
                      className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                        isMe
                          ? "bg-pink-500 text-white rounded-br-md"
                          : "bg-neutral-100 text-neutral-800 rounded-bl-md"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 border-t border-neutral-100 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="כתבו הודעה..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                className="flex-1 px-4 py-3 rounded-xl bg-neutral-50 border border-neutral-100 text-sm outline-none focus:border-pink-300 focus:ring-1 focus:ring-pink-200"
              />
              <button
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || sendingMessage}
                className="px-5 py-3 rounded-xl bg-pink-500 text-white text-sm font-medium disabled:opacity-50 transition-opacity active:bg-pink-600"
              >
                שלחו
              </button>
            </div>
            <p className="text-[10px] text-neutral-400 text-center mt-1">שיתוף פרטי קשר אישיים אסור</p>
          </div>
        </div>
      )}
    </main>
  );
}
