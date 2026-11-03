"use client";

import { useCallback, useSyncExternalStore } from "react";
import { createClient, isClientConfigured } from "@/lib/supabase/client";
import { clearCache, syncCacheOwner } from "@/lib/client-cache";
import type { User } from "@supabase/supabase-js";

interface AuthSnapshot {
  user: User | null;
  loading: boolean;
}

// One auth store for the whole app: the session is read once from the local
// cookie (no network round-trip) and every component shares the result.
let snapshot: AuthSnapshot = { user: null, loading: true };
const serverSnapshot: AuthSnapshot = { user: null, loading: true };
const listeners = new Set<() => void>();
let started = false;

function emit(next: AuthSnapshot) {
  snapshot = next;
  listeners.forEach((l) => l());
}

function start() {
  if (started) return;
  started = true;

  if (!isClientConfigured()) {
    emit({ user: null, loading: false });
    return;
  }

  const supabase = createClient();
  supabase.auth.getSession().then(({ data: { session } }) => {
    syncCacheOwner(session?.user?.id ?? null);
    emit({ user: session?.user ?? null, loading: false });
  });
  supabase.auth.onAuthStateChange((_event, session) => {
    syncCacheOwner(session?.user?.id ?? null);
    emit({ user: session?.user ?? null, loading: false });
  });
}

// Re-reads the session from the auth cookies (after a server-side sign-in) and notifies subscribers,
// so pages can navigate with the router instead of reloading the whole app.
export async function refreshAuth(): Promise<void> {
  if (!isClientConfigured()) return;
  const { data: { session } } = await createClient().auth.getSession();
  syncCacheOwner(session?.user?.id ?? null);
  emit({ user: session?.user ?? null, loading: false });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  start();
  return () => {
    listeners.delete(listener);
  };
}

export function useAuth() {
  const state = useSyncExternalStore(subscribe, () => snapshot, () => serverSnapshot);

  const signOut = useCallback(async () => {
    // Drop the previous user's cached API responses before the session goes away
    clearCache();
    // The role chosen at login lives in an httpOnly cookie; the server clears it
    await fetch("/api/auth/user-type", { method: "DELETE" }).catch(() => {});
    if (isClientConfigured()) {
      await createClient().auth.signOut();
    }
    syncCacheOwner(null);
    emit({ user: null, loading: false });
  }, []);

  return { user: state.user, loading: state.loading, signOut };
}
