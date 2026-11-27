import { serializeJsonLd, type JsonLd } from "@/lib/seo";

// Structured data for search engines and AI crawlers (schema.org JSON-LD). A server component: the graph is
// built from the content registry on the server and inlined into the HTML.
export function JsonLd({ data }: { data: JsonLd }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
