import type { MessageParams, MessagingProvider } from "./messaging";
import { isValidTwilioSender } from "@/lib/otp-channel";

// Twilio Programmable Messaging, SMS only (owner approved 2026-11-12). Used for the login code as the channel
// WhatsApp cannot restrict. Plain REST with Basic auth — no SDK dependency. The sender (TWILIO_SMS_FROM) is an
// alphanumeric id such as "Mashpian" or a purchased number in E.164; Israel must be enabled under Messaging →
// Geo permissions in the Twilio console, and the account must be upgraded from trial.
//
// Secrets stay in the environment; nothing here logs the token or the account SID.

export class TwilioSmsProvider implements MessagingProvider {
  name = "twilio";

  constructor(private readonly accountSid: string, private readonly authToken: string, private readonly from: string) {}

  async sendSMS(params: MessageParams): Promise<{ success: boolean; messageId?: string }> {
    try {
      const body = new URLSearchParams({ To: params.to, From: this.from, Body: params.body });
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(this.accountSid)}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: "Basic " + Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });
      const json = (await res.json().catch(() => ({}))) as { sid?: string; code?: number; message?: string; status?: string };
      if (!res.ok) {
        // Twilio's error code + message are safe to log (e.g. 21408 = region not enabled, 21606 = bad From)
        console.error(`[Twilio] sendSMS failed (${res.status}) code=${json.code ?? "?"}: ${json.message ?? ""}`);
        return { success: false };
      }
      return { success: true, messageId: json.sid };
    } catch (err) {
      console.error("[Twilio] sendSMS error:", err instanceof Error ? err.message : err);
      return { success: false };
    }
  }

  async sendEmail(params: MessageParams): Promise<{ success: boolean; messageId?: string }> {
    console.log("[Twilio] sendEmail not supported", params.to);
    return { success: false };
  }
}

let twilioInstance: TwilioSmsProvider | null = null;

// null when the three env vars are not all present (the SMS channel is then "not configured")
export function getTwilio(): TwilioSmsProvider | null {
  if (twilioInstance) return twilioInstance;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_SMS_FROM;
  if (!sid || !token || !from) return null;
  if (!isValidTwilioSender(from)) {
    // e.g. "Mashpian_Online": an alphanumeric sender is at most 11 characters, letters / digits / spaces only
    console.error("[Twilio] TWILIO_SMS_FROM is not a valid sender (use an E.164 number or an alphanumeric id of up to 11 letters/digits) — SMS disabled");
    return null;
  }
  twilioInstance = new TwilioSmsProvider(sid, token, from.trim());
  return twilioInstance;
}
