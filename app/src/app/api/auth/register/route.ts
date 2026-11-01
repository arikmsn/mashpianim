import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGreenAPI } from "@/lib/adapters/greenapi";

function getSupabaseAdmin() {
  const url = process.env.NEXT_SUPABASE_URL;
  const key = process.env.SUPABASE_SEC_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const body = await request.json();
    const { userId, userType, profile } = body;

    if (!userId || !userType) {
      return NextResponse.json({ error: "פרטים חסרים" }, { status: 400 });
    }

    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (!authUser?.user) {
      return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });
    }

    const phone = authUser.user.phone || "";

    // Create user record — use (phone, type) unique constraint for upsert
    const { data: insertedUser, error: userError } = await supabaseAdmin.from("users").upsert(
      {
        auth_user_id: userId,
        type: userType,
        phone,
        full_name: profile.fullName || "",
        email: profile.email || authUser.user.email || null,
        is_active: true,
        onboarding_completed: true,
      },
      { onConflict: "phone,type" }
    ).select("id").single();

    if (userError || !insertedUser) {
      console.error("[register] user insert error:", userError);
      return NextResponse.json({ error: "שגיאה ביצירת חשבון" }, { status: 500 });
    }

    const dbUserId = insertedUser.id;

    // Create profile based on type
    if (userType === "creator") {
      const { error: profileError } = await supabaseAdmin
        .from("creator_profiles")
        .upsert(
          {
            user_id: dbUserId,
            bio: profile.bio || null,
            tiktok_handle: profile.tiktokHandle || null,
            tiktok_followers: profile.tiktokFollowers || 0,
            instagram_handle: profile.instagramHandle || null,
            instagram_followers: profile.instagramFollowers || 0,
            categories: profile.categories || [],
            level: "creator",
            city: profile.city || null,
            date_of_birth: profile.dateOfBirth || null,
            intro_video_url: profile.introVideoUrl || null,
          },
          { onConflict: "user_id" }
        );

      if (profileError) {
        console.error("[register] creator profile error:", profileError);
        return NextResponse.json(
          { error: "שגיאה ביצירת פרופיל" },
          { status: 500 }
        );
      }
    } else if (userType === "brand") {
      const { error: profileError } = await supabaseAdmin
        .from("brand_profiles")
        .upsert(
          {
            user_id: dbUserId,
            shop_name: profile.shopName || "",
            category: profile.category || "",
            website_url: profile.websiteUrl || null,
            description: profile.description || null,
            logo_url: profile.logoUrl || null,
          },
          { onConflict: "user_id" }
        );

      if (profileError) {
        console.error("[register] brand profile error:", profileError);
        return NextResponse.json(
          { error: "שגיאה ביצירת פרופיל עסקי" },
          { status: 500 }
        );
      }
    }

    // Send welcome message via WhatsApp (non-blocking)
    const greenAPI = getGreenAPI();
    if (greenAPI && phone) {
      const name = profile.fullName || "";
      if (userType === "creator") {
        greenAPI.sendWelcomeCreator(phone, name).catch((err) =>
          console.error("[register] welcome message error:", err)
        );
      } else if (userType === "brand") {
        greenAPI.sendWelcomeBrand(phone, name, profile.shopName || "").catch((err) =>
          console.error("[register] welcome message error:", err)
        );
      }
    }

    return NextResponse.json({ success: true, userType });
  } catch (err) {
    console.error("[register] error:", err);
    return NextResponse.json({ error: "שגיאה בהרשמה" }, { status: 500 });
  }
}
