"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin", label: "דשבורד", icon: "📊" },
  { href: "/admin/creators", label: "יוצרים", icon: "🎬" },
  { href: "/admin/brands", label: "עסקים", icon: "🏪" },
  { href: "/admin/moderation", label: "מודרציה", icon: "🛡️" },
  { href: "/admin/content", label: "תוכן האתר", icon: "✏️" },
  { href: "/admin/settings", label: "הגדרות", icon: "⚙️" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-row-reverse">
      {/* Desktop Sidebar — right side for RTL */}
      <aside className="hidden md:flex w-64 bg-[#0B051D] text-white flex-col fixed right-0 top-0 h-screen z-40">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="משפיען" width={32} height={32} className="rounded-lg" />
            <h1 className="text-lg font-bold">
              <span className="text-ig-pink">Mashpian</span> Admin
            </h1>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors",
                  active
                    ? "bg-pink-500/20 text-pink-300"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                )}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-white/10">
          <Link href="/" className="text-xs text-white/40 hover:text-white/70 transition-colors">
            → חזרה לאתר
          </Link>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-[#0B051D] text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image src="/logo.png" alt="משפיען" width={24} height={24} className="rounded-md" />
          <h1 className="text-sm font-bold">
            <span className="text-ig-pink">Mashpian</span> Admin
          </h1>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {mobileOpen ? (
              <path d="M18 6L6 18M6 6l12 12" />
            ) : (
              <>
                <path d="M3 12h18M3 6h18M3 18h18" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute right-0 top-0 h-full w-64 bg-[#0B051D] text-white flex flex-col animate-in slide-in-from-right">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Image src="/logo.png" alt="משפיען" width={32} height={32} className="rounded-lg" />
                <h1 className="text-lg font-bold">
                  <span className="text-ig-pink">Mashpian</span> Admin
                </h1>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1 rounded-lg hover:bg-white/10"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 p-4 space-y-1">
              {navItems.map((item) => {
                const active =
                  item.href === "/admin"
                    ? pathname === "/admin"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors",
                      active
                        ? "bg-pink-500/20 text-pink-300"
                        : "text-white/60 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <span>{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="p-4 border-t border-white/10">
              <Link href="/" className="text-xs text-white/40 hover:text-white/70 transition-colors">
                → חזרה לאתר
              </Link>
            </div>
          </aside>
        </div>
      )}

      {/* Main content — offset from right for desktop sidebar */}
      <main className="flex-1 md:mr-64 p-4 md:p-8 mt-14 md:mt-0">{children}</main>
    </div>
  );
}
