export interface MessageParams {
  to: string;
  subject?: string;
  body: string;
  templateId?: string;
  templateData?: Record<string, string>;
}

export interface MessagingProvider {
  name: string;
  sendEmail(params: MessageParams): Promise<{ success: boolean; messageId?: string }>;
  sendSMS(params: MessageParams): Promise<{ success: boolean; messageId?: string }>;
  sendWhatsApp?(params: MessageParams): Promise<{ success: boolean; messageId?: string }>;
}

// Stub implementation — replace with Resend/SendGrid when ready
export class StubMessagingProvider implements MessagingProvider {
  name = "stub";

  async sendEmail(params: MessageParams) {
    console.log("[StubMessaging] sendEmail", params);
    return { success: true, messageId: `stub_email_${Date.now()}` };
  }

  async sendSMS(params: MessageParams) {
    console.log("[StubMessaging] sendSMS", params);
    return { success: true, messageId: `stub_sms_${Date.now()}` };
  }
}
