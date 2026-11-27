import type { MetadataRoute } from "next";
import { ROBOTS_DISALLOW, SITE_URL } from "@/lib/seo";

// /robots.txt: the public pages may be crawled, the signed-in area, the auth screens and the API may not.
// The middleware matcher skips robots.txt and sitemap.xml, so crawlers never meet a session redirect.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: [...ROBOTS_DISALLOW] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
