import { NextResponse, type NextRequest } from "next/server";
import { getGreenAPI } from "@/lib/adapters/greenapi";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit, rateLimitedResponse, clientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { normalizeIsraeliMobile, PHONE_ERROR } from "@/lib/phone";

function getSupabaseAdmin() {
  const url = process.env.NEXT_SUPABASE_URL;
  const key = process.env.SUPABASE_SEC_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const { phone } = await request.json();

    if (!phone) {
      return NextResponse.json({ error: "מספר טלפון חסר" }, { status: 400 });
    }

    // Only a real Israeli mobile number gets a code (anything else used to be padded with 972 and sent)
    const formattedPhone = normalizeIsraeliMobile(phone);
    if (!formattedPhone) {
      return NextResponse.json({ error: PHONE_ERROR }, { status: 400 });
    }

    // Abuse control (SEC-07): a phone gets 3 codes per 10 minutes, an IP 10
    const ip = clientIp(request.headers);
    const [byPhone, byIp] = await Promise.all([
      checkRateLimit(supabaseAdmin, "send-otp:phone", formattedPhone, RATE_LIMITS.sendOtpPhone),
      checkRateLimit(supabaseAdmin, "send-otp:ip", ip, RATE_LIMITS.sendOtpIp),
    ]);
    if (!byPhone.allowed) return rateLimitedResponse(byPhone);
    if (!byIp.allowed) return rateLimitedResponse(byIp);

    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // Store OTP in Supabase
    await supabaseAdmin.from("otp_codes").upsert(
      {
        phone: formattedPhone,
        code,
        expires_at: expiresAt,
        attempts: 0,
      },
      { onConflict: "phone" }
    );

    // Send via GreenAPI WhatsApp
    const greenAPI = getGreenAPI();
    if (greenAPI) {
      const result = await greenAPI.sendOTP(formattedPhone, code);
      if (!result.success) {
        return NextResponse.json(
          { error: "שגיאה בשליחת הודעת WhatsApp" },
          { status: 500 }
        );
      }
    } else {
      console.error("[send-otp] GreenAPI not configured — GREEN_API_INSTANCE_ID / GREEN_API_TOKEN missing");
      return NextResponse.json(
        { error: "שירות ההודעות לא מוגדר. פנו לתמיכה." },
        { status: 503 }
      );
    }

    return NextResponse.json({ success: true, phone: formattedPhone });
  } catch (err) {
    console.error("[send-otp] error:", err);
    return NextResponse.json({ error: "שגיאה בשליחת קוד" }, { status: 500 });
  }
}
