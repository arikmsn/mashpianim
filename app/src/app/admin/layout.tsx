"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin", label: "דשבורד", icon: "📊" },
  { href: "/admin/creators", label: "יוצרים", icon: "🎬" },
  { href: "/admin/brands", label: "עסקים", icon: "🏪" },
  { href: "/admin/moderation", label: "מודרציה", icon: "🛡️" },
  { href: "/admin/settings", label: "הגדרות", icon: "⚙️" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-neutral-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-[#0B051D] text-white flex flex-col fixed h-screen">
        <div className="p-6 border-b border-white/10">
          <h1 className="text-lg font-bold">
            <span className="text-pink-400">Mashpianim</span> Admin
          </h1>
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
            ← חזרה לאתר
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 mr-64 p-8">{children}</main>
    </div>
  );
}
