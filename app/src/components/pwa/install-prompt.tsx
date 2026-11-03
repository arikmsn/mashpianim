"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui";
import { UPDATE_BANNER_EVENT } from "./sw-register";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    // Check if dismissed recently (24h cooldown)
    const dismissed = localStorage.getItem("pwa-install-dismissed");
    if (dismissed && Date.now() - Number(dismissed) < 86400000) return;

    // iOS detection — Safari doesn't support beforeinstallprompt
    const ua = navigator.userAgent;
    const isiOS = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as Record<string, unknown>).MSStream;
    if (isiOS) {
      setIsIos(true);
      setTimeout(() => setShow(true), 3000);
      return;
    }

    // Android/Desktop — listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShow(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // One overlay at a time: step aside while the "new version" banner is up (QA 12)
  useEffect(() => {
    const onBanner = (e: Event) => {
      if ((e as CustomEvent<{ visible: boolean }>).detail?.visible) setShow(false);
    };
    window.addEventListener(UPDATE_BANNER_EVENT, onBanner);
    return () => window.removeEventListener(UPDATE_BANNER_EVENT, onBanner);
  }, []);

  async function handleInstall() {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShow(false);
      }
      setDeferredPrompt(null);
    }
  }

  function handleDismiss() {
    setShow(false);
    localStorage.setItem("pwa-install-dismissed", String(Date.now()));
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25 }}
          className="fixed bottom-20 left-4 right-4 z-50 max-w-md mx-auto"
        >
          <div className="bg-white rounded-2xl shadow-xl border border-neutral-100 p-4">
            <div className="flex items-start gap-3">
              <Image src="/icon-192.png" unoptimized alt="משפיען אונליין" width={48} height={48} className="rounded-xl flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm">התקינו את משפיען אונליין</h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {isIos
                    ? "לחצו על כפתור השיתוף ⬆️ ואז ״הוסף למסך הבית״"
                    : "גישה מהירה מהמסך הראשי, התראות ועוד"}
                </p>
              </div>
              <button
                onClick={handleDismiss}
                className="text-neutral-400 hover:text-neutral-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>
            {!isIos && (
              <div className="mt-3 flex gap-2">
                <Button size="sm" fullWidth onClick={handleInstall}>
                  התקנה
                </Button>
                <Button size="sm" variant="ghost" fullWidth onClick={handleDismiss}>
                  לא עכשיו
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
