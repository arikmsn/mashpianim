import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, userType, profile } = body;

    if (!userId || !userType) {
      return NextResponse.json({ error: "פרטים חסרים" }, { status: 400 });
    }

    // Get the auth user's phone
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (!authUser?.user) {
      return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });
    }

    const phone = authUser.user.phone || "";

    // Create user record
    const { error: userError } = await supabaseAdmin.from("users").upsert(
      {
        id: userId,
        type: userType,
        phone,
        full_name: profile.fullName || "",
        email: profile.email || authUser.user.email || null,
        is_active: true,
        onboarding_completed: true,
      },
      { onConflict: "id" }
    );

    if (userError) {
      console.error("[register] user insert error:", userError);
      return NextResponse.json({ error: "שגיאה ביצירת חשבון" }, { status: 500 });
    }

    // Create profile based on type
    if (userType === "creator") {
      const { error: profileError } = await supabaseAdmin
        .from("creator_profiles")
        .upsert(
          {
            user_id: userId,
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
            user_id: userId,
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

    return NextResponse.json({ success: true, userType });
  } catch (err) {
    console.error("[register] error:", err);
    return NextResponse.json({ error: "שגיאה בהרשמה" }, { status: 500 });
  }
}
