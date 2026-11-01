export interface InvoiceData {
  customerName: string;
  customerEmail: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
  currency: string;
  notes?: string;
}

export interface InvoiceResult {
  success: boolean;
  invoiceId?: string;
  invoiceUrl?: string;
  error?: string;
}

export interface InvoiceProvider {
  name: string;
  createInvoice(data: InvoiceData): Promise<InvoiceResult>;
  getInvoice(invoiceId: string): Promise<InvoiceData & { status: string }>;
  sendInvoice(invoiceId: string, email: string): Promise<{ success: boolean }>;
}

// Stub implementation — replace with GreenInvoice/iCount when ready
export class StubInvoiceProvider implements InvoiceProvider {
  name = "stub";

  async createInvoice(data: InvoiceData): Promise<InvoiceResult> {
    console.log("[StubInvoice] createInvoice", data);
    return { success: true, invoiceId: `stub_inv_${Date.now()}` };
  }

  async getInvoice(invoiceId: string) {
    return {
      customerName: "",
      customerEmail: "",
      items: [],
      currency: "ILS",
      status: "draft",
    };
  }

  async sendInvoice(invoiceId: string, email: string) {
    console.log("[StubInvoice] sendInvoice", invoiceId, email);
    return { success: true };
  }
}
