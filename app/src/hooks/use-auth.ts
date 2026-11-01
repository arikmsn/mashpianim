"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createClient, isClientConfigured } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    if (!isClientConfigured()) {
      setLoading(false);
      return;
    }
    initializedRef.current = true;

    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      setUser(authUser);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    if (isClientConfigured()) {
      const supabase = createClient();
      await supabase.auth.signOut();
    }
    setUser(null);
  }, []);

  return { user, loading, signOut };
}
