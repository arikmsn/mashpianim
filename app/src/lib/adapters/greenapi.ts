import type { MessagingProvider, MessageParams } from "./messaging";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.mashpian.online";

// Tapping this in WhatsApp opens the login screen with the phone and the code already filled in
export function otpLoginLink(phone: string, code: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  return `${APP_URL}/login?phone=${encodeURIComponent(digits)}&code=${encodeURIComponent(code)}`;
}

interface GreenAPIConfig {
  instanceId: string;
  apiTokenInstance: string;
  apiUrl?: string;
}

export class GreenAPIProvider implements MessagingProvider {
  name = "greenapi";
  private instanceId: string;
  private apiToken: string;
  private baseUrl: string;

  constructor(config: GreenAPIConfig) {
    this.instanceId = config.instanceId;
    this.apiToken = config.apiTokenInstance;
    this.baseUrl =
      config.apiUrl || `https://api.green-api.com/waInstance${config.instanceId}`;
  }

  private formatPhone(phone: string): string {
    let cleaned = phone.replace(/[\s\-()]/g, "");
    if (cleaned.startsWith("+")) cleaned = cleaned.slice(1);
    if (cleaned.startsWith("0")) cleaned = `972${cleaned.slice(1)}`;
    return `${cleaned}@c.us`;
  }

  private async apiCall(method: string, body: Record<string, unknown>) {
    const url = `${this.baseUrl}/${method}/${this.apiToken}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GreenAPI ${method} failed (${res.status}): ${text}`);
    }

    return res.json();
  }

  async sendWhatsApp(
    params: MessageParams
  ): Promise<{ success: boolean; messageId?: string }> {
    try {
      const chatId = this.formatPhone(params.to);
      const result = await this.apiCall("sendMessage", {
        chatId,
        message: params.body,
      });
      return { success: true, messageId: result.idMessage };
    } catch (err) {
      console.error("[GreenAPI] sendWhatsApp error:", err);
      return { success: false };
    }
  }

  async sendOTP(
    phone: string,
    code: string
  ): Promise<{ success: boolean; messageId?: string }> {
    return this.sendWhatsApp({
      to: phone,
      // WhatsApp offers no "copy" for a bare number; the link opens the app with the code filled in
      body: `🔐 *משפיען אונליין* — קוד אימות\n\nהקוד שלך:\n\n*${code}*\n\n👇 או לחצו כאן והקוד יוזן אוטומטית:\n${otpLoginLink(phone, code)}\n\n⏱ תקף ל-5 דקות בלבד.\nאין לשתף את הקוד עם אף אחד.`,
    });
  }

  async sendWelcomeCreator(
    phone: string,
    name: string
  ): Promise<{ success: boolean; messageId?: string }> {
    return this.sendWhatsApp({
      to: phone,
      body: [
        `🎉 ברוכים הבאים למשפיען אונליין, ${name}!`,
        ``,
        `ההרשמה שלך הושלמה בהצלחה ואנחנו שמחים שהצטרפת לקהילת יוצרי התוכן שלנו.`,
        ``,
        `✅ מה עכשיו?`,
        `• עדכנו את הפרופיל שלכם`,
        `• גלשו בפיד וגלו מוצרים חדשים`,
        `• הגישו בקשה למוצר שמעניין אתכם`,
        `• צלמו סרטון UGC וקבלו את המוצר בחינם!`,
        ``,
        `🔗 כנסו לאפליקציה: https://www.mashpian.online/feed`,
        ``,
        `בהצלחה! 💪`,
        `צוות משפיען אונליין`,
      ].join("\n"),
    });
  }

  async sendWelcomeBrand(
    phone: string,
    name: string,
    shopName: string
  ): Promise<{ success: boolean; messageId?: string }> {
    return this.sendWhatsApp({
      to: phone,
      body: [
        `🎉 ברוכים הבאים למשפיען אונליין, ${name}!`,
        ``,
        `העסק *${shopName}* נרשם בהצלחה לפלטפורמה.`,
        ``,
        `✅ מה עכשיו?`,
        `• העלו מוצרים לפרופיל העסקי`,
        `• יוצרי תוכן יגישו בקשות למוצרים שלכם`,
        `• אשרו בקשות ושלחו מוצרים`,
        `• קבלו סרטוני UGC אותנטיים לשיווק!`,
        ``,
        `🔗 כנסו לממשק הניהול: https://www.mashpian.online/brand`,
        ``,
        `בהצלחה! 🚀`,
        `צוות משפיען אונליין`,
      ].join("\n"),
    });
  }

  async sendConnectionNotification(
    phone: string,
    brandName: string,
    productName: string
  ): Promise<{ success: boolean; messageId?: string }> {
    return this.sendWhatsApp({
      to: phone,
      body: `🎉 חדשות טובות!\n\n${brandName} אישרו את הבקשה שלך למוצר *${productName}*.\n\nהיכנסו לאפליקציה לפרטים נוספים.`,
    });
  }

  async sendEmail(params: MessageParams) {
    console.log("[GreenAPI] sendEmail not supported, use email provider", params);
    return { success: false };
  }

  async sendSMS(params: MessageParams) {
    return this.sendWhatsApp(params);
  }
}

let greenAPIInstance: GreenAPIProvider | null = null;

export function getGreenAPI(): GreenAPIProvider | null {
  if (greenAPIInstance) return greenAPIInstance;

  const instanceId = process.env.GREEN_API_INSTANCE_ID || process.env.GREENAPI_INSTANCE_ID;
  const apiToken = process.env.GREEN_API_TOKEN || process.env.GREENAPI_API_TOKEN;

  if (!instanceId || !apiToken) return null;

  greenAPIInstance = new GreenAPIProvider({
    instanceId,
    apiTokenInstance: apiToken,
  });

  return greenAPIInstance;
}
