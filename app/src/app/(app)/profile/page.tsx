"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Avatar, Badge, Button, Card, Modal, Input, Textarea, useToast } from "@/components/ui";
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
  description: string;
  websiteUrl: string;
  stats: { products: number; connections: number; creditsLeft: number };
}

interface CreatorEditForm {
  full_name: string;
  bio: string;
  categories: string[];
  city: string;
  tiktok_handle: string;
  instagram_handle: string;
  date_of_birth: string;
}

interface BrandEditForm {
  full_name: string;
  shop_name: string;
  category: string;
  website_url: string;
  description: string;
}

const allCategories = [
  "ביוטי", "אופנה", "טכנולוגיה", "בית וגינה", "אוכל",
  "ספורט", "ילדים", "לייפסטייל", "נסיעות", "בריאות",
];

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
  return targets.find((t) => t > videoCount) || 100;
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

function CreatorEditModal({
  open,
  onClose,
  initialData,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  initialData: CreatorEditForm;
  onSave: (data: CreatorEditForm) => Promise<void>;
}) {
  const [form, setForm] = useState<CreatorEditForm>(initialData);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(initialData);
  }, [open, initialData]);

  const toggleCategory = (cat: string) => {
    setForm((prev) => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter((c) => c !== cat)
        : [...prev.categories, cat],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <Modal open={open} onClose={onClose} title="עריכת פרופיל" size="lg">
      <div className="space-y-4 max-h-[60vh] overflow-y-auto">
        <Input
          label="שם מלא"
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
        />
        <Textarea
          label="ביו"
          value={form.bio}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
          placeholder="ספרו על עצמכם..."
        />
        <div>
          <label className="block text-sm font-medium mb-2 text-neutral-700">קטגוריות</label>
          <div className="flex flex-wrap gap-2">
            {allCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => toggleCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  form.categories.includes(cat)
                    ? "bg-pink-500 text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
        <Input
          label="עיר"
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
          placeholder="תל אביב"
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="TikTok"
            value={form.tiktok_handle}
            onChange={(e) => setForm({ ...form, tiktok_handle: e.target.value })}
            placeholder="@username"
            dir="ltr"
          />
          <Input
            label="Instagram"
            value={form.instagram_handle}
            onChange={(e) => setForm({ ...form, instagram_handle: e.target.value })}
            placeholder="@username"
            dir="ltr"
          />
        </div>
        <Input
          label="תאריך לידה"
          type="date"
          value={form.date_of_birth}
          onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
          dir="ltr"
        />
      </div>
      <div className="flex gap-3 mt-6">
        <Button fullWidth loading={saving} onClick={handleSave}>
          שמירה
        </Button>
        <Button variant="ghost" fullWidth onClick={onClose}>
          ביטול
        </Button>
      </div>
    </Modal>
  );
}

function BrandEditModal({
  open,
  onClose,
  initialData,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  initialData: BrandEditForm;
  onSave: (data: BrandEditForm) => Promise<void>;
}) {
  const [form, setForm] = useState<BrandEditForm>(initialData);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(initialData);
  }, [open, initialData]);

  const handleSave = async () => {
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <Modal open={open} onClose={onClose} title="עריכת פרופיל עסק" size="lg">
      <div className="space-y-4 max-h-[60vh] overflow-y-auto">
        <Input
          label="שם איש קשר"
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
        />
        <Input
          label="שם העסק"
          value={form.shop_name}
          onChange={(e) => setForm({ ...form, shop_name: e.target.value })}
        />
        <Input
          label="קטגוריה"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          placeholder="אופנה, ביוטי, טכנולוגיה..."
        />
        <Input
          label="אתר אינטרנט"
          value={form.website_url}
          onChange={(e) => setForm({ ...form, website_url: e.target.value })}
          placeholder="https://example.com"
          dir="ltr"
        />
        <Textarea
          label="תיאור העסק"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="ספרו על העסק שלכם..."
        />
      </div>
      <div className="flex gap-3 mt-6">
        <Button fullWidth loading={saving} onClick={handleSave}>
          שמירה
        </Button>
        <Button variant="ghost" fullWidth onClick={onClose}>
          ביטול
        </Button>
      </div>
    </Modal>
  );
}

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<"videos" | "badges">("videos");
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [brandProfile, setBrandProfile] = useState<BrandProfile | null>(null);
  const [userType, setUserType] = useState<"creator" | "brand" | null>(null);
  const [videos, setVideos] = useState(mockVideos);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [creatorEditData, setCreatorEditData] = useState<CreatorEditForm>({
    full_name: "",
    bio: "",
    categories: [],
    city: "",
    tiktok_handle: "",
    instagram_handle: "",
    date_of_birth: "",
  });

  const [brandEditData, setBrandEditData] = useState<BrandEditForm>({
    full_name: "",
    shop_name: "",
    category: "",
    website_url: "",
    description: "",
  });

  useEffect(() => {
    async function fetchProfile() {
      if (!user) {
        setProfile(mockCreatorProfile);
        setUserType("creator");
        setCreatorEditData({
          full_name: mockCreatorProfile.name,
          bio: mockCreatorProfile.bio,
          categories: mockCreatorProfile.categories,
          city: "תל אביב",
          tiktok_handle: "",
          instagram_handle: "",
          date_of_birth: "",
        });
        setLoading(false);
        return;
      }

      try {
        const supabase = createClient();

        const { data: rawUser } = await supabase
          .from("users")
          .select("*")
          .eq("auth_user_id", user.id)
          .single();
        const userData = rawUser as any;

        if (!userData) {
          setProfile(mockCreatorProfile);
          setUserType("creator");
          setLoading(false);
          return;
        }

        if (userData.type === "creator") {
          const { data: rawCreator } = await supabase
            .from("creator_profiles")
            .select("*")
            .eq("user_id", userData.id)
            .single();
          const creatorData = rawCreator as any;

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
            setCreatorEditData({
              full_name: userData.full_name,
              bio: creatorData.bio || "",
              categories: creatorData.categories || [],
              city: creatorData.city || "",
              tiktok_handle: creatorData.tiktok_handle || "",
              instagram_handle: creatorData.instagram_handle || "",
              date_of_birth: creatorData.date_of_birth || "",
            });
            setUserType("creator");
          } else {
            setProfile(mockCreatorProfile);
            setUserType("creator");
          }
        } else if (userData.type === "brand") {
          const { data: rawBrand } = await supabase
            .from("brand_profiles")
            .select("*")
            .eq("user_id", userData.id)
            .single();
          const brandData = rawBrand as any;

          if (brandData) {
            setBrandProfile({
              name: userData.full_name,
              shopName: brandData.shop_name,
              totalCredits: brandData.total_credits,
              usedCredits: brandData.used_credits,
              category: brandData.category || "",
              description: brandData.description || "",
              websiteUrl: brandData.website_url || "",
              stats: {
                products: 0,
                connections: 0,
                creditsLeft: brandData.total_credits - brandData.used_credits,
              },
            });
            setBrandEditData({
              full_name: userData.full_name,
              shop_name: brandData.shop_name,
              category: brandData.category || "",
              website_url: brandData.website_url || "",
              description: brandData.description || "",
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

  const handleCreatorSave = async (data: CreatorEditForm) => {
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userFields: { full_name: data.full_name },
          profileFields: {
            bio: data.bio,
            categories: data.categories,
            city: data.city,
            tiktok_handle: data.tiktok_handle,
            instagram_handle: data.instagram_handle,
            date_of_birth: data.date_of_birth || null,
          },
        }),
      });

      if (res.ok) {
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                name: data.full_name,
                bio: data.bio,
                categories: data.categories,
              }
            : prev
        );
        setCreatorEditData(data);
        toast("הפרופיל עודכן בהצלחה!", "success");
        setEditOpen(false);
      } else {
        toast("שגיאה בעדכון הפרופיל", "error");
      }
    } catch {
      toast("שגיאה בעדכון הפרופיל", "error");
    }
  };

  const handleBrandSave = async (data: BrandEditForm) => {
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userFields: { full_name: data.full_name },
          profileFields: {
            shop_name: data.shop_name,
            category: data.category,
            website_url: data.website_url,
            description: data.description,
          },
        }),
      });

      if (res.ok) {
        setBrandProfile((prev) =>
          prev
            ? {
                ...prev,
                name: data.full_name,
                shopName: data.shop_name,
                category: data.category,
                description: data.description,
                websiteUrl: data.website_url,
              }
            : prev
        );
        setBrandEditData(data);
        toast("הפרופיל עודכן בהצלחה!", "success");
        setEditOpen(false);
      } else {
        toast("שגיאה בעדכון הפרופיל", "error");
      }
    } catch {
      toast("שגיאה בעדכון הפרופיל", "error");
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
      router.push("/login");
    } catch {
      toast("שגיאה בהתנתקות", "error");
      setLoggingOut(false);
    }
  };

  if (loading) return <ProfileSkeleton />;

  if (userType === "brand" && brandProfile) {
    return (
      <main className="min-h-screen bg-background pb-24">
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

        <div className="max-w-2xl mx-auto px-4 mt-6 space-y-3">
          <Button variant="ghost" fullWidth onClick={() => setEditOpen(true)}>
            ✏️ עריכת פרופיל
          </Button>
          <Button
            variant="ghost"
            fullWidth
            onClick={handleLogout}
            loading={loggingOut}
            className="text-red-500 hover:text-red-600 hover:bg-red-50"
          >
            🚪 התנתקות
          </Button>
        </div>

        <BrandEditModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          initialData={brandEditData}
          onSave={handleBrandSave}
        />
      </main>
    );
  }

  const displayProfile = profile || mockCreatorProfile;
  const videoCount = displayProfile.stats.videos;
  const nextMilestone = getNextMilestone(videoCount);
  const milestones = getMilestones(videoCount);
  const progressPercent = Math.min(100, (videoCount / nextMilestone) * 100);

  return (
    <main className="min-h-screen bg-background pb-24">
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

        {/* Profile actions */}
        <div className="mt-6 mb-4 space-y-3">
          <Button variant="ghost" fullWidth onClick={() => setEditOpen(true)}>
            ✏️ עריכת פרופיל
          </Button>
          <Button
            variant="ghost"
            fullWidth
            onClick={handleLogout}
            loading={loggingOut}
            className="text-red-500 hover:text-red-600 hover:bg-red-50"
          >
            🚪 התנתקות
          </Button>
        </div>
      </div>

      <CreatorEditModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        initialData={creatorEditData}
        onSave={handleCreatorSave}
      />
    </main>
  );
}
