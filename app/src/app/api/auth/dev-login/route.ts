import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DEV_ADMIN_PASSWORD = "Mashpianim2026!";

const DEV_ACCOUNTS: Record<string, { phone: string; email: string; role: string }> = {
  admin: {
    phone: "+972500000000",
    email: "admin@mashpianim.co.il",
    role: "admin",
  },
  creator: {
    phone: "+972500000001",
    email: "creator@mashpianim.co.il",
    role: "creator",
  },
  brand: {
    phone: "+972500000002",
    email: "brand@mashpianim.co.il",
    role: "brand",
  },
};

export async function POST(request: NextRequest) {
  try {
    const { role, password } = await request.json();

    if (password !== DEV_ADMIN_PASSWORD) {
      return NextResponse.json({ error: "סיסמה שגויה" }, { status: 401 });
    }

    const account = DEV_ACCOUNTS[role];
    if (!account) {
      return NextResponse.json({ error: "תפקיד לא תקין" }, { status: 400 });
    }

    // Check if dev user exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    let user = existingUsers?.users?.find((u) => u.email === account.email);

    if (!user) {
      const { data: newUser, error: createError } =
        await supabaseAdmin.auth.admin.createUser({
          email: account.email,
          password: DEV_ADMIN_PASSWORD,
          phone: account.phone,
          phone_confirm: true,
          email_confirm: true,
          user_metadata: { role: account.role, dev_account: true },
        });
      if (createError) {
        return NextResponse.json(
          { error: `שגיאה ביצירת משתמש: ${createError.message}` },
          { status: 500 }
        );
      }
      user = newUser.user;

      // Create user record in users table
      await supabaseAdmin.from("users").upsert({
        id: user.id,
        phone: account.phone,
        email: account.email,
        full_name: account.role === "admin" ? "מנהל מערכת" : account.role === "creator" ? "יוצר תוכן (בדיקה)" : "מפרסם (בדיקה)",
        role: account.role,
        status: "active",
      });

      // Create profile based on role
      if (account.role === "creator") {
        await supabaseAdmin.from("creator_profiles").upsert({
          user_id: user.id,
          display_name: "יוצר תוכן (בדיקה)",
          bio: "חשבון בדיקה ליוצר תוכן",
          categories: ["אופנה", "לייף סטייל"],
          level: "starter",
          instagram_url: "https://instagram.com/test_creator",
          tiktok_url: "https://tiktok.com/@test_creator",
        });
      } else if (account.role === "brand") {
        await supabaseAdmin.from("brand_profiles").upsert({
          user_id: user.id,
          business_name: "מותג בדיקה בע\"מ",
          business_type: "e-commerce",
          website_url: "https://example.com",
          description: "חשבון בדיקה למפרסם",
          credits_balance: 10,
        });
      }
    }

    // Generate a magic link for this user
    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: account.email,
      });

    if (linkError || !linkData) {
      return NextResponse.json({
        success: true,
        userId: user.id,
        role: account.role,
        email: account.email,
        message: "משתמש נוצר, התחברו עם אימייל וסיסמה",
        loginMethod: "email",
      });
    }

    return NextResponse.json({
      success: true,
      userId: user.id,
      role: account.role,
      email: account.email,
      verificationUrl: linkData?.properties?.hashed_token
        ? `/auth/callback?token_hash=${linkData.properties.hashed_token}&type=magiclink`
        : undefined,
    });
  } catch (err) {
    console.error("[dev-login] error:", err);
    return NextResponse.json({ error: "שגיאה בכניסה" }, { status: 500 });
  }
}
