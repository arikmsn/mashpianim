import { StubPaymentProvider, type PaymentProvider } from "./payments";
import { StubMessagingProvider, type MessagingProvider } from "./messaging";
import { StubInvoiceProvider, type InvoiceProvider } from "./invoicing";

let paymentProvider: PaymentProvider | null = null;
let messagingProvider: MessagingProvider | null = null;
let invoiceProvider: InvoiceProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (!paymentProvider) {
    // TODO: Replace with CardcomPaymentProvider when API keys are available
    paymentProvider = new StubPaymentProvider();
  }
  return paymentProvider;
}

export function getMessagingProvider(): MessagingProvider {
  if (!messagingProvider) {
    // TODO: Replace with ResendMessagingProvider when API key is available
    messagingProvider = new StubMessagingProvider();
  }
  return messagingProvider;
}

export function getInvoiceProvider(): InvoiceProvider {
  if (!invoiceProvider) {
    // TODO: Replace with GreenInvoiceProvider when API key is available
    invoiceProvider = new StubInvoiceProvider();
  }
  return invoiceProvider;
}

export type { PaymentProvider, MessagingProvider, InvoiceProvider };
