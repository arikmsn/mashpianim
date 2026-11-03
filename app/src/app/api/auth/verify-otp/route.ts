import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitedResponse, clientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { resolveViewer } from "@/lib/viewer";
import { clearActiveRoleCookie, homeForRole, setActiveRoleCookie } from "@/lib/active-role";

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

function pseudoEmail(phone: string): string {
  return `${phone.replace("+", "")}@phone.mashpian.online`;
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const { phone: rawPhone, code } = await request.json();

    if (!rawPhone || !code) {
      return NextResponse.json(
        { error: "מספר טלפון וקוד חסרים" },
        { status: 400 }
      );
    }

    const phone = formatPhone(rawPhone);

    // Guessing control (SEC-07): 10 verifications per phone and 30 per IP in 10 minutes,
    // on top of the 5-attempt counter per code
    const ip = clientIp(request.headers);
    const [byPhone, byIp] = await Promise.all([
      checkRateLimit(supabaseAdmin, "verify-otp:phone", phone, RATE_LIMITS.verifyOtpPhone),
      checkRateLimit(supabaseAdmin, "verify-otp:ip", ip, RATE_LIMITS.verifyOtpIp),
    ]);
    if (!byPhone.allowed) return rateLimitedResponse(byPhone);
    if (!byIp.allowed) return rateLimitedResponse(byIp);

    // Look up OTP
    const { data: otpRecord, error: fetchError } = await supabaseAdmin
      .from("otp_codes")
      .select("*")
      .eq("phone", phone)
      .single();

    if (fetchError || !otpRecord) {
      return NextResponse.json(
        { error: "קוד לא נמצא. שלחו קוד חדש" },
        { status: 400 }
      );
    }

    // Check expiration
    if (new Date(otpRecord.expires_at) < new Date()) {
      await supabaseAdmin.from("otp_codes").delete().eq("phone", phone);
      return NextResponse.json(
        { error: "הקוד פג תוקף. שלחו קוד חדש" },
        { status: 400 }
      );
    }

    // Check attempts
    if (otpRecord.attempts >= 5) {
      await supabaseAdmin.from("otp_codes").delete().eq("phone", phone);
      return NextResponse.json(
        { error: "יותר מדי ניסיונות. שלחו קוד חדש" },
        { status: 429 }
      );
    }

    if (otpRecord.code !== code) {
      await supabaseAdmin
        .from("otp_codes")
        .update({ attempts: otpRecord.attempts + 1 })
        .eq("phone", phone);
      return NextResponse.json({ error: "קוד שגוי" }, { status: 400 });
    }

    // OTP is valid — clean up
    await supabaseAdmin.from("otp_codes").delete().eq("phone", phone);

    const email = pseudoEmail(phone);

    // Check our users table first (source of truth for registered users)
    const { data: dbUser } = await supabaseAdmin
      .from("users")
      .select("id, auth_user_id, type")
      .eq("phone", phone)
      .maybeSingle();

    let authUserId: string;
    let userType: string | null = null;
    let needsOnboarding = true;

    if (dbUser?.auth_user_id) {
      // Existing registered user
      authUserId = dbUser.auth_user_id;
      userType = dbUser.type;
      needsOnboarding = false;

      // Ensure pseudo-email is set for session generation
      await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        email,
        email_confirm: true,
      });
    } else {
      // Try to create new auth user
      const { data: newUser, error: createError } =
        await supabaseAdmin.auth.admin.createUser({
          phone,
          email,
          phone_confirm: true,
          email_confirm: true,
        });

      if (createError) {
        // User may exist in auth from a previous partial registration
        // Try to find by searching through auth users
        let foundUser = null;
        let page = 1;
        while (!foundUser && page <= 20) {
          const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({
            page,
            perPage: 100,
          });
          if (!users || users.length === 0) break;
          foundUser = users.find((u) => u.phone === phone || u.email === email);
          page++;
        }

        if (foundUser) {
          authUserId = foundUser.id;
          await supabaseAdmin.auth.admin.updateUserById(authUserId, {
            email,
            email_confirm: true,
          });

          // Check if this auth user has a completed registration in the users table
          const { data: dbUserByAuth } = await supabaseAdmin
            .from("users")
            .select("id, type")
            .eq("auth_user_id", authUserId)
            .maybeSingle();

          if (dbUserByAuth?.type) {
            userType = dbUserByAuth.type;
            needsOnboarding = false;
          }
        } else {
          console.error("[verify-otp] createUser error:", createError);
          return NextResponse.json(
            { error: "שגיאה ביצירת משתמש. נסו שוב" },
            { status: 500 }
          );
        }
      } else {
        authUserId = newUser.user!.id;
      }
    }

    // The session is established here, server-side: a one-time password is set and used once to sign in,
    // which writes the auth cookies on this response. The password never leaves the server (SEC-09).
    const oneTimePassword = crypto.randomUUID();
    const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(
      authUserId,
      { password: oneTimePassword }
    );
    if (pwError) {
      console.error("[verify-otp] setPassword error:", pwError);
      return NextResponse.json({ error: "שגיאה בפתיחת ההתחברות. נסו שוב" }, { status: 500 });
    }

    const userClient = await createServerClient();
    const { error: signInError } = await userClient.auth.signInWithPassword({ email, password: oneTimePassword });
    if (signInError) {
      console.error("[verify-otp] sign-in error:", signInError.message);
      return NextResponse.json({ error: "שגיאה בפתיחת ההתחברות. נסו שוב" }, { status: 500 });
    }

    // Which role does this session act as? One role → chosen here; several (admin with a creator profile,
    // a phone registered as creator and brand) → the login screen asks and POSTs /api/auth/user-type
    let roles: string[] = [];
    let role: string | null = null;
    if (!needsOnboarding) {
      const viewer = await resolveViewer(supabaseAdmin, authUserId);
      roles = viewer?.roles || [];
      if (roles.length === 1) role = roles[0];
    }

    const response = NextResponse.json({
      success: true,
      userId: authUserId,
      userType,
      needsOnboarding,
      roles,
      role,
      redirect: role ? homeForRole(role as "creator" | "brand" | "admin") : null,
    });
    if (role) setActiveRoleCookie(response, role as "creator" | "brand" | "admin");
    else clearActiveRoleCookie(response);
    return response;
  } catch (err) {
    console.error("[verify-otp] error:", err);
    return NextResponse.json(
      { error: "שגיאה באימות קוד" },
      { status: 500 }
    );
  }
}
