"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { BottomNav } from "@/components/ui";
import { useAuth } from "@/hooks/use-auth";
import { swrFetch } from "@/lib/client-cache";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      } else {
        setChecked(true);
      }
    }
  }, [user, loading, router, pathname]);

  // A session signed in as admin lives in the admin area; the app screens are for creators and brands
  useEffect(() => {
    if (!user) return;
    swrFetch<{ role?: string }>("/api/profile", (data) => {
      if (data.role === "admin") router.replace("/admin");
    });
  }, [user, router]);

  if (loading || !checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-3 border-pink-200 border-t-pink-500 animate-spin" />
          <p className="text-sm text-neutral-400">טוען...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="pb-20">{children}</div>
      <BottomNav />
    </>
  );
}
