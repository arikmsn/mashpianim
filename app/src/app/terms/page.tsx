import type { Metadata } from "next";
import { LegalPage } from "@/components/features/legal-document";
import { getSiteContent } from "@/lib/site-content-server";

export const revalidate = 60;

// The wording lives in the content registry (defaults from lib/legal.ts), edited in /admin/content
export async function generateMetadata(): Promise<Metadata> {
  const { content } = await getSiteContent();
  return { title: `${content.legal_terms.title} | ${content.home_nav.brand_name}` };
}

export default async function TermsPage() {
  const { content } = await getSiteContent();
  return <LegalPage slug="terms" content={content} />;
}
