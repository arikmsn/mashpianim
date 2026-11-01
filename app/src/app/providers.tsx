"use client";

import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui";
import { ServiceWorkerRegister } from "@/components/pwa/sw-register";
import { InstallPrompt } from "@/components/pwa/install-prompt";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      {children}
      <ServiceWorkerRegister />
      <InstallPrompt />
    </ToastProvider>
  );
}
