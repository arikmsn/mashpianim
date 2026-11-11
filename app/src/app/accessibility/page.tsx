import type { Metadata } from "next";
import { LegalPage } from "@/components/features/legal-document";
import { ACCESSIBILITY } from "@/lib/legal";

export const metadata: Metadata = { title: "הצהרת נגישות — משפיען אונליין" };

// Public (listed in the middleware's public routes) — Israeli law requires the statement to be reachable by anyone
export default function AccessibilityPage() {
  return <LegalPage doc={ACCESSIBILITY} />;
}
