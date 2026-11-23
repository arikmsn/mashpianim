import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getSiteContent } from "@/lib/site-content-server";

// The share image (design package v3): dark ink ground, the signature pink-to-tangerine bar, the headline and the
// second line from the seo section of the content registry.
export const runtime = "nodejs";
export const revalidate = 3600;
export const alt = "Mashpian";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage() {
  const [logoData, { content }] = await Promise.all([readFile(join(process.cwd(), "public", "logo.png")), getSiteContent()]);
  const logoBase64 = `data:image/png;base64,${logoData.toString("base64")}`;
  const seo = content.seo;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(60% 50% at 50% 0%, #2e2745 0%, #0b051d 70%)",
          color: "#faf7f2",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <img src={logoBase64} width={140} height={140} style={{ borderRadius: 32, marginBottom: 28, boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }} />
        <div style={{ width: 64, height: 6, borderRadius: 999, background: "linear-gradient(135deg, #ff2e7e, #ff7a1a)", marginBottom: 24 }} />
        <div style={{ fontSize: 60, fontWeight: 800, direction: "rtl", textAlign: "center", maxWidth: 1000, lineHeight: 1.1 }}>{seo.og_image_text}</div>
        <div style={{ fontSize: 28, color: "rgba(250,247,242,0.75)", direction: "rtl", textAlign: "center", maxWidth: 900, marginTop: 18 }}>{seo.og_image_sub}</div>
      </div>
    ),
    { ...size }
  );
}
