"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Card, Badge, Button, useToast } from "@/components/ui";

interface BrandStats {
  activeProducts: number;
  pendingConnections: number;
  totalVideos: number;
  creditsRemaining: number;
}

interface RecentConnection {
  id: string;
  creatorName: string;
  productName: string;
  status: string;
  createdAt: string;
}

const statusLabels: Record<string, { label: string; variant: "pink" | "success" | "warning" | "default" }> = {
  pending: { label: "ממתין לאישור", variant: "warning" },
  approved: { label: "אושר", variant: "pink" },
  shipped: { label: "נשלח", variant: "pink" },
  filming: { label: "בצילום", variant: "pink" },
  uploaded: { label: "הועלה", variant: "pink" },
  in_review: { label: "בבדיקה", variant: "warning" },
  completed: { label: "הושלם", variant: "success" },
  rejected: { label: "נדחה", variant: "default" },
  cancelled: { label: "בוטל", variant: "default" },
};

function DashboardSkeleton() {
  return (
    <main className="min-h-screen bg-background">
      <div className="bg-gradient-to-b from-pink-100 to-background px-4 pt-8 pb-6">
        <div className="max-w-2xl mx-auto">
          <div className="h-7 bg-neutral-200 rounded-lg w-48 animate-pulse mb-2" />
          <div className="h-4 bg-neutral-100 rounded-lg w-64 animate-pulse" />
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4">
        <div className="grid grid-cols-2 gap-3 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-4 border border-neutral-100">
              <div className="h-8 bg-neutral-200 rounded-lg w-12 animate-pulse mb-2" />
              <div className="h-3 bg-neutral-100 rounded-lg w-20 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

export default function BrandDashboard() {
  const [stats, setStats] = useState<BrandStats>({
    activeProducts: 0,
    pendingConnections: 0,
    totalVideos: 0,
    creditsRemaining: 0,
  });
  const [connections, setConnections] = useState<RecentConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    async function fetchData() {
      try {
        const [productsRes, connectionsRes] = await Promise.all([
          fetch("/api/products?brand=me"),
          fetch("/api/connections"),
        ]);

        if (productsRes.ok) {
          const prodData = await productsRes.json();
          const products = prodData.products || [];
          const active = products.filter((p: Record<string, unknown>) => p.status === "active").length;
          setStats((prev) => ({ ...prev, activeProducts: active }));
        }

        if (connectionsRes.ok) {
          const connData = await connectionsRes.json();
          const conns = connData.connections || [];
          if (conns.length > 0) {
            const pending = conns.filter((c: Record<string, unknown>) => c.status === "pending").length;
            const completed = conns.filter((c: Record<string, unknown>) => c.status === "completed").length;
            setStats((prev) => ({ ...prev, pendingConnections: pending, totalVideos: completed }));
            setConnections(
              conns.slice(0, 5).map((c: Record<string, unknown>) => ({
                id: c.id as string,
                creatorName: (c.creator_name as string) || (c as any).creator?.full_name || "יוצר/ת",
                productName: (c.product_name as string) || (c as any).products?.name || "מוצר",
                status: c.status as string,
                createdAt: c.created_at as string,
              }))
            );
          }
        }
      } catch {
        // API unavailable
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <DashboardSkeleton />;

  const statCards = [
    { value: stats.activeProducts, label: "מוצרים פעילים", icon: "📦", color: "from-pink-500 to-rose-400" },
    { value: stats.pendingConnections, label: "ממתינים לאישור", icon: "⏳", color: "from-amber-500 to-orange-400" },
    { value: stats.totalVideos, label: "סרטונים שהתקבלו", icon: "🎬", color: "from-purple-500 to-indigo-400" },
    { value: stats.creditsRemaining, label: "סרטונים נותרים", icon: "🎬", color: "from-emerald-500 to-teal-400" },
  ];

  return (
    <main className="min-h-screen bg-background">
      <div className="bg-gradient-to-b from-pink-100 to-background px-4 pt-8 pb-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-neutral-900 mb-1">לוח בקרה</h1>
          <p className="text-sm text-neutral-500">נהלו את המוצרים והחיבורים שלכם</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-2">
        <div className="grid grid-cols-2 gap-3 mb-6">
          {statCards.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card padding="md" className="relative overflow-hidden">
                <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-l ${stat.color}`} />
                <div className="text-2xl mb-1">{stat.icon}</div>
                <div className="text-2xl font-bold text-neutral-900">{stat.value}</div>
                <div className="text-xs text-neutral-500 mt-0.5">{stat.label}</div>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="flex gap-3 mb-6">
          <Button
            fullWidth
            onClick={() => router.push("/brand/products")}
          >
            + הוספת מוצר
          </Button>
          <Button
            variant="secondary"
            fullWidth
            onClick={() => router.push("/brand/connections")}
          >
            צפו בחיבורים
          </Button>
        </div>

        <Card padding="sm" className="mb-6">
          <div className="flex items-center justify-between px-2 py-2">
            <span className="text-sm font-medium">🎬 {stats.creditsRemaining} סרטונים נותרים</span>
            <Button size="sm" variant="secondary" onClick={() => toast("רכישת סרטונים תהיה זמינה בקרוב", "info")}>
              רכישת סרטונים
            </Button>
          </div>
        </Card>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold">חיבורים אחרונים</h2>
            <button
              onClick={() => router.push("/brand/connections")}
              className="text-sm text-pink-500 font-medium"
            >
              הצג הכל
            </button>
          </div>
          <div className="space-y-2">
            {connections.length === 0 ? (
              <div className="text-center py-8 text-neutral-400">
                <span className="text-3xl block mb-2">📋</span>
                <p className="text-sm">אין חיבורים עדיין</p>
                <p className="text-xs mt-1">הוסיפו מוצרים כדי לקבל בקשות מיוצרי תוכן</p>
              </div>
            ) : (
              connections.map((conn) => {
                const statusInfo = statusLabels[conn.status] || { label: conn.status, variant: "default" as const };
                return (
                  <motion.div
                    key={conn.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <Card
                      hover
                      padding="md"
                      onClick={() => router.push(`/brand/connections?highlight=${conn.id}`)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{conn.creatorName}</p>
                          <p className="text-xs text-neutral-400">{conn.productName}</p>
                        </div>
                        <Badge variant={statusInfo.variant} size="sm">
                          {statusInfo.label}
                        </Badge>
                      </div>
                    </Card>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
