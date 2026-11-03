import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getGreenAPI } from "@/lib/adapters/greenapi";
import { isAllowedRegistrationType } from "@/lib/authz";
import { checkRateLimit, rateLimitedResponse, clientIp, RATE_LIMITS } from "@/lib/rate-limit";

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
    const { userId: requestedUserId, userType } = body;
    const profile: Record<string, any> = body.profile && typeof body.profile === "object" ? body.profile : {};

    // 10 registrations per IP per hour (SEC-07)
    const limit = await checkRateLimit(supabaseAdmin, "register:ip", clientIp(request.headers), RATE_LIMITS.registerIp);
    if (!limit.allowed) return rateLimitedResponse(limit);

    if (!userType) {
      return NextResponse.json({ error: "פרטים חסרים" }, { status: 400 });
    }
    if (!isAllowedRegistrationType(userType)) {
      return NextResponse.json({ error: "סוג משתמש לא תקין" }, { status: 400 });
    }

    // Identity comes from the session, never from the request body
    const userClient = await createServerClient();
    const { data: { user: sessionUser } } = await userClient.auth.getUser();
    if (!sessionUser) {
      return NextResponse.json({ error: "לא מחובר — אמתו את הטלפון ונסו שוב" }, { status: 401 });
    }
    if (requestedUserId && requestedUserId !== sessionUser.id) {
      return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
    }
    const userId = sessionUser.id;

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (authError || !authUser?.user) {
      console.error("[register] getUserById error:", authError);
      return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });
    }

    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("id, type, phone")
      .eq("auth_user_id", userId)
      .maybeSingle();

    // The phone is the verified one on the auth account; it is never taken from the request
    const phone = authUser.user.phone || existingUser?.phone || "";
    if (!phone) {
      return NextResponse.json({ error: "מספר טלפון חסר" }, { status: 400 });
    }

    let dbUserId: string;
    // An existing account keeps its role; registration can only complete it
    const effectiveType: string = existingUser?.type || userType;
    const isNewUser = !existingUser;

    if (existingUser) {
      const { data: updatedUser, error: updateError } = await supabaseAdmin
        .from("users")
        .update({
          phone,
          full_name: profile.fullName || "",
          email: profile.email || authUser.user.email || null,
          onboarding_completed: true,
        })
        .eq("id", existingUser.id)
        .select("id")
        .single();

      if (updateError || !updatedUser) {
        console.error("[register] user update error:", updateError);
        return NextResponse.json({ error: "שגיאה בעדכון חשבון" }, { status: 500 });
      }
      dbUserId = updatedUser.id;
    } else {
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
        return NextResponse.json({ error: "שגיאה ביצירת חשבון" }, { status: 500 });
      }
      dbUserId = insertedUser.id;
    }

    // Create the role profile once; an existing profile is never overwritten by re-registration
    if (effectiveType === "creator") {
      const { data: existingProfile } = await supabaseAdmin
        .from("creator_profiles")
        .select("id")
        .eq("user_id", dbUserId)
        .maybeSingle();
      if (!existingProfile) {
        const { error: profileError } = await supabaseAdmin.from("creator_profiles").insert({
          user_id: dbUserId,
          bio: profile.bio || null,
          tiktok_handle: profile.tiktokHandle || null,
          tiktok_followers: Math.max(0, parseInt(String(profile.tiktokFollowers ?? 0), 10) || 0),
          instagram_handle: profile.instagramHandle || null,
          instagram_followers: Math.max(0, parseInt(String(profile.instagramFollowers ?? 0), 10) || 0),
          categories: Array.isArray(profile.categories) ? profile.categories.filter((c: unknown) => typeof c === "string") : [],
          level: "creator",
          city: profile.city || null,
          date_of_birth: profile.dateOfBirth || null,
          intro_video_url: profile.introVideoUrl || null,
        });
        if (profileError) {
          console.error("[register] creator profile error:", profileError);
          return NextResponse.json({ error: "שגיאה ביצירת פרופיל" }, { status: 500 });
        }
      }
    } else if (effectiveType === "brand") {
      const { data: existingProfile } = await supabaseAdmin
        .from("brand_profiles")
        .select("id")
        .eq("user_id", dbUserId)
        .maybeSingle();
      if (!existingProfile) {
        const { error: profileError } = await supabaseAdmin.from("brand_profiles").insert({
          user_id: dbUserId,
          shop_name: profile.shopName || "",
          category: profile.category || "",
          categories: profile.category ? [profile.category] : [],
          website_url: profile.websiteUrl || null,
          description: profile.description || null,
          logo_url: profile.logoUrl || null,
        });
        if (profileError) {
          console.error("[register] brand profile error:", profileError);
          return NextResponse.json({ error: "שגיאה ביצירת פרופיל עסקי" }, { status: 500 });
        }
      }
    }

    // Welcome message only for brand-new accounts
    const greenAPI = getGreenAPI();
    if (greenAPI && phone && isNewUser) {
      const name = profile.fullName || "";
      if (effectiveType === "creator") {
        greenAPI.sendWelcomeCreator(phone, name).catch((err) =>
          console.error("[register] welcome message error:", err)
        );
      } else if (effectiveType === "brand") {
        greenAPI.sendWelcomeBrand(phone, name, profile.shopName || "").catch((err) =>
          console.error("[register] welcome message error:", err)
        );
      }
    }

    return NextResponse.json({ success: true, userType: effectiveType });
  } catch (err) {
    console.error("[register] error:", err);
    return NextResponse.json({ error: "שגיאה בהרשמה" }, { status: 500 });
  }
}
