import type { Metadata } from "next";
import { getSiteContent } from "@/lib/site-content-server";
import { RegisterClient } from "./register-client";

// The registration screens, coloured by the account type (design package v3, AuthScreen). The texts come from
// the auth section of the content registry; the steps, fields and API calls live in register-client.tsx.
export const revalidate = 60;

// The tab title from the registry's SEO section (the layout default carries the old English tagline)
export async function generateMetadata(): Promise<Metadata> {
  const { content } = await getSiteContent();
  // The auth screens never belong in a search index (robots.txt disallows them too; a dead url redirects here)
  return { title: content.seo.title, description: content.seo.description, robots: { index: false, follow: false } };
}

export default async function RegisterPage() {
  const { content } = await getSiteContent();
  return <RegisterClient texts={content.auth} />;
}
