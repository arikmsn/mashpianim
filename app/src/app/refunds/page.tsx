import type { Metadata } from "next";
import { LegalPage } from "@/components/features/legal-document";
import { REFUNDS } from "@/lib/legal";

export const metadata: Metadata = { title: "מדיניות ביטולים והחזרים — משפיען אונליין" };

export default function RefundsPage() {
  return <LegalPage doc={REFUNDS} />;
}
