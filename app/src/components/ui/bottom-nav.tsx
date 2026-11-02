"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

const compassIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
  </svg>
);

const connectionsIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const messagesIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const profileIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);

const productsIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

const dashboardIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
  </svg>
);

const creatorNavItems: NavItem[] = [
  { href: "/feed", label: "גלו", icon: compassIcon },
  { href: "/connections", label: "חיבורים", icon: connectionsIcon },
  { href: "/messages", label: "הודעות", icon: messagesIcon },
  { href: "/profile", label: "פרופיל", icon: profileIcon },
];

const brandNavItems: NavItem[] = [
  { href: "/brand", label: "לוח בקרה", icon: dashboardIcon },
  { href: "/brand/products", label: "מוצרים", icon: productsIcon },
  { href: "/brand/connections", label: "חיבורים", icon: connectionsIcon },
  { href: "/messages", label: "הודעות", icon: messagesIcon },
  { href: "/profile", label: "פרופיל", icon: profileIcon },
];

function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [userType, setUserType] = useState<"creator" | "brand" | "admin" | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const fetchedRef = useRef(false);

  const fetchUnread = useCallback(async () => {
    try {
      const res = await fetch("/api/messages/unread");
      if (res.ok) {
        const data = await res.json();
        setUnreadMessages(data.count || 0);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!user || fetchedRef.current) return;
    fetchedRef.current = true;

    fetch("/api/profile")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.user?.type) {
          setUserType(data.user.type as "creator" | "brand" | "admin");
        }
      })
      .catch(() => {});

    fetchUnread();
  }, [user, fetchUnread]);

  // Realtime: update badge on new messages
  useEffect(() => {
    if (!user) return;

    const supabase = createClient();
    const channel = supabase
      .channel("nav-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => {
          fetchUnread();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchUnread]);

  // Also refresh when navigating away from messages (user may have read them)
  useEffect(() => {
    if (user && !pathname.startsWith("/messages")) {
      fetchUnread();
    }
  }, [pathname, user, fetchUnread]);

  const navItems = userType === "brand" ? brandNavItems : creatorNavItems;

  const isActive = (href: string) => {
    if (href === "/brand" && pathname === "/brand") return true;
    if (href === "/brand") return false;
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-xl border-t border-neutral-100 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const badge = item.href === "/messages" ? unreadMessages : (item.badge || 0);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-colors relative min-w-[56px]",
                isActive(item.href)
                  ? "text-ig-pink"
                  : "text-neutral-400 active:text-neutral-600"
              )}
            >
              <span className={isActive(item.href) ? "[&>svg]:stroke-[2.5]" : ""}>
                {item.icon}
              </span>
              <span className={cn("text-[10px]", isActive(item.href) ? "font-bold" : "font-medium")}>{item.label}</span>
              {badge > 0 && (
                <span className="absolute -top-0.5 right-0.5 min-w-[18px] h-[18px] rounded-full ig-gradient-bg text-white text-[10px] flex items-center justify-center font-bold px-1">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
              {isActive(item.href) && (
                <span className="absolute -bottom-1.5 w-5 h-0.5 rounded-full ig-gradient-bg" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export { BottomNav };
