import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGreenAPI } from "@/lib/adapters/greenapi";

function getSupabaseAdmin() {
  const url = process.env.NEXT_SUPABASE_URL;
  const key = process.env.SUPABASE_SEC_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function formatPhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-()]/g, "");
  if (cleaned.startsWith("+")) cleaned = cleaned.slice(1);
  if (cleaned.startsWith("0")) cleaned = `972${cleaned.slice(1)}`;
  if (!cleaned.startsWith("972")) cleaned = `972${cleaned}`;
  return `+${cleaned}`;
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

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (authError || !authUser?.user) {
      console.error("[register] getUserById error:", authError);
      return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });
    }

    // Use phone from auth user, fallback to profile phone
    let phone = authUser.user.phone || "";
    if (!phone && profile.phone) {
      phone = formatPhone(profile.phone);
    }

    if (!phone) {
      return NextResponse.json({ error: "מספר טלפון חסר" }, { status: 400 });
    }

    // Try insert first, if auth_user_id already exists, update that row instead
    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("auth_user_id", userId)
      .maybeSingle();

    let dbUserId: string;

    if (existingUser) {
      // Update existing row
      const { data: updatedUser, error: updateError } = await supabaseAdmin
        .from("users")
        .update({
          type: userType,
          phone,
          full_name: profile.fullName || "",
          email: profile.email || authUser.user.email || null,
          is_active: true,
          onboarding_completed: true,
        })
        .eq("id", existingUser.id)
        .select("id")
        .single();

      if (updateError || !updatedUser) {
        console.error("[register] user update error:", updateError);
        return NextResponse.json({ error: `שגיאה בעדכון חשבון: ${updateError?.message || "unknown"}` }, { status: 500 });
      }
      dbUserId = updatedUser.id;
    } else {
      // Insert new row
      const { data: insertedUser, error: insertError } = await supabaseAdmin
        .from("users")
        .insert({
          auth_user_id: userId,
          type: userType,
          phone,
          full_name: profile.fullName || "",
          email: profile.email || authUser.user.email || null,
          is_active: true,
          onboarding_completed: true,
        })
        .select("id")
        .single();

      if (insertError || !insertedUser) {
        console.error("[register] user insert error:", insertError);
        return NextResponse.json({ error: `שגיאה ביצירת חשבון: ${insertError?.message || "unknown"}` }, { status: 500 });
      }
      dbUserId = insertedUser.id;
    }

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
          { error: `שגיאה ביצירת פרופיל: ${profileError.message}` },
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
          { error: `שגיאה ביצירת פרופיל עסקי: ${profileError.message}` },
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
