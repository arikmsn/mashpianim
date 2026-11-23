import { NextResponse, type NextRequest } from "next/server";
import { parsePersona } from "@/lib/persona";

// The web app manifest per account type (owner, 2026-11-23: a business that installs the app must open on its
// own pink login, a creator on the lemon one). The static public/manifest.json stays the default; the page swaps
// the <link rel="manifest"> to this route once the device knows its persona (components/features/manifest-link).
const BASE = {
  name: "משפיען אונליין",
  short_name: "משפיען אונליין",
  description: "הפלטפורמה הישראלית לחיבור יוצרי תוכן UGC עם מותגים. מוצרים בחינם בתמורה לסרטונים אותנטיים.",
  scope: "/",
  display: "standalone",
  orientation: "portrait",
  dir: "rtl",
  lang: "he",
  prefer_related_applications: false,
  categories: ["social", "shopping", "business"],
  icons: [
    { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
    { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};

export async function GET(request: NextRequest) {
  const persona = parsePersona(request.nextUrl.searchParams.get("persona"));
  const manifest = persona === "creator"
    ? { ...BASE, id: "/feed?app=creator", start_url: "/feed", theme_color: "#ffd84d", background_color: "#fff8df" }
    : persona === "brand"
      ? { ...BASE, id: "/brand?app=brand", start_url: "/brand", theme_color: "#dc1363", background_color: "#fff0f5" }
      : { ...BASE, id: "/feed", start_url: "/feed", theme_color: "#dc1363", background_color: "#dc1363" };
  return NextResponse.json(manifest, {
    headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" },
  });
}
