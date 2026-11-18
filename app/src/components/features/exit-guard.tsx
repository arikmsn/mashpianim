"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { isExitGuardScreen } from "@/lib/exit-guard";

// Intercepts the device/browser Back on the home screens and confirms before the app is left. It keeps one extra
// history entry ("trap") for the current URL, so the first Back lands back here and opens the dialog instead of
// navigating away; "להישאר" re-arms the trap, "יציאה" lets the Back proceed.
export function ExitGuard() {
  const pathname = usePathname();
  const armed = isExitGuardScreen(pathname);
  const [open, setOpen] = useState(false);
  const exitingRef = useRef(false);

  useEffect(() => {
    if (!armed || typeof window === "undefined") return;
    window.history.pushState({ mashpianExitTrap: true }, "");
    const onPop = () => {
      if (exitingRef.current) {
        exitingRef.current = false; // a confirmed exit — let the navigation through
        return;
      }
      // Back from a home screen: we are now on the home entry; ask before leaving
      setOpen(true);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [armed, pathname]);

  if (!armed || !open) return null;

  const stay = () => {
    setOpen(false);
    // Re-arm so the next Back is caught too
    window.history.pushState({ mashpianExitTrap: true }, "");
  };
  const leave = () => {
    exitingRef.current = true;
    setOpen(false);
    window.history.back(); // proceed with the Back the user originally pressed
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="exit-guard-title"
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={stay}
    >
      <div
        className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-14 h-14 rounded-full ig-gradient-bg mx-auto mb-4 flex items-center justify-center">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </div>
        <h2 id="exit-guard-title" className="text-lg font-bold mb-1">לצאת ממשפיען אונליין?</h2>
        <p className="text-sm text-neutral-500 mb-5">לחצתם על ״חזור״. אפשר להישאר ולהמשיך, או לצאת מהאפליקציה. ההתחברות נשמרת ותוכלו לחזור בכל רגע.</p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={stay}
            className="w-full py-3 rounded-xl ig-gradient-bg text-white font-bold active:scale-[0.99] transition-transform"
          >
            להישאר באפליקציה
          </button>
          <button
            type="button"
            onClick={leave}
            className="w-full py-3 rounded-xl bg-neutral-100 text-neutral-600 font-medium active:scale-[0.99] transition-transform"
          >
            יציאה
          </button>
        </div>
      </div>
    </div>
  );
}
