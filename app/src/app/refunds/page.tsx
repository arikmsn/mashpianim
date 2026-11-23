import type { Metadata } from "next";
import { LegalPage } from "@/components/features/legal-document";
import { getSiteContent } from "@/lib/site-content-server";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const { content } = await getSiteContent();
  return { title: `${content.legal_refunds.title} | ${content.home_nav.brand_name}` };
}

export default async function RefundsPage() {
  const { content } = await getSiteContent();
  return <LegalPage slug="refunds" content={content} />;
}
