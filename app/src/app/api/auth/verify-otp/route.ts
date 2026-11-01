import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

    // Set a temp password for client-side session creation
    const tempPassword = crypto.randomUUID();
    const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(
      authUserId,
      { password: tempPassword }
    );

    if (pwError) {
      console.error("[verify-otp] setPassword error:", pwError);
      return NextResponse.json({
        success: true,
        userId: authUserId,
        userType,
        needsOnboarding,
      });
    }

    return NextResponse.json({
      success: true,
      userId: authUserId,
      userType,
      needsOnboarding,
      email,
      tempPassword,
    });
  } catch (err) {
    console.error("[verify-otp] error:", err);
    return NextResponse.json(
      { error: "שגיאה באימות קוד" },
      { status: 500 }
    );
  }
}
