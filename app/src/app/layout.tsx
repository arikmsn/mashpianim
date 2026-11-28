import type { Metadata, Viewport } from "next";
import { Rubik, IBM_Plex_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Providers } from "./providers";
import "./globals.css";

// Design system v3 (2026-11-23): Rubik carries every word (400/500 body, 700 headings and buttons, 900 display);
// IBM Plex Mono is reserved for digits and Latin tags, so it needs no Hebrew subset.
const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["latin", "hebrew"],
  weight: ["400", "500", "700", "900"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "משפיען אונליין | Mashpian — יוצרים תוכן, מחברים מותגים",
  description:
    "הפלטפורמה הישראלית לחיבור יוצרי תוכן UGC עם מותגים ועסקים. קבלו מוצרים בחינם בתמורה לסרטונים אותנטיים. הצטרפו עכשיו!",
  manifest: "/manifest.json",
  metadataBase: new URL("https://www.mashpian.online"),
  // Google Drive / Googleusercontent refuse hotlinked images when a Referer is sent; nothing in the app
  // needs outgoing referrers, so none are sent (same-origin API calls are unaffected)
  referrer: "no-referrer",
  openGraph: {
    type: "website",
    locale: "he_IL",
    url: "https://www.mashpian.online",
    siteName: "משפיען אונליין",
    title: "משפיען אונליין — הפלטפורמה הישראלית ליוצרי תוכן UGC",
    description:
      "חיבור יוצרי תוכן עם מותגים מובילים. מוצרים בחינם בתמורה לסרטונים אותנטיים. הצטרפו לקהילה!",
  },
  twitter: {
    card: "summary_large_image",
    title: "משפיען אונליין | Mashpian",
    description:
      "הפלטפורמה הישראלית ליוצרי תוכן UGC — מוצרים בחינם בתמורה לסרטונים אותנטיים",
  },
  keywords: [
    "יוצרי תוכן",
    "UGC",
    "משפיענים",
    "שיווק משפיענים",
    "מותגים",
    "תוכן אותנטי",
    "ישראל",
    "סרטונים",
    "שיתופי פעולה",
    "מוצרים חינם",
  ],
  robots: {
    index: true,
    follow: true,
  },
  // All icon files are generated from public/logo.png (see docs/HANDOFF.md §4 "Branding assets")
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "משפיען אונליין",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#dc1363",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className={`${rubik.variable} ${plexMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans bg-background text-foreground touch-manipulation">
        <Providers>{children}</Providers>
        {/* Vercel Web Analytics (owner, 2026-11-28): page views and referrers, cookie-free, enabled per project in
            the Vercel dashboard; inactive outside Vercel (local builds) */}
        <Analytics />
      </body>
    </html>
  );
}
