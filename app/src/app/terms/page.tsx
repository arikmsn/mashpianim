import type { Metadata } from "next";
import { LegalPage } from "@/components/features/legal-document";
import { TERMS } from "@/lib/legal";

export const metadata: Metadata = { title: "תנאי השירות — משפיען אונליין" };

// The wording lives in lib/legal.ts (shared with the in-app acceptance gate and the side-menu viewer)
export default function TermsPage() {
  return <LegalPage doc={TERMS} />;
}
