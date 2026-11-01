"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

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
            if (newWorker.state === "activated" && navigator.serviceWorker.controller) {
              setShowUpdate(true);
            }
          });
        });
      })
      .catch(() => {});
  }, []);

  function handleUpdate() {
    setShowUpdate(false);
    window.location.reload();
  }

  return (
    <AnimatePresence>
      {showUpdate && (
        <motion.div
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          className="fixed top-4 left-4 right-4 z-50 max-w-sm mx-auto"
        >
          <div className="bg-white rounded-xl shadow-lg border border-neutral-100 p-3 flex items-center gap-3">
            <span className="text-sm flex-1">גרסה חדשה זמינה</span>
            <button
              onClick={handleUpdate}
              className="text-sm font-semibold text-pink-600 hover:text-pink-700 whitespace-nowrap"
            >
              עדכנו עכשיו
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
