"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Avatar, Badge, Button, Card, useToast } from "@/components/ui";
import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";

interface CreatorProfile {
  name: string;
  level: string;
  hearts: number;
  completedConnections: number;
  categories: string[];
  bio: string;
  stats: { connections: number; videos: number; avgRating: number };
}

interface BrandProfile {
  name: string;
  shopName: string;
  totalCredits: number;
  usedCredits: number;
  category: string;
  stats: { products: number; connections: number; creditsLeft: number };
}

const mockCreatorProfile: CreatorProfile = {
  name: "נועה כהן",
  level: "יוצרת+",
  hearts: 42,
  completedConnections: 15,
  categories: ["ביוטי", "אופנה", "לייפסטייל"],
  bio: "יוצרת תוכן עם אהבה למוצרי טיפוח ואופנה. תמיד מחפשת את המוצר הבא!",
  stats: { connections: 23, videos: 15, avgRating: 4.8 },
};

const mockVideos = [
  { id: "1", product: "סרום ויטמין C", brand: "GlowUp", status: "approved", views: 1200 },
  { id: "2", product: "שעון ספורט", brand: "TechFit", status: "approved", views: 890 },
  { id: "3", product: "תיק גב", brand: "UrbanStyle", status: "in_review", views: 0 },
];

const levelLabels: Record<string, string> = {
  creator: "יוצרת",
  creator_plus: "יוצרת+",
  on_the_radar: "על הרדאר",
};

function getMilestones(videoCount: number) {
  return [
    { count: 5, label: "5 סרטונים", achieved: videoCount >= 5 },
    { count: 10, label: "10 סרטונים", achieved: videoCount >= 10 },
    { count: 25, label: "25 סרטונים", achieved: videoCount >= 25 },
    { count: 50, label: "50 סרטונים", achieved: videoCount >= 50 },
  ];
}

function getNextMilestone(videoCount: number) {
  const targets = [5, 10, 25, 50, 100];
  const next = targets.find((t) => t > videoCount) || 100;
  return next;
}

function ProfileSkeleton() {
  return (
    <main className="min-h-screen bg-background">
      <div className="bg-gradient-to-b from-pink-100 to-background px-4 pt-8 pb-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-pink-200 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-5 bg-neutral-200 rounded-lg w-32 animate-pulse" />
              <div className="h-3 bg-neutral-100 rounded-lg w-full animate-pulse" />
              <div className="h-3 bg-neutral-100 rounded-lg w-2/3 animate-pulse" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="text-center">
                <div className="h-6 bg-neutral-200 rounded-lg w-12 mx-auto animate-pulse" />
                <div className="h-3 bg-neutral-100 rounded-lg w-16 mx-auto mt-2 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<"videos" | "badges">("videos");
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [brandProfile, setBrandProfile] = useState<BrandProfile | null>(null);
  const [userType, setUserType] = useState<"creator" | "brand" | null>(null);
  const [videos, setVideos] = useState(mockVideos);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    async function fetchProfile() {
      if (!user) {
        setProfile(mockCreatorProfile);
        setUserType("creator");
        setLoading(false);
        return;
      }

      try {
        const supabase = createClient();

        const { data: userData } = await supabase
          .from("users")
          .select("*")
          .eq("id", user.id)
          .single();

        if (!userData) {
          setProfile(mockCreatorProfile);
          setUserType("creator");
          setLoading(false);
          return;
        }

        if (userData.type === "creator") {
          const { data: creatorData } = await supabase
            .from("creator_profiles")
            .select("*")
            .eq("user_id", user.id)
            .single();

          if (creatorData) {
            setProfile({
              name: userData.full_name,
              level: levelLabels[creatorData.level] || creatorData.level,
              hearts: creatorData.hearts,
              completedConnections: creatorData.completed_connections,
              categories: creatorData.categories || [],
              bio: creatorData.bio || "",
              stats: {
                connections: creatorData.completed_connections,
                videos: creatorData.completed_connections,
                avgRating: 0,
              },
            });
            setUserType("creator");
          } else {
            setProfile(mockCreatorProfile);
            setUserType("creator");
          }
        } else if (userData.type === "brand") {
          const { data: brandData } = await supabase
            .from("brand_profiles")
            .select("*")
            .eq("user_id", user.id)
            .single();

          if (brandData) {
            setBrandProfile({
              name: userData.full_name,
              shopName: brandData.shop_name,
              totalCredits: brandData.total_credits,
              usedCredits: brandData.used_credits,
              category: brandData.category || "",
              stats: {
                products: 0,
                connections: 0,
                creditsLeft: brandData.total_credits - brandData.used_credits,
              },
            });
            setUserType("brand");
          } else {
            setProfile(mockCreatorProfile);
            setUserType("creator");
          }
        }
      } catch {
        setProfile(mockCreatorProfile);
        setUserType("creator");
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, [user]);

  if (loading) return <ProfileSkeleton />;

  if (userType === "brand" && brandProfile) {
    return (
      <main className="min-h-screen bg-background">
        <div className="bg-gradient-to-b from-pink-100 to-background px-4 pt-8 pb-4">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-start gap-4">
              <Avatar name={brandProfile.shopName} size="xl" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-xl font-bold">{brandProfile.shopName}</h1>
                  <Badge variant="pink" size="sm">עסק</Badge>
                </div>
                <p className="text-sm text-neutral-500 mb-3">{brandProfile.name}</p>
                {brandProfile.category && (
                  <Badge variant="default" size="sm">{brandProfile.category}</Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-6">
              {[
                { value: brandProfile.stats.products, label: "מוצרים" },
                { value: brandProfile.stats.connections, label: "חיבורים" },
                { value: brandProfile.stats.creditsLeft, label: "קרדיטים" },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-xl font-bold text-neutral-900">{stat.value}</div>
                  <div className="text-xs text-neutral-500">{stat.label}</div>
                </div>
              ))}
            </div>

            <Card padding="sm" className="mt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  🎫 {brandProfile.totalCredits - brandProfile.usedCredits} קרדיטים זמינים
                </span>
                <Button size="sm" variant="secondary">רכישת קרדיטים</Button>
              </div>
            </Card>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 mt-6 mb-4">
          <Button
            variant="ghost"
            fullWidth
            onClick={() => toast("הגדרות הפרופיל יהיו זמינות בקרוב", "info")}
          >
            ⚙️ הגדרות פרופיל
          </Button>
        </div>
      </main>
    );
  }

  const displayProfile = profile || mockCreatorProfile;
  const videoCount = displayProfile.stats.videos;
  const nextMilestone = getNextMilestone(videoCount);
  const milestones = getMilestones(videoCount);
  const progressPercent = Math.min(100, (videoCount / nextMilestone) * 100);

  return (
    <main className="min-h-screen bg-background">
      {/* Profile header */}
      <div className="bg-gradient-to-b from-pink-100 to-background px-4 pt-8 pb-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-start gap-4">
            <Avatar name={displayProfile.name} size="xl" />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-bold">{displayProfile.name}</h1>
                <Badge variant="pink" size="sm">
                  {displayProfile.level}
                </Badge>
              </div>
              <p className="text-sm text-neutral-500 mb-3">{displayProfile.bio}</p>
              <div className="flex items-center gap-1 flex-wrap">
                {displayProfile.categories.map((cat) => (
                  <Badge key={cat} variant="default" size="sm">
                    {cat}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            {[
              { value: displayProfile.stats.connections, label: "חיבורים" },
              { value: displayProfile.stats.videos, label: "סרטונים" },
              { value: displayProfile.stats.avgRating || "—", label: "דירוג" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-xl font-bold text-neutral-900">{stat.value}</div>
                <div className="text-xs text-neutral-500">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Hearts & Level progress */}
          <Card padding="sm" className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                💖 {displayProfile.hearts} לבבות
              </span>
              <span className="text-xs text-neutral-400">
                {videoCount}/{nextMilestone} סרטונים לרמה הבאה
              </span>
            </div>
            <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-l from-pink-500 to-pink-400 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 1, delay: 0.3 }}
              />
            </div>
          </Card>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-2xl mx-auto px-4">
        <div className="flex gap-1 bg-neutral-50 rounded-xl p-1 mt-4 mb-4">
          <button
            onClick={() => setActiveTab("videos")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "videos"
                ? "bg-white text-pink-500 shadow-sm"
                : "text-neutral-500"
            }`}
          >
            הסרטונים שלי
          </button>
          <button
            onClick={() => setActiveTab("badges")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "badges"
                ? "bg-white text-pink-500 shadow-sm"
                : "text-neutral-500"
            }`}
          >
            הישגים
          </button>
        </div>

        {activeTab === "videos" && (
          <div className="space-y-3">
            {videos.length === 0 ? (
              <div className="text-center py-12 text-neutral-400">
                <span className="text-4xl block mb-3">🎬</span>
                <p>עדיין אין סרטונים</p>
                <p className="text-xs mt-1">הסרטונים שתעלו יופיעו כאן</p>
              </div>
            ) : (
              videos.map((video) => (
                <Card key={video.id} hover padding="md">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-sm">{video.product}</h3>
                      <p className="text-xs text-neutral-400">{video.brand}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {video.views > 0 && (
                        <span className="text-xs text-neutral-400">
                          👁 {video.views.toLocaleString()}
                        </span>
                      )}
                      <Badge
                        variant={video.status === "approved" ? "success" : "warning"}
                        size="sm"
                      >
                        {video.status === "approved" ? "אושר" : "בבדיקה"}
                      </Badge>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {activeTab === "badges" && (
          <div className="grid grid-cols-2 gap-3">
            {milestones.map((m) => (
              <Card
                key={m.count}
                padding="md"
                className={m.achieved ? "" : "opacity-40"}
              >
                <div className="text-center">
                  <span className="text-3xl block mb-2">
                    {m.achieved ? "🏆" : "🔒"}
                  </span>
                  <p className="text-sm font-medium">{m.label}</p>
                  <p className="text-xs text-neutral-400 mt-1">
                    {m.achieved ? "הושלם!" : "בתהליך"}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Settings button */}
        <div className="mt-6 mb-4">
          <Button
            variant="ghost"
            fullWidth
            onClick={() => toast("הגדרות הפרופיל יהיו זמינות בקרוב", "info")}
          >
            ⚙️ הגדרות פרופיל
          </Button>
        </div>
      </div>
    </main>
  );
}
