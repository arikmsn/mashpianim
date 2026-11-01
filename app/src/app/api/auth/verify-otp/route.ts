import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { phone, code } = await request.json();

    if (!phone || !code) {
      return NextResponse.json(
        { error: "מספר טלפון וקוד חסרים" },
        { status: 400 }
      );
    }

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

    // Verify code
    if (otpRecord.code !== code) {
      await supabaseAdmin
        .from("otp_codes")
        .update({ attempts: otpRecord.attempts + 1 })
        .eq("phone", phone);
      return NextResponse.json({ error: "קוד שגוי" }, { status: 400 });
    }

    // OTP is valid — clean up
    await supabaseAdmin.from("otp_codes").delete().eq("phone", phone);

    // Check if user exists, if not create one via Supabase Auth
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.phone === phone
    );

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
    } else {
      const { data: newUser, error: createError } =
        await supabaseAdmin.auth.admin.createUser({
          phone,
          phone_confirm: true,
        });
      if (createError || !newUser.user) {
        return NextResponse.json(
          { error: "שגיאה ביצירת משתמש" },
          { status: 500 }
        );
      }
      userId = newUser.user.id;
    }

    // Generate a session token for the user
    const { data: session, error: sessionError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: `${phone.replace("+", "")}@phone.mashpianim.co.il`,
      });

    if (sessionError) {
      // Fallback: return user ID for client-side session creation
      return NextResponse.json({
        success: true,
        userId,
        needsOnboarding: !existingUser,
      });
    }

    return NextResponse.json({
      success: true,
      userId,
      needsOnboarding: !existingUser,
      verificationUrl: session?.properties?.hashed_token
        ? `/auth/callback?token_hash=${session.properties.hashed_token}&type=magiclink`
        : undefined,
    });
  } catch (err) {
    console.error("[verify-otp] error:", err);
    return NextResponse.json(
      { error: "שגיאה באימות קוד" },
      { status: 500 }
    );
  }
}
