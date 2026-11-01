import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["latin", "hebrew"],
});

export const metadata: Metadata = {
  title: "משפיען אונליין | Mashpian — יוצרים תוכן, מחברים מותגים",
  description:
    "הפלטפורמה הישראלית לחיבור יוצרי תוכן UGC עם מותגים ועסקים. קבלו מוצרים בחינם בתמורה לסרטונים אותנטיים. הצטרפו עכשיו!",
  manifest: "/manifest.json",
  metadataBase: new URL("https://www.mashpian.online"),
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
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/logo.png", sizes: "512x512", type: "image/png" },
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
  themeColor: "#E1306C",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
