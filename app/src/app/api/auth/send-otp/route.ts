import { NextResponse, type NextRequest } from "next/server";
import { getGreenAPI } from "@/lib/adapters/greenapi";
import { getTwilio } from "@/lib/adapters/twilio";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit, rateLimitedResponse, clientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { normalizeIsraeliMobile, PHONE_ERROR } from "@/lib/phone";
import { otpSmsText, resolveOtpChannel, toE164, type OtpChannel } from "@/lib/otp-channel";

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

    const body = (await request.json().catch(() => ({}))) as { phone?: unknown; channel?: unknown };
    const { phone } = body;

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

    // Which channel carries the code (owner, 2026-11-12): the client's choice, else OTP_DEFAULT_CHANNEL (sms |
    // whatsapp). WhatsApp goes through GreenAPI (an unofficial automation WhatsApp can restrict — it then cannot
    // open new chats, and GreenAPI still answers "sent"); SMS goes through Twilio and is the channel WhatsApp
    // cannot block. When the WhatsApp send fails outright and Twilio is configured, the code goes out by SMS
    // instead, and the response says so (`channel`, `fallback`) so the screen can tell the user where to look.
    const requested = (body as { channel?: unknown }).channel;
    const channel: OtpChannel = resolveOtpChannel(requested, process.env.OTP_DEFAULT_CHANNEL);
    const greenAPI = getGreenAPI();
    const twilio = getTwilio();

    // SMS costs money per message: on top of the per-phone / per-IP code limits above, an IP gets at most
    // RATE_LIMITS.sendOtpSmsIp SMS codes per window
    const db = supabaseAdmin;
    async function sendSms(): Promise<"sent" | "failed" | "limited"> {
      if (!twilio) return "failed";
      const smsLimit = await checkRateLimit(db, "send-otp-sms:ip", ip, RATE_LIMITS.sendOtpSmsIp);
      if (!smsLimit.allowed) return "limited";
      const to = toE164(formattedPhone);
      if (!to) return "failed";
      const r = await twilio.sendSMS({ to, body: otpSmsText(code) });
      return r.success ? "sent" : "failed";
    }

    if (channel === "sms") {
      if (!twilio) {
        console.error("[send-otp] SMS requested but Twilio is not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_SMS_FROM)");
        return NextResponse.json({ error: "שליחה ב-SMS לא זמינה כרגע. נסו בוואטסאפ." }, { status: 503 });
      }
      const sent = await sendSms();
      if (sent === "limited") {
        return NextResponse.json({ error: "יותר מדי בקשות ל-SMS. נסו שוב מאוחר יותר, או בוואטסאפ." }, { status: 429 });
      }
      if (sent !== "sent") {
        return NextResponse.json({ error: "שגיאה בשליחת ה-SMS. נסו שוב או בוואטסאפ." }, { status: 500 });
      }
      return NextResponse.json({ success: true, phone: formattedPhone, channel: "sms", fallback: false });
    }

    // WhatsApp first
    if (greenAPI) {
      const result = await greenAPI.sendOTP(formattedPhone, code);
      if (result.success) {
        return NextResponse.json({ success: true, phone: formattedPhone, channel: "whatsapp", fallback: false });
      }
      console.error("[send-otp] WhatsApp send failed" + (twilio ? " — falling back to SMS" : ""));
    } else {
      console.error("[send-otp] GreenAPI not configured — GREEN_API_INSTANCE_ID / GREEN_API_TOKEN missing" + (twilio ? " — using SMS" : ""));
    }
    if (twilio && (await sendSms()) === "sent") {
      return NextResponse.json({ success: true, phone: formattedPhone, channel: "sms", fallback: true });
    }
    return NextResponse.json(
      { error: greenAPI ? "שגיאה בשליחת הודעת WhatsApp. נסו שוב בעוד רגע." : "שירות ההודעות לא מוגדר. פנו לתמיכה." },
      { status: greenAPI ? 500 : 503 }
    );
  } catch (err) {
    console.error("[send-otp] error:", err);
    return NextResponse.json({ error: "שגיאה בשליחת קוד" }, { status: 500 });
  }
}
