"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// A new worker that activates within this window after page load is the routine upgrade that happens on the
// first visit after a deploy: the page on screen was just fetched from the network, so there is nothing to
// reload and no banner to show (QA 12). Later activations (long-lived tab/app) get the banner.
const LOAD_UPGRADE_WINDOW_MS = 15_000;

// Other overlays (the install prompt) listen for this and step aside while the update banner is up
export const UPDATE_BANNER_EVENT = "mashpian:update-banner";

export function ServiceWorkerRegister() {
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state !== "activated" || !navigator.serviceWorker.controller) return;
            if (performance.now() < LOAD_UPGRADE_WINDOW_MS) return;
            setShowUpdate(true);
            window.dispatchEvent(new CustomEvent(UPDATE_BANNER_EVENT, { detail: { visible: true } }));
          });
        });
      })
      .catch(() => {});
  }, []);

  function hide() {
    setShowUpdate(false);
    window.dispatchEvent(new CustomEvent(UPDATE_BANNER_EVENT, { detail: { visible: false } }));
  }

  function handleUpdate() {
    hide();
    window.location.reload();
  }

  return (
    <AnimatePresence>
      {showUpdate && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          // Bottom placement: never covers a page header; sits above the bottom nav
          className="fixed bottom-20 left-4 right-4 z-50 max-w-sm mx-auto"
          role="status"
        >
          <div className="bg-white rounded-xl shadow-lg border border-neutral-100 p-3 flex items-center gap-3">
            <span className="text-sm flex-1">גרסה חדשה זמינה</span>
            <button
              onClick={handleUpdate}
              className="text-sm font-semibold text-pink-600 hover:text-pink-700 whitespace-nowrap"
            >
              עדכנו עכשיו
            </button>
            <button onClick={hide} className="text-neutral-400 hover:text-neutral-600 text-lg leading-none" aria-label="סגירה">
              ✕
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
