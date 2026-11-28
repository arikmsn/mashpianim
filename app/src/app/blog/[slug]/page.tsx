import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { articleJsonLd, blogPost, blogPosts, blogUrl } from "@/lib/seo";
import { getSiteContent } from "@/lib/site-content-server";
import { JsonLd } from "@/components/home/json-ld";
import { Markdown } from "@/components/features/markdown";
import { container, display, eyebrow, pillCreator, pillPrimary } from "@/components/home/styles";

// /blog/[slug]: one article from the registry's blog list (published only; anything else is a 404). The body is
// the Markdown subset of lib/markdown.ts, rendered by components/features/markdown.tsx; the labels, the author
// line and the registration block come from the `blog` section. BlogPosting JSON-LD, canonical, article OG.
export const revalidate = 60;

const REGISTER_BRAND = "/register?type=brand";
const REGISTER_CREATOR = "/register?type=creator";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const { content } = await getSiteContent();
  const post = blogPost(content, slug);
  if (!post) return { title: content.errors.not_found_title, robots: { index: false, follow: false } };
  const brand = content.home_nav.brand_name;
  return {
    title: `${post.title} | ${brand}`,
    description: post.excerpt,
    alternates: { canonical: `/blog/${post.slug}`, languages: { "he-IL": `/blog/${post.slug}` } },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      locale: "he_IL",
      url: blogUrl(post.slug),
      authors: [brand],
    },
    twitter: { card: "summary_large_image", title: post.title, description: post.excerpt },
  };
}

export default async function BlogPostPage({ params }: Params) {
  const { slug } = await params;
  const { content } = await getSiteContent();
  const post = blogPost(content, slug);
  if (!post) notFound();
  const blog = content.blog;
  const more = blogPosts(content)
    .filter((p) => p.slug !== post.slug)
    .slice(0, 3);
  return (
    <main className="min-h-screen bg-canvas text-ink-900">
      <JsonLd data={articleJsonLd(content, post)} />
      <article className={cn(container, "py-10 md:py-16")}>
        <Link href="/blog" className="inline-flex items-center gap-1 text-sm font-medium text-pink-700 hover:underline">
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
          {blog.back_blog}
        </Link>

        <header className="mt-8 max-w-[820px]">
          <span className={eyebrow}>{blog.eyebrow}</span>
          <h1 className={cn(display, "mt-3 text-[30px] leading-[1.12] md:text-[44px] md:leading-[1.08]")}>{post.title}</h1>
          {post.excerpt && <p className="mt-4 text-base leading-relaxed text-ink-700 md:mt-5 md:text-lg">{post.excerpt}</p>}
          <p className="mt-4 text-[13px] text-neutral-600 md:text-sm">{blog.author_label}</p>
        </header>

        <div className="mt-8 max-w-[760px] md:mt-12">
          <Markdown
            source={post.body}
            className="text-[17px] [&_h2]:mt-9 [&_h2]:font-display [&_h2]:text-[24px] [&_h2]:leading-tight [&_h2]:text-ink-900 [&_h2]:md:text-[28px] [&_h3]:mt-6 [&_h3]:text-[19px] [&_h3]:text-ink-900 [&_p]:text-ink-700 [&_li]:text-ink-700"
          />
        </div>

        <aside className="mt-12 rounded-3xl border border-pink-200 bg-pink-50 p-6 md:mt-16 md:p-8">
          <h2 className={cn(display, "text-[22px] leading-tight md:text-[26px]")}>{blog.cta_title}</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-700 md:text-base">{blog.cta_text}</p>
          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:gap-3">
            <Link href={REGISTER_BRAND} className={pillPrimary}>
              {blog.cta_brand}
            </Link>
            <Link href={REGISTER_CREATOR} className={pillCreator}>
              {blog.cta_creator}
            </Link>
          </div>
        </aside>

        {more.length > 0 && (
          <section className="mt-12 md:mt-16" aria-labelledby="more-title">
            <h2 id="more-title" className={cn(display, "text-[22px] leading-tight md:text-[26px]")}>
              {blog.more_title}
            </h2>
            <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
              {more.map((p) => (
                <li key={p.slug} className="rounded-2xl border border-border bg-surface p-5">
                  <Link href={`/blog/${p.slug}`} className="font-display text-[18px] leading-tight text-ink-900 hover:text-pink-700">
                    {p.title}
                  </Link>
                  {p.excerpt && <p className="mt-2 text-sm leading-relaxed text-ink-700">{p.excerpt}</p>}
                  <Link href={`/blog/${p.slug}`} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-pink-700 hover:underline">
                    {blog.read_more}
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </main>
  );
}
