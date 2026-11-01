export interface PaymentResult {
  success: boolean;
  transactionId: string | null;
  error?: string;
  redirectUrl?: string;
}

export interface PaymentProvider {
  name: string;
  createCharge(params: {
    amount: number;
    currency: string;
    description: string;
    metadata: Record<string, string>;
    returnUrl: string;
    cancelUrl: string;
  }): Promise<PaymentResult>;

  getStatus(transactionId: string): Promise<{
    status: "pending" | "completed" | "failed" | "refunded";
    amount: number;
  }>;

  refund(transactionId: string, amount?: number): Promise<PaymentResult>;

  handleWebhook(payload: unknown, signature: string): Promise<{
    event: "payment_completed" | "payment_failed" | "refund_completed";
    transactionId: string;
    metadata: Record<string, string>;
  }>;
}

// Stub implementation — replace with Cardcom when ready
export class StubPaymentProvider implements PaymentProvider {
  name = "stub";

  async createCharge(params: Parameters<PaymentProvider["createCharge"]>[0]): Promise<PaymentResult> {
    console.log("[StubPayment] createCharge", params);
    return {
      success: true,
      transactionId: `stub_${Date.now()}`,
      redirectUrl: params.returnUrl,
    };
  }

  async getStatus(transactionId: string) {
    return { status: "completed" as const, amount: 0 };
  }

  async refund(transactionId: string) {
    return { success: true, transactionId };
  }

  async handleWebhook(payload: unknown, signature: string) {
    return {
      event: "payment_completed" as const,
      transactionId: "stub",
      metadata: {},
    };
  }
}
