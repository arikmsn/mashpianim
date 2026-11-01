import { StubPaymentProvider, type PaymentProvider } from "./payments";
import { StubMessagingProvider, type MessagingProvider } from "./messaging";
import { StubInvoiceProvider, type InvoiceProvider } from "./invoicing";
import { GreenAPIProvider, getGreenAPI } from "./greenapi";

let paymentProvider: PaymentProvider | null = null;
let messagingProvider: MessagingProvider | null = null;
let invoiceProvider: InvoiceProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (!paymentProvider) {
    paymentProvider = new StubPaymentProvider();
  }
  return paymentProvider;
}

export function getMessagingProvider(): MessagingProvider {
  if (!messagingProvider) {
    const greenAPI = getGreenAPI();
    messagingProvider = greenAPI || new StubMessagingProvider();
  }
  return messagingProvider;
}

export function getInvoiceProvider(): InvoiceProvider {
  if (!invoiceProvider) {
    invoiceProvider = new StubInvoiceProvider();
  }
  return invoiceProvider;
}

export type { PaymentProvider, MessagingProvider, InvoiceProvider };
export { GreenAPIProvider };
