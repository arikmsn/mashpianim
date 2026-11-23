"use client";

import { useEffect } from "react";
import { manifestHref, personaForRole, readStoredPersona, storePersona } from "@/lib/persona";
import { useAuth } from "@/hooks/use-auth";
import { swrFetch } from "@/lib/client-cache";

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
    // The signed-in role decides once the profile is known (cached by the app shell, fetched otherwise), so an
    // account that signed in before personas existed gets its colour on the first open after the update
    if (!user) return;
    swrFetch<{ role?: string; user?: { type?: string } }>("/api/profile", (data) => {
      const persona = personaForRole(data.role || data.user?.type);
      if (persona && persona !== readStoredPersona()) storePersona(persona);
      // Another screen may have stored the persona first (the signed-in redirect): the link follows either way
      apply();
    });
  }, [user]);

  return null;
}
