"use client";

import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui";
import { ServiceWorkerRegister } from "@/components/pwa/sw-register";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { ManifestLink } from "@/components/features/manifest-link";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      {children}
      <ServiceWorkerRegister />
      <ManifestLink />
      <InstallPrompt />
    </ToastProvider>
  );
}
