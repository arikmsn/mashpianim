import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "משפיען אונליין — הפלטפורמה הישראלית ליוצרי תוכן UGC";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
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
          background: "linear-gradient(135deg, #833AB4 0%, #E1306C 35%, #F77737 65%, #FCAF45 100%)",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 140,
            height: 140,
            borderRadius: 32,
            background: "rgba(255,255,255,0.2)",
            marginBottom: 32,
          }}
        >
          <span style={{ fontSize: 90, fontWeight: 800, color: "white" }}>M</span>
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 800,
            color: "white",
            marginBottom: 16,
            direction: "rtl",
          }}
        >
          משפיען אונליין
        </div>
        <div
          style={{
            fontSize: 28,
            color: "rgba(255,255,255,0.9)",
            direction: "rtl",
            textAlign: "center",
            maxWidth: 800,
          }}
        >
          הפלטפורמה הישראלית לחיבור יוצרי תוכן עם מותגים
        </div>
        <div
          style={{
            fontSize: 22,
            color: "rgba(255,255,255,0.7)",
            direction: "rtl",
            marginTop: 12,
          }}
        >
          מוצרים בחינם בתמורה לסרטונים אותנטיים
        </div>
      </div>
    ),
    { ...size }
  );
}
