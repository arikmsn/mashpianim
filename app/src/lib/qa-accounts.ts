// Our internal QA accounts (owner, 2026-11-28): they exist for testing and must never appear to real users, so
// the business gallery leaves them out. Matched by phone digits because phones are stored with and without "+"
// and the dev-login marker lives only in the auth metadata. Pure (unit-tested).

// QA creator, QA business, the dev-login gate phone
export const QA_PHONES: readonly string[] = ["972500000001", "972500000002", "972500009999"];

export function isQaPhone(phone: unknown): boolean {
  if (typeof phone !== "string") return false;
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `972${digits.slice(1)}`;
  return QA_PHONES.includes(digits);
}
