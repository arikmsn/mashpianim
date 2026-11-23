"use client";

import { useEffect } from "react";
import { manifestHref, personaForRole, readStoredPersona, storePersona } from "@/lib/persona";
import { useAuth } from "@/hooks/use-auth";
import { readCache } from "@/lib/client-cache";

// Keeps the device's persona in step with the account that uses it and points <link rel="manifest"> at the
// manifest of that persona, so "install the app" installs the business app for a business and the creator app
// for a creator (own start screen, own login colour). Renders nothing.
export function ManifestLink() {
  const { user } = useAuth();

  useEffect(() => {
    const apply = () => {
      const stored = readStoredPersona();
      const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
      if (link) {
        const href = manifestHref(stored);
        if (!link.getAttribute("href")?.startsWith(href)) link.setAttribute("href", href);
      }
    };
    apply();
    // The signed-in role decides once the profile is known (the cache is filled by the app shell)
    const cached = readCache<{ role?: string; user?: { type?: string } }>("/api/profile");
    const persona = personaForRole(cached?.role || cached?.user?.type);
    if (user && persona && persona !== readStoredPersona()) {
      storePersona(persona);
      apply();
    }
  }, [user]);

  return null;
}
