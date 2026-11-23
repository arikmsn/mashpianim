"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { swrFetch } from "@/lib/client-cache";
import { homeForRole, personaForRole, storePersona } from "@/lib/persona";

// A signed-in creator or business who lands on a public screen (the home page, the login page) goes straight to
// their own screen: creators to the feed, businesses to the gallery (or the screen in `brandHome`). The check runs
// once, on the session that exists when the screen opens, so the login flow's own redirects are never raced.
// Admins and accounts without a role stay. The persona of the device is refreshed from the role on the way.
// Renders nothing.
export function SignedInRedirect({ brandHome = "/brand" }: { brandHome?: string }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const checked = useRef(false);

  useEffect(() => {
    if (loading || checked.current) return;
    checked.current = true;
    if (!user) return;
    swrFetch<{ role?: string; user?: { type?: string } }>("/api/profile", (data) => {
      const role = data.role || data.user?.type;
      const persona = personaForRole(role);
      if (persona) storePersona(persona);
      const home = homeForRole(role);
      if (home) router.replace(home === "/brand" ? brandHome : home);
    });
  }, [user, loading, router, brandHome]);

  return null;
}
