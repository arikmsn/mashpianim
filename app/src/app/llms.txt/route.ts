import { llmsTxt } from "@/lib/seo";
import { getSiteContent } from "@/lib/site-content-server";

// /llms.txt (https://llmstxt.org): what the site is, for AI crawlers and assistants, built from the content
// registry (organization, about facts, the FAQ pairs, the public pages). The middleware matcher skips it so an
// anonymous crawler is never redirected to /login. Rebuilt at most once an hour.
export const revalidate = 3600;

export async function GET() {
  const { content } = await getSiteContent();
  return new Response(llmsTxt(content), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
