import Link from "next/link";
import Image from "next/image";
import { getSiteContent } from "@/lib/site-content-server";

// Hebrew, right-to-left 404 (Next's default is English and left-to-right). Texts: the errors section of the
// content registry.
export default async function NotFound() {
  const { content } = await getSiteContent();
  const t = content.errors;
  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-6" dir="rtl">
      {/* A missing page is never indexed (React hoists the meta into the head; not-found has no metadata export) */}
      <meta name="robots" content="noindex" />
      <div className="text-center max-w-sm">
        <Image src="/icon-192.png" alt="" width={72} height={72} unoptimized className="mx-auto rounded-2xl shadow-lg mb-5" />
        <p className="font-mono text-sm font-medium text-pink-700 mb-1">{t.not_found_tag}</p>
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">{t.not_found_title}</h1>
        <p className="text-sm text-neutral-500 mb-6">{t.not_found_body}</p>
        <div className="flex flex-col gap-2">
          <Link href="/feed" className="w-full px-6 py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary-hover transition-colors">
            {t.not_found_cta}
          </Link>
          <Link href="/" className="w-full px-6 py-3 rounded-xl bg-white border border-border-strong text-ink-900 font-semibold hover:border-ink-900 transition-colors">
            {t.not_found_cta_home}
          </Link>
        </div>
      </div>
    </main>
  );
}
