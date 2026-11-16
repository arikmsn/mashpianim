// Credit packages and the SUMIT hosted-payment flow — pure helpers (unit-tested). No framework imports.
//
// The flow (owner, 2026-11-14): a business picks a package → POST /api/payments/checkout opens a pending
// `transactions` row and asks SUMIT for a payment page (/billing/payments/beginredirect/) → the business pays
// on SUMIT's page (card details never touch us) → SUMIT redirects back with OG-PaymentID / OG-ExternalIdentifier
// → we verify the payment with /billing/payments/get/ before crediting (the return URL alone proves nothing)
// → SUMIT issues the חשבונית מס/קבלה and e-mails it. A 15-minute cron reconciles buyers who never came back.

export type PackageId = "single" | "pack5" | "pack10" | "pack20";

export interface CreditPackage {
  id: PackageId;
  credits: number;
  // Key in site_settings "credits" (the admin edits the prices in /admin/settings)
  priceKey: "single_price" | "pack_5_price" | "pack_10_price" | "pack_20_price";
  defaultPrice: number;
}

export const CREDIT_PACKAGES: readonly CreditPackage[] = [
  { id: "single", credits: 1, priceKey: "single_price", defaultPrice: 100 },
  { id: "pack5", credits: 5, priceKey: "pack_5_price", defaultPrice: 450 },
  { id: "pack10", credits: 10, priceKey: "pack_10_price", defaultPrice: 800 },
  { id: "pack20", credits: 20, priceKey: "pack_20_price", defaultPrice: 1400 },
];

export function isPackageId(value: unknown): value is PackageId {
  return typeof value === "string" && CREDIT_PACKAGES.some((p) => p.id === value);
}

export type CreditPrices = Record<PackageId, number>;

function money(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === "") return fallback;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.round(n * 100) / 100;
}

// Tolerates missing keys, strings from the admin form and junk; prices are in ILS, VAT included
export function parseCreditPrices(data: unknown): CreditPrices {
  const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const out = {} as CreditPrices;
  for (const p of CREDIT_PACKAGES) out[p.id] = money(d[p.priceKey], p.defaultPrice);
  return out;
}

export interface PackageOffer {
  id: PackageId;
  credits: number;
  price: number;
  perVideo: number;
  label: string;
  // The best price per video among the multi-video packages
  best: boolean;
  // Set when the first-purchase discount applies (applyFirstPurchaseDiscount)
  originalPrice?: number;
  discountPct?: number;
}

export function packageLabel(credits: number): string {
  return credits === 1 ? "סרטון אחד" : `${credits} סרטונים`;
}

export function packageOffers(prices: CreditPrices): PackageOffer[] {
  const offers = CREDIT_PACKAGES.map((p) => {
    const price = prices[p.id];
    return { id: p.id, credits: p.credits, price, perVideo: Math.round((price / p.credits) * 100) / 100, label: packageLabel(p.credits), best: false };
  });
  const multi = offers.filter((o) => o.credits > 1);
  if (multi.length > 0) {
    const cheapest = Math.min(...multi.map((o) => o.perVideo));
    const first = multi.find((o) => o.perVideo === cheapest);
    if (first) first.best = true;
  }
  return offers;
}

export function formatILS(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  const whole = Number.isInteger(rounded);
  return `₪${rounded.toLocaleString("en-US", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}

// --- The switch --------------------------------------------------------------------------------------------
// SUMIT_PAYMENTS = off (default) | admins (only sessions with the admin flag see the purchase flow — the owner
// tests with his own business account while everyone else still gets the contact form) | on (everyone).
// Either way the credentials must be present, or the flow stays off.
export type PaymentsMode = "off" | "admins" | "on";

// Shaped like process.env (an index signature) so the real environment passes straight in
export type PaymentsEnv = { [key: string]: string | undefined };

export function paymentsMode(env: PaymentsEnv): PaymentsMode {
  const configured = /^\d+$/.test((env.SUMIT_COMPANY_ID || "").trim()) && (env.SUMIT_API_KEY || "").trim().length > 0;
  if (!configured) return "off";
  const v = (env.SUMIT_PAYMENTS || "").trim().toLowerCase();
  if (v === "on") return "on";
  if (v === "admins") return "admins";
  return "off";
}

export function purchasesOpenFor(mode: PaymentsMode, isAdmin: boolean): boolean {
  return mode === "on" || (mode === "admins" && isAdmin);
}

// --- Invoice details ---------------------------------------------------------------------------------------
export interface BillingDetails {
  name: string;
  companyNumber: string | null;
  email: string;
}

export type BillingValidation = { ok: true; value: BillingDetails } | { ok: false; error: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateBilling(input: unknown): BillingValidation {
  const b = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const email = typeof b.email === "string" ? b.email.trim() : "";
  const companyRaw = typeof b.companyNumber === "string" ? b.companyNumber.replace(/\D/g, "") : "";
  if (name.length < 2) return { ok: false, error: "כתבו את השם לחשבונית (לפחות 2 תווים)" };
  if (name.length > 120) return { ok: false, error: "השם לחשבונית ארוך מדי (עד 120 תווים)" };
  if (!EMAIL.test(email) || email.length > 200) return { ok: false, error: "כתבו כתובת אימייל תקינה — החשבונית נשלחת אליה" };
  if (companyRaw && (companyRaw.length < 5 || companyRaw.length > 15)) return { ok: false, error: "מספר עוסק / ח.פ. לא תקין (5–15 ספרות)" };
  return { ok: true, value: { name, companyNumber: companyRaw || null, email: email.toLowerCase() } };
}

// --- SUMIT request / response ------------------------------------------------------------------------------
// Enum values from SUMIT's OpenAPI (api.sumit.co.il/swagger/v1/swagger.json): sent as integers.
export const SUMIT_DOCUMENT_INVOICE_RECEIPT = 1; // חשבונית מס/קבלה
export const SUMIT_LANGUAGE_HEBREW = 0;
export const SUMIT_SEARCH_BY_EXTERNAL_ID = 2; // Customer.SearchMode: find the card by our id, create it when missing
export const SUMIT_ITEM_SEARCH_BY_NAME = 3; // Item.SearchMode: one income item per package name
export const SUMIT_PAYMENT_PAGE_HOURS = 2;

export interface BeginRedirectParams {
  companyId: number;
  apiKey: string;
  transactionId: string;
  brandProfileId: string;
  billing: BillingDetails;
  phone: string | null;
  offer: PackageOffer;
  returnUrl: string;
  cancelUrl: string;
}

export function packageItemName(offer: PackageOffer): string {
  const base = `חבילת ${offer.label} — משפיען אונליין`;
  return offer.discountPct ? `${base} (${offer.discountPct}% הנחת רכישה ראשונה)` : base;
}

// The body of POST /billing/payments/beginredirect/. VATIncluded with the gross price keeps the charge equal
// to what the business saw; ExternalIdentifier = our transaction id comes back on the return URL.
export function buildBeginRedirectBody(p: BeginRedirectParams): Record<string, unknown> {
  const itemName = packageItemName(p.offer);
  return {
    Credentials: { CompanyID: p.companyId, APIKey: p.apiKey },
    Customer: {
      Name: p.billing.name,
      EmailAddress: p.billing.email,
      Phone: p.phone || undefined,
      CompanyNumber: p.billing.companyNumber || undefined,
      ExternalIdentifier: p.brandProfileId,
      SearchMode: SUMIT_SEARCH_BY_EXTERNAL_ID,
    },
    Items: [
      {
        Item: { Name: itemName, Description: `${p.offer.credits} קרדיטים לאישור שיתופי פעולה באתר mashpian.online`, Price: p.offer.price, SearchMode: SUMIT_ITEM_SEARCH_BY_NAME },
        Quantity: 1,
        UnitPrice: p.offer.price,
        Total: p.offer.price,
        Description: itemName,
      },
    ],
    VATIncluded: true,
    DocumentType: SUMIT_DOCUMENT_INVOICE_RECEIPT,
    DocumentDescription: `חבילת ${p.offer.label} באתר mashpian.online · מזהה הזמנה ${p.transactionId}`,
    RedirectURL: p.returnUrl,
    CancelRedirectURL: p.cancelUrl,
    ExternalIdentifier: p.transactionId,
    MaximumPayments: 1,
    ExpirationHours: SUMIT_PAYMENT_PAGE_HOURS,
    Language: SUMIT_LANGUAGE_HEBREW,
    Header: "משפיען אונליין — רכישת סרטונים",
    SendUpdateByEmailAddress: p.billing.email,
    UpdateCustomerOnSuccess: true,
    UpdateOrganizationOnSuccess: true,
  };
}

// SUMIT's envelope: { Status, UserErrorMessage, TechnicalErrorDetails, Data }. Status is 0 / "Success" on success.
export function sumitOk(envelope: unknown): boolean {
  const s = (envelope as { Status?: unknown } | null)?.Status;
  return s === 0 || s === "0" || (typeof s === "string" && /^success/i.test(s));
}

export function sumitErrorMessage(envelope: unknown): string {
  const e = (envelope && typeof envelope === "object" ? envelope : {}) as { UserErrorMessage?: unknown; TechnicalErrorDetails?: unknown; Status?: unknown };
  if (typeof e.UserErrorMessage === "string" && e.UserErrorMessage.trim()) return e.UserErrorMessage.trim();
  if (typeof e.TechnicalErrorDetails === "string" && e.TechnicalErrorDetails.trim()) return e.TechnicalErrorDetails.trim();
  return `SUMIT status ${String(e.Status ?? "?")}`;
}

export interface SumitPayment {
  ID: number;
  CustomerID?: number | null;
  Date?: string | null;
  ValidPayment: boolean;
  Status?: string | null;
  StatusDescription?: string | null;
  Amount: number;
  Currency?: unknown;
  ExternalIdentifier?: string | null;
  DocumentID?: number | null;
  AuthNumber?: string | null;
  PaymentMethod?: { Type?: unknown; CreditCard_LastDigits?: string | null } | null;
}

export function isILS(currency: unknown): boolean {
  if (currency === undefined || currency === null || currency === "") return true; // company default = ILS
  if (currency === 0 || currency === "0") return true;
  return typeof currency === "string" && /^ILS/i.test(currency);
}

export type PaymentCheck = { ok: true } | { ok: false; reason: string };

// A payment credits the business only when SUMIT says it is valid, in ILS, for the exact package price, and
// (when SUMIT echoes it) for this very order.
export function verifySumitPayment(payment: SumitPayment | null | undefined, expected: { transactionId: string; amount: number }): PaymentCheck {
  if (!payment) return { ok: false, reason: "no_payment" };
  if (payment.ValidPayment !== true) return { ok: false, reason: `invalid:${payment.StatusDescription || payment.Status || "unknown"}` };
  if (!isILS(payment.Currency)) return { ok: false, reason: `currency:${String(payment.Currency)}` };
  const amount = typeof payment.Amount === "number" ? payment.Amount : Number(payment.Amount);
  if (!Number.isFinite(amount) || Math.abs(amount - expected.amount) > 0.01) return { ok: false, reason: `amount:${String(payment.Amount)}≠${expected.amount}` };
  const ext = typeof payment.ExternalIdentifier === "string" ? payment.ExternalIdentifier.trim() : "";
  if (ext && ext !== expected.transactionId) return { ok: false, reason: `order:${ext}` };
  return { ok: true };
}

// The parameters SUMIT appends to the return / cancel URL (OG-PaymentID, OG-CustomerID, OG-ExternalIdentifier;
// purchase pages spell them in lower case) — read case-insensitively.
export function returnParams(search: URLSearchParams): { paymentId: number | null; customerId: string | null; transactionId: string | null } {
  const get = (name: string): string | null => {
    for (const [k, v] of search.entries()) if (k.toLowerCase() === name.toLowerCase()) return v;
    return null;
  };
  const pid = get("OG-PaymentID");
  const paymentId = pid && /^\d+$/.test(pid.trim()) ? Number(pid.trim()) : null;
  const tx = get("OG-ExternalIdentifier");
  return {
    paymentId,
    customerId: get("OG-CustomerID"),
    transactionId: tx && /^[0-9a-f-]{36}$/i.test(tx.trim()) ? tx.trim().toLowerCase() : null,
  };
}

// What the business reads when it lands back on its home page (?purchase=…)
export function purchaseOutcomeText(outcome: string | null | undefined, credits?: number | null): { text: string; tone: "success" | "error" | "info" } | null {
  switch (outcome) {
    case "success":
      return { text: credits && credits > 0 ? `✅ התשלום התקבל — ${packageLabel(credits)} נוספו לחבילה שלכם. החשבונית בדרך למייל.` : "✅ התשלום התקבל — הסרטונים נוספו לחבילה שלכם. החשבונית בדרך למייל.", tone: "success" };
    case "pending":
      return { text: "התשלום התקבל ומאומת — הסרטונים ייטענו לחבילה תוך דקות.", tone: "info" };
    case "cancelled":
      return { text: "התשלום בוטל — לא חויבתם. אפשר לנסות שוב בכל רגע.", tone: "info" };
    case "failed":
      return { text: "התשלום לא אושר — לא נוספו סרטונים. אם חויבתם בכל זאת, פנו אלינו דרך \"צור קשר\".", tone: "error" };
    default:
      return null;
  }
}

// --- First-purchase discount (owner, 2026-11-16: "מתנת פתיחה") --------------------------------------------
// A percentage from the admin settings (site_settings "credits" → first_purchase_discount_pct), applied to a
// business's first completed online order. The server decides (never the client), both when listing and when
// opening the order; SUMIT charges the discounted price, the item name says so.
export const FIRST_PURCHASE_DISCOUNT_DEFAULT = 15;

export function parseFirstPurchaseDiscount(data: unknown): number {
  const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const raw = d.first_purchase_discount_pct;
  if (raw === undefined || raw === null || raw === "") return FIRST_PURCHASE_DISCOUNT_DEFAULT;
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(90, Math.floor(n));
}

// With pct > 0 every offer gets `originalPrice` and the discounted `price` / `perVideo`; pct 0 leaves them as is
export function applyFirstPurchaseDiscount(offers: PackageOffer[], pct: number): PackageOffer[] {
  if (!(pct > 0)) return offers.map((o) => ({ ...o, originalPrice: undefined, discountPct: 0 }));
  return offers.map((o) => {
    const price = Math.round(o.price * (100 - pct)) / 100;
    return { ...o, originalPrice: o.price, discountPct: pct, price, perVideo: Math.round((price / o.credits) * 100) / 100 };
  });
}

// What a package saves against buying its videos one by one (0 when it does not)
export function savingsVsSingle(offer: PackageOffer, singlePrice: number): number {
  const saving = Math.round((offer.credits * singlePrice - offer.price) * 100) / 100;
  return saving > 0 ? saving : 0;
}
