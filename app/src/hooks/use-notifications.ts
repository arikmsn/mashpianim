"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useAuth } from "@/hooks/use-auth";
import { createClient, isClientConfigured } from "@/lib/supabase/client";
import { readCache, writeCache } from "@/lib/client-cache";

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
  data?: Record<string, unknown> | null;
}

interface Snapshot {
  notifications: AppNotification[];
  unreadCount: number;
  loaded: boolean;
}

// ONE store for the whole app (bell badge, bottom nav, notifications screen): every consumer sees the same
// list and the same unread count the moment anything changes — a tap on the screen, a realtime insert,
// a poll, or the app coming back to the foreground.
const API = "/api/notifications";
const POLL_MS = 60_000;

function countUnread(items: AppNotification[]) {
  return items.filter((n) => !n.read).length;
}

const empty: Snapshot = { notifications: [], unreadCount: 0, loaded: false };
let snapshot: Snapshot = empty;
const listeners = new Set<() => void>();
let ownerId: string | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;
let visibilityBound = false;

function emit(next: Snapshot) {
  snapshot = next;
  listeners.forEach((l) => l());
}

function setItems(items: AppNotification[], loaded = true) {
  emit({ notifications: items, unreadCount: countUnread(items), loaded });
}

async function load() {
  if (!ownerId) return;
  try {
    const res = await fetch(API);
    if (!res.ok) return;
    const data = (await res.json()) as { notifications?: AppNotification[] };
    const items = data.notifications || [];
    writeCache(API, data);
    setItems(items);
  } catch {
    // keep what we have
  }
}

function onVisible() {
  if (document.visibilityState === "visible") load();
}

function stop() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  if (channel) {
    createClient().removeChannel(channel);
    channel = null;
  }
  if (visibilityBound) {
    document.removeEventListener("visibilitychange", onVisible);
    visibilityBound = false;
  }
}

function start(userId: string | null) {
  if (ownerId === userId && (userId === null || pollTimer)) return;
  stop();
  ownerId = userId;
  if (!userId) {
    emit(empty);
    return;
  }
  const cached = readCache<{ notifications?: AppNotification[] }>(API)?.notifications;
  if (cached) setItems(cached, false);
  load();
  pollTimer = setInterval(load, POLL_MS);
  document.addEventListener("visibilitychange", onVisible);
  visibilityBound = true;
  if (isClientConfigured()) {
    channel = createClient()
      .channel(`notifications-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => load())
      .subscribe();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function markNotificationRead(id: string) {
  const current = snapshot.notifications;
  if (!current.some((n) => n.id === id && !n.read)) return;
  setItems(current.map((n) => (n.id === id ? { ...n, read: true } : n)));
  try {
    await fetch(API, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, read: true }) });
  } catch {
    // optimistic update already applied; the next load reconciles
  }
}

export async function markAllNotificationsRead() {
  if (snapshot.unreadCount === 0) return;
  setItems(snapshot.notifications.map((n) => (n.read ? n : { ...n, read: true })));
  try {
    await fetch(API, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) });
  } catch {
    // reconciled on the next load
  }
}

export function useNotifications() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  useEffect(() => {
    start(userId);
  }, [userId]);

  const state = useSyncExternalStore(subscribe, () => snapshot, () => empty);

  return {
    notifications: state.notifications,
    unreadCount: state.unreadCount,
    loaded: state.loaded,
    markAsRead: markNotificationRead,
    markAllRead: markAllNotificationsRead,
    refresh: load,
  };
}
