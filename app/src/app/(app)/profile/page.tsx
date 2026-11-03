"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Avatar, Badge, Button, Card, Modal, Input, Textarea, useToast } from "@/components/ui";
import { FeedbackModal } from "@/components/features";
import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";
import { swrFetch, clearCache } from "@/lib/client-cache";
import { generateVideoThumbnail } from "@/lib/video-thumbnail";
import { uploadToStorage } from "@/lib/storage-upload";
import { videoFileProblem, MAX_VIDEO_MB } from "@/lib/uploads";

interface PortfolioVideo {
  id: string;
  title: string | null;
  description: string | null;
  url: string;
  thumbnail_url?: string | null;
  status: string;
  created_at: string;
}

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
  categories: string[];
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
  tiktok_followers: string;
  instagram_followers: string;
  date_of_birth: string;
  avatar_url: string;
}

interface BrandEditForm {
  full_name: string;
  shop_name: string;
  categories: string[];
  website_url: string;
  description: string;
  logo_url?: string;
}

const brandCategories = [
  "ביוטי וטיפוח", "אופנה", "מזון ומשקאות", "ניקיון ובית",
  "ילדים ותינוקות", "ספורט ובריאות", "טכנולוגיה", "חיות מחמד", "אחר",
];

const allCategories = [
  "ביוטי", "אופנה", "טכנולוגיה", "בית וגינה", "אוכל",
  "ספורט", "ילדים", "לייפסטייל", "נסיעות", "בריאות",
];

const levelLabels: Record<string, string> = {
  creator: "יוצרת",
  creator_plus: "יוצרת+",
  on_the_radar: "על הרדאר",
};

function brandCategoriesFrom(brandData: any): string[] {
  const arr = Array.isArray(brandData?.categories) ? (brandData.categories as string[]).filter(Boolean) : [];
  if (arr.length > 0) return arr;
  return brandData?.category ? [brandData.category as string] : [];
}

function LogoutConfirmModal({
  open,
  loading,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal open={open} onClose={onCancel} size="sm">
      <div className="text-center space-y-4">
        <span className="text-4xl block">🚪</span>
        <div>
          <h3 className="text-lg font-bold">להתנתק מהחשבון?</h3>
          <p className="text-sm text-neutral-500 mt-1">תוכלו להתחבר שוב בכל רגע עם קוד לווטסאפ.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="danger" fullWidth loading={loading} onClick={onConfirm}>
            כן, התנתקות
          </Button>
          <Button variant="ghost" fullWidth onClick={onCancel} disabled={loading}>
            ביטול
          </Button>
        </div>
      </div>
    </Modal>
  );
}

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
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const { toast } = useToast();

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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append("avatar", file);
      const res = await fetch("/api/profile/upload-avatar", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.url) {
        setForm((prev) => ({ ...prev, avatar_url: data.url }));
        toast("התמונה הועלתה!", "success");
      } else {
        toast(data.error || "שגיאה בהעלאה", "error");
      }
    } catch {
      toast("שגיאה בהעלאת התמונה", "error");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <Modal open={open} onClose={onClose} title="עריכת פרופיל" size="lg">
      <div className="space-y-4 max-h-[60vh] overflow-y-auto">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar src={form.avatar_url || null} name={form.full_name} size="xl" />
            <label className="absolute -bottom-1 -left-1 w-7 h-7 rounded-full bg-pink-500 text-white flex items-center justify-center cursor-pointer shadow-lg hover:bg-pink-600 transition-colors">
              {uploadingAvatar ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
            </label>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-neutral-700">תמונת פרופיל</p>
            <p className="text-xs text-neutral-400">לחצו על האייקון לשינוי</p>
          </div>
        </div>
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
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="עוקבים ב-TikTok"
            type="number"
            inputMode="numeric"
            min={0}
            value={form.tiktok_followers}
            onChange={(e) => setForm({ ...form, tiktok_followers: e.target.value })}
            placeholder="למשל 12000"
            dir="ltr"
          />
          <Input
            label="עוקבים ב-Instagram"
            type="number"
            inputMode="numeric"
            min={0}
            value={form.instagram_followers}
            onChange={(e) => setForm({ ...form, instagram_followers: e.target.value })}
            placeholder="למשל 8500"
            dir="ltr"
          />
        </div>
        <p className="text-xs text-neutral-400 -mt-2">העסקים רואים את הפרטים האלה כשהם בוחנים את הבקשה שלכם — כדאי למלא.</p>
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
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [customCategory, setCustomCategory] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setForm(initialData);
      setCustomCategory("");
    }
  }, [open, initialData]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const res = await fetch("/api/profile/upload-avatar", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok && data.url) {
        setForm((prev) => ({ ...prev, logo_url: data.url }));
        toast("הלוגו עודכן!", "success");
      } else {
        toast(data.error || "שגיאה בהעלאת הלוגו", "error");
      }
    } catch {
      toast("שגיאה בהעלאת הלוגו", "error");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  const isCategorySelected = (cat: string) => form.categories.includes(cat);
  const toggleCategory = (cat: string) =>
    setForm((prev) => ({
      ...prev,
      categories: prev.categories.includes(cat) ? prev.categories.filter((c) => c !== cat) : [...prev.categories, cat],
    }));
  const addCustomCategory = () => {
    const value = customCategory.trim();
    if (!value) return;
    if (!form.categories.includes(value)) setForm((prev) => ({ ...prev, categories: [...prev.categories, value] }));
    setCustomCategory("");
  };
  const customCategories = form.categories.filter((c) => !brandCategories.includes(c));

  return (
    <Modal open={open} onClose={onClose} title="עריכת פרופיל עסק" size="lg">
      <div className="space-y-4 max-h-[60vh] overflow-y-auto px-1">
        {/* Logo upload */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar src={form.logo_url} name={form.shop_name} size="xl" />
            <label className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-full cursor-pointer opacity-0 hover:opacity-100 transition-opacity">
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              {uploadingLogo ? (
                <span className="text-white text-xs">מעלה...</span>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              )}
            </label>
          </div>
          <div className="text-sm text-neutral-500">
            <p className="font-medium text-neutral-700">לוגו העסק</p>
            <p className="text-xs">לחצו על התמונה לעדכון</p>
          </div>
        </div>

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

        {/* Category chips */}
        <div>
          <label className="block text-sm font-medium mb-1">קטגוריות</label>
          <p className="text-xs text-neutral-400 mb-2">אפשר לבחור כמה קטגוריות — המוצרים שלכם יופיעו ליוצרים בכל אחת מהן</p>
          <div className="flex flex-wrap gap-2 mb-2">
            {brandCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => toggleCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                  isCategorySelected(cat)
                    ? "bg-pink-500 text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-pink-50 hover:text-pink-600"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              placeholder="או הקלידו קטגוריה חופשית..."
              className="flex-1 px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:border-pink-300 outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && customCategory.trim()) {
                  e.preventDefault();
                  addCustomCategory();
                }
              }}
            />
            {customCategory.trim() && (
              <button
                type="button"
                onClick={addCustomCategory}
                className="px-3 py-2 rounded-xl bg-pink-500 text-white text-sm"
              >
                הוסף
              </button>
            )}
          </div>
          {customCategories.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {customCategories.map((cat) => (
                <span key={cat} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm bg-pink-500 text-white">
                  {cat}
                  <button type="button" onClick={() => toggleCategory(cat)} className="mr-1 hover:opacity-70" aria-label={`הסרת ${cat}`}>×</button>
                </span>
              ))}
            </div>
          )}
        </div>

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
  const [videos, setVideos] = useState<{id: string; product: string; brand: string; status: string; views: number}[]>([]);
  const [portfolioVideos, setPortfolioVideos] = useState<PortfolioVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PortfolioVideo | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const { user, loading: authLoading, signOut } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [creatorEditData, setCreatorEditData] = useState<CreatorEditForm>({
    full_name: "",
    bio: "",
    categories: [],
    city: "",
    tiktok_handle: "",
    instagram_handle: "",
    tiktok_followers: "",
    instagram_followers: "",
    date_of_birth: "",
    avatar_url: "",
  });

  const [brandEditData, setBrandEditData] = useState<BrandEditForm>({
    full_name: "",
    shop_name: "",
    categories: [],
    website_url: "",
    description: "",
  });
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  useEffect(() => {
    async function fetchProfile() {
      if (authLoading) return;
      if (!user) {
        setLoading(false);
        return;
      }

      const applyProfile = (payload: { user?: any; profile?: any }) => {
        const userData = payload.user;
        const profileData = payload.profile;
        if (!userData) return;

        if (userData.type === "creator" || userData.type === "admin") {
          const creatorData = profileData as any;
          setProfile({
            name: userData.full_name,
            level: levelLabels[creatorData?.level] || creatorData?.level || "creator",
            hearts: creatorData?.hearts || 0,
            completedConnections: creatorData?.completed_connections || 0,
            categories: creatorData?.categories || [],
            bio: creatorData?.bio || "",
            stats: {
              connections: creatorData?.completed_connections || 0,
              videos: creatorData?.completed_connections || 0,
              avgRating: 0,
            },
          });
          setAvatarUrl(userData.avatar_url || null);
          setCreatorEditData({
            full_name: userData.full_name,
            bio: creatorData?.bio || "",
            categories: creatorData?.categories || [],
            city: creatorData?.city || "",
            tiktok_handle: creatorData?.tiktok_handle || "",
            instagram_handle: creatorData?.instagram_handle || "",
            tiktok_followers: creatorData?.tiktok_followers ? String(creatorData.tiktok_followers) : "",
            instagram_followers: creatorData?.instagram_followers ? String(creatorData.instagram_followers) : "",
            date_of_birth: creatorData?.date_of_birth || "",
            avatar_url: userData.avatar_url || "",
          });
          setUserType("creator");
        } else if (userData.type === "brand") {
          const brandData = profileData as any;
          setBrandProfile({
            name: userData.full_name,
            shopName: brandData?.shop_name || "",
            totalCredits: brandData?.total_credits || 0,
            usedCredits: brandData?.used_credits || 0,
            categories: brandCategoriesFrom(brandData),
            description: brandData?.description || "",
            websiteUrl: brandData?.website_url || "",
            stats: {
              products: 0,
              connections: 0,
              creditsLeft: (brandData?.total_credits || 0) - (brandData?.used_credits || 0),
            },
          });
          setBrandEditData({
            full_name: userData.full_name,
            shop_name: brandData?.shop_name || "",
            categories: brandCategoriesFrom(brandData),
            website_url: brandData?.website_url || "",
            description: brandData?.description || "",
            logo_url: brandData?.logo_url || "",
          });
          setUserType("brand");
        }
        setLoading(false);
      };

      try {
        await swrFetch("/api/profile", applyProfile);
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, [user, authLoading]);

  useEffect(() => {
    if (userType === "creator") {
      swrFetch<{ videos?: PortfolioVideo[] }>("/api/videos?portfolio=me", (data) => setPortfolioVideos(data.videos || []));
    }
  }, [userType]);

  // Right after registration (/profile?onboarding=1) a creator lands on the first upload
  useEffect(() => {
    if (userType !== "creator" || typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("onboarding") !== "1") return;
    const timer = setTimeout(() => {
      setShowUploadModal(true);
      window.history.replaceState(null, "", "/profile");
    }, 300);
    return () => clearTimeout(timer);
  }, [userType]);

  const handleUploadVideo = async () => {
    if (!selectedFile) {
      toast("בחרו קובץ וידאו", "error");
      return;
    }
    const problem = videoFileProblem(selectedFile);
    if (problem) {
      toast(problem, "error");
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    try {
      const supabase = createClient();
      const ext = (selectedFile.name.split(".").pop() || "mp4").toLowerCase();
      const stamp = Date.now();
      const fileName = `portfolio/${user!.id}/${stamp}.${ext}`;
      const thumbPath = `portfolio/${user!.id}/${stamp}.jpg`;

      // Upload the video (with progress) and grab a poster frame in the browser at the same time
      const [uploadResult, thumbBlob] = await Promise.all([
        uploadToStorage({
          bucket: "videos",
          path: fileName,
          file: selectedFile,
          contentType: selectedFile.type || "video/mp4",
          onProgress: setUploadProgress,
        }),
        generateVideoThumbnail(selectedFile),
      ]);

      if (!uploadResult.ok) {
        toast(uploadResult.error, "error");
        return;
      }

      let thumbnailPath: string | null = null;
      if (thumbBlob) {
        const { error: thumbError } = await supabase.storage
          .from("thumbnails")
          .upload(thumbPath, thumbBlob, { contentType: "image/jpeg", upsert: true });
        if (!thumbError) thumbnailPath = thumbPath;
      }

      const res = await fetch("/api/videos/save-portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storagePath: fileName,
          title: uploadTitle.trim() || null,
          thumbnailPath,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast("הסרטון הועלה בהצלחה!", "success");
        setPortfolioVideos((prev) => [data.video, ...prev]);
        setShowUploadModal(false);
        setSelectedFile(null);
        setUploadTitle("");
      } else {
        const err = await res.json().catch(() => ({}));
        toast((err as any).error || "שגיאה בשמירת הסרטון", "error");
      }
    } catch {
      toast("שגיאה בהעלאת הסרטון", "error");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const handleDeleteVideo = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/videos/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        setPortfolioVideos((prev) => prev.filter((v) => v.id !== deleteTarget.id));
        // The portfolio count feeds the 5-video gate elsewhere; don't let stale copies linger
        clearCache("/api/videos?portfolio=me");
        clearCache("/api/profile");
        toast("הסרטון נמחק", "success");
        setDeleteTarget(null);
      } else {
        const err = await res.json().catch(() => ({}));
        toast((err as any).error || "שגיאה במחיקת הסרטון", "error");
      }
    } catch {
      toast("שגיאה במחיקת הסרטון", "error");
    } finally {
      setDeleting(false);
    }
  };

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
            tiktok_followers: Math.max(0, parseInt(data.tiktok_followers, 10) || 0),
            instagram_followers: Math.max(0, parseInt(data.instagram_followers, 10) || 0),
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
        setAvatarUrl(data.avatar_url || avatarUrl);
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
            categories: data.categories,
            category: data.categories[0] || "",
            website_url: data.website_url,
            description: data.description,
            ...(data.logo_url ? { logo_url: data.logo_url } : {}),
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
                categories: data.categories,
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
              <Avatar src={brandEditData.logo_url} name={brandProfile.shopName} size="xl" expandable />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-xl font-bold">{brandProfile.shopName}</h1>
                  <Badge variant="pink" size="sm">עסק</Badge>
                </div>
                <p className="text-sm text-neutral-500 mb-3">{brandProfile.name}</p>
                {brandProfile.categories.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    {brandProfile.categories.map((cat) => (
                      <Badge key={cat} variant="default" size="sm">{cat}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-6">
              {[
                { value: brandProfile.stats.products, label: "מוצרים" },
                { value: brandProfile.stats.connections, label: "חיבורים" },
                { value: brandProfile.stats.creditsLeft, label: "סרטונים נותרים" },
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
                  🎬 {brandProfile.totalCredits - brandProfile.usedCredits} סרטונים נותרים
                </span>
                <Button size="sm" variant="secondary">רכישת סרטונים</Button>
              </div>
            </Card>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 mt-6 space-y-3">
          <Button variant="ghost" fullWidth onClick={() => setEditOpen(true)}>
            ✏️ עריכת פרופיל
          </Button>
          <Button variant="ghost" fullWidth onClick={() => setFeedbackOpen(true)}>
            📨 צור קשר / דיווח על תקלה
          </Button>
          <Button
            variant="ghost"
            fullWidth
            onClick={() => setLogoutConfirmOpen(true)}
            loading={loggingOut}
            className="text-red-500 hover:text-red-600 hover:bg-red-50"
          >
            🚪 התנתקות
          </Button>
        </div>

        <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
        <BrandEditModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          initialData={brandEditData}
          onSave={handleBrandSave}
        />
        <LogoutConfirmModal
          open={logoutConfirmOpen}
          loading={loggingOut}
          onCancel={() => setLogoutConfirmOpen(false)}
          onConfirm={handleLogout}
        />
      </main>
    );
  }

  if (!profile && !brandProfile) {
    return (
      <main className="min-h-screen bg-background pb-24">
        <div className="text-center py-20 text-neutral-400">
          <span className="text-4xl block mb-3">👤</span>
          <p>לא נמצא פרופיל</p>
          <p className="text-xs mt-1">יש להתחבר כדי לצפות בפרופיל</p>
        </div>
      </main>
    );
  }

  const displayProfile = profile!;
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
            <Avatar src={avatarUrl} name={displayProfile.name} size="xl" expandable />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-bold">{displayProfile.name}</h1>
                <Badge variant="pink" size="sm">
                  {displayProfile.level}
                </Badge>
              </div>
              <p className="text-sm text-neutral-500 mb-2">{displayProfile.bio}</p>
              {(creatorEditData.city || creatorEditData.tiktok_handle || creatorEditData.instagram_handle) && (
                <div className="flex items-center gap-3 text-xs text-neutral-500 mb-2 flex-wrap">
                  {creatorEditData.city && <span>📍 {creatorEditData.city}</span>}
                  {creatorEditData.tiktok_handle && (
                    <span dir="ltr">
                      TT @{creatorEditData.tiktok_handle.replace(/^@/, "")}
                      {creatorEditData.tiktok_followers && ` · ${Number(creatorEditData.tiktok_followers).toLocaleString("he-IL")}`}
                    </span>
                  )}
                  {creatorEditData.instagram_handle && (
                    <span dir="ltr">
                      IG @{creatorEditData.instagram_handle.replace(/^@/, "")}
                      {creatorEditData.instagram_followers && ` · ${Number(creatorEditData.instagram_followers).toLocaleString("he-IL")}`}
                    </span>
                  )}
                </div>
              )}
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

      {portfolioVideos.length < 5 && (
        <div className="max-w-2xl mx-auto px-4 mt-4">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="flex items-center justify-between gap-3 mb-2">
              <p className="text-sm font-bold text-amber-800">🎬 תיק העבודות: {portfolioVideos.length}/5</p>
              <Button size="sm" onClick={() => setShowUploadModal(true)}>העלאת סרטון</Button>
            </div>
            <div className="h-2 bg-amber-100 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${Math.min(100, (portfolioVideos.length / 5) * 100)}%` }} />
            </div>
            <p className="text-xs text-amber-700 mt-2">
              כדי לסמן לב למוצרים ולאשר שיתופי פעולה צריך לפחות 5 סרטונים בתיק. עסקים כבר רואים אותך ויכולים לסמן אותך בינתיים.
            </p>
          </div>
        </div>
      )}

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
            <Button size="sm" onClick={() => setShowUploadModal(true)} className="w-full">
              + העלאת סרטון לפורטפוליו
            </Button>
            {portfolioVideos.length === 0 && videos.length === 0 ? (
              <div className="text-center py-12 text-neutral-400">
                <span className="text-4xl block mb-3">🎬</span>
                <p>עדיין אין סרטונים</p>
                <p className="text-xs mt-1">העלו סרטון לפורטפוליו שלכם כדי שמותגים יראו אתכם</p>
              </div>
            ) : (
              <>
                {portfolioVideos.map((video) => (
                  <Card key={video.id} hover padding="md">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-sm truncate">{video.title || "סרטון פורטפוליו"}</h3>
                        <p className="text-xs text-neutral-400">
                          {new Date(video.created_at).toLocaleDateString("he-IL")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {video.status === "rejected" && (
                          <Badge variant="danger" size="sm">נדחה</Badge>
                        )}
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(video)}
                          className="text-xs text-neutral-400 hover:text-red-500 px-2 py-1 rounded-lg transition-colors"
                          aria-label="מחיקת סרטון"
                          title="מחיקת סרטון"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    {video.url && video.status !== "rejected" && (
                      <video
                        src={video.thumbnail_url ? video.url : `${video.url}#t=0.1`}
                        poster={video.thumbnail_url || undefined}
                        className="mt-2 w-full rounded-lg max-h-48 object-cover"
                        controls
                        preload={video.thumbnail_url ? "none" : "metadata"}
                        controlsList="nodownload"
                        onContextMenu={(e) => e.preventDefault()}
                      />
                    )}
                  </Card>
                ))}
                {videos.map((video) => (
                  <Card key={video.id} hover padding="md">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-sm">{video.product}</h3>
                        <p className="text-xs text-neutral-400">{video.brand}</p>
                      </div>
                      <Badge
                        variant={video.status === "approved" ? "success" : "warning"}
                        size="sm"
                      >
                        {video.status === "approved" ? "אושר" : "בבדיקה"}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </>
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
          <Button variant="ghost" fullWidth onClick={() => setFeedbackOpen(true)}>
            📨 צור קשר / דיווח על תקלה
          </Button>
          <Button
            variant="ghost"
            fullWidth
            onClick={() => setLogoutConfirmOpen(true)}
            loading={loggingOut}
            className="text-red-500 hover:text-red-600 hover:bg-red-50"
          >
            🚪 התנתקות
          </Button>
        </div>
      </div>

      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      <CreatorEditModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        initialData={creatorEditData}
        onSave={handleCreatorSave}
      />
      <LogoutConfirmModal
        open={logoutConfirmOpen}
        loading={loggingOut}
        onCancel={() => setLogoutConfirmOpen(false)}
        onConfirm={handleLogout}
      />

      <Modal
        open={showUploadModal}
        onClose={() => { setShowUploadModal(false); setSelectedFile(null); setUploadTitle(""); }}
        title="העלאת סרטון לפורטפוליו"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">כותרת (אופציונלי)</label>
            <Input
              placeholder="למשל: סרטון ביוטי — שפתון חדש"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">קובץ וידאו *</label>
            <input
              type="file"
              accept="video/mp4,video/quicktime,video/webm,video/*"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                const issue = file ? videoFileProblem(file) : null;
                if (issue) {
                  toast(issue, "error");
                  e.target.value = "";
                  setSelectedFile(null);
                  return;
                }
                setSelectedFile(file);
              }}
              className="w-full text-sm text-neutral-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-pink-50 file:text-pink-500 hover:file:bg-pink-100 transition-all"
            />
            <p className="text-xs text-neutral-400 mt-1">עד {MAX_VIDEO_MB}MB · MP4, MOV או WebM</p>
            {selectedFile && (
              <p className="text-xs text-neutral-400 mt-1">
                {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(1)} MB)
              </p>
            )}
          </div>
          {uploading && uploadProgress !== null && (
            <div className="space-y-1" aria-live="polite">
              <div className="flex justify-between text-xs text-neutral-500">
                <span>{uploadProgress < 100 ? "מעלה את הסרטון..." : "שומר..."}</span>
                <span dir="ltr">{uploadProgress}%</span>
              </div>
              <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                <div className="h-full bg-pink-500 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <Button fullWidth loading={uploading} onClick={handleUploadVideo}>
              {uploading && uploadProgress !== null && uploadProgress < 100 ? `מעלה ${uploadProgress}%` : uploading ? "שומר..." : "העלאה"}
            </Button>
            <Button variant="ghost" fullWidth onClick={() => { setShowUploadModal(false); setSelectedFile(null); setUploadTitle(""); }}>
              ביטול
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="מחיקת סרטון"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">
            למחוק את &quot;{deleteTarget?.title || "סרטון פורטפוליו"}&quot;? הפעולה לא ניתנת לביטול.
          </p>
          {portfolioVideos.length <= 5 && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-xl p-3">
              שימו לב: עם פחות מ-5 סרטונים בתיק העבודות לא ניתן לסמן לב או לאשר חיבורים חדשים.
            </p>
          )}
          <div className="flex gap-3">
            <Button variant="danger" fullWidth loading={deleting} onClick={handleDeleteVideo}>
              מחיקה
            </Button>
            <Button variant="ghost" fullWidth onClick={() => setDeleteTarget(null)}>
              ביטול
            </Button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
