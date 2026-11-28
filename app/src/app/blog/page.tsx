import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SITE_URL, blogJsonLd, blogPosts } from "@/lib/seo";
import { getSiteContent } from "@/lib/site-content-server";
import { JsonLd } from "@/components/home/json-ld";
import { container, display, eyebrow } from "@/components/home/styles";

// /blog: the content hub (2026-11-27). The list and every label come from the `blog` section of the content
// registry (/admin/content, the blog tab); only published articles are listed, in the admin's order, without dates. Public
// (middleware publicRoutes) and in the sitemap, with a Blog node in the JSON-LD graph.
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const { content } = await getSiteContent();
  const blog = content.blog;
  return {
    title: blog.meta_title,
    description: blog.meta_description,
    alternates: { canonical: "/blog", languages: { "he-IL": "/blog" } },
    openGraph: { title: blog.meta_title, description: blog.meta_description, type: "website", locale: "he_IL", url: `${SITE_URL}/blog` },
  };
}

export default async function BlogIndexPage() {
  const { content } = await getSiteContent();
  const blog = content.blog;
  const posts = blogPosts(content);
  return (
    <main className="min-h-screen bg-canvas text-ink-900">
      <JsonLd data={blogJsonLd(content)} />
      <div className={cn(container, "py-10 md:py-16")}>
        <Link href="/" className="inline-flex items-center gap-1 text-sm font-medium text-pink-700 hover:underline">
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
          {blog.back_home}
        </Link>

        <header className="mt-8 max-w-[820px]">
          <span className={eyebrow}>{blog.eyebrow}</span>
          <h1 className={cn(display, "mt-3 text-[32px] leading-[1.1] md:text-[48px] md:leading-[1.08]")}>{blog.title}</h1>
          {blog.subtitle && <p className="mt-4 text-base leading-relaxed text-ink-700 md:mt-5 md:text-lg">{blog.subtitle}</p>}
        </header>

        {posts.length === 0 ? (
          <p className="mt-10 text-ink-700">{blog.empty}</p>
        ) : (
          <ul className="mt-8 grid grid-cols-1 gap-4 md:mt-12 md:grid-cols-2 md:gap-5">
            {posts.map((p) => (
              <li key={p.slug} className="flex h-full flex-col rounded-3xl border border-border bg-surface p-6 md:p-7">
                <h2 className="font-display text-[22px] leading-tight text-ink-900 md:text-[26px]">
                  <Link href={`/blog/${p.slug}`} className="hover:text-pink-700">
                    {p.title}
                  </Link>
                </h2>
                {p.excerpt && <p className="mt-3 flex-1 text-[15px] leading-relaxed text-ink-700">{p.excerpt}</p>}
                <Link href={`/blog/${p.slug}`} className="mt-5 inline-flex items-center gap-1.5 self-start text-sm font-semibold text-pink-700 hover:underline">
                  {blog.read_more}
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
