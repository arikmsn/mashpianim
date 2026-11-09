import type { Metadata } from "next";
import { LegalPage } from "@/components/features/legal-document";
import { PRIVACY } from "@/lib/legal";

export const metadata: Metadata = { title: "מדיניות הפרטיות — משפיען אונליין" };

export default function PrivacyPage() {
  return <LegalPage doc={PRIVACY} />;
}
