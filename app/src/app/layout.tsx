import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["latin", "hebrew"],
});

export const metadata: Metadata = {
  title: "Mashpian — יוצרים תוכן, מחברים מותגים",
  description:
    "הפלטפורמה הישראלית לחיבור יוצרי תוכן UGC עם מותגים ועסקים. מוצרים חינם בתמורה לסרטונים אותנטיים.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Mashpian",
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
