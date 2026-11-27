import type { MetadataRoute } from "next";
import { sitemapEntries } from "@/lib/seo";
import { loadSiteContentRows } from "@/lib/site-content-server";

// /sitemap.xml: the public pages (lib/seo.ts PUBLIC_PAGES) dated by the admin's last save of their registry
// sections. Rebuilt at most once an hour.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { meta } = await loadSiteContentRows();
  const updatedAt: Record<string, string | null> = {};
  for (const [section, m] of Object.entries(meta)) updatedAt[section] = m.updated_at;
  return sitemapEntries(updatedAt);
}
