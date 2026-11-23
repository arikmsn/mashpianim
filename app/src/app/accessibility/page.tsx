import type { Metadata } from "next";
import { LegalPage } from "@/components/features/legal-document";
import { getSiteContent } from "@/lib/site-content-server";

export const revalidate = 60;

// Public (listed in the middleware's public routes): Israeli law requires the statement to be reachable by anyone
export async function generateMetadata(): Promise<Metadata> {
  const { content } = await getSiteContent();
  return { title: `${content.legal_accessibility.title} | ${content.home_nav.brand_name}` };
}

export default async function AccessibilityPage() {
  const { content } = await getSiteContent();
  return <LegalPage slug="accessibility" content={content} />;
}
