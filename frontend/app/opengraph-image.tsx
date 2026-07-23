import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
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
          background: "linear-gradient(160deg, #0b0730 0%, #1a103d 45%, #2a1454 100%)",
        }}
      >
        <div
          style={{
            fontSize: 140,
            fontWeight: 800,
            color: "#e0b84f",
            letterSpacing: -4,
          }}
        >
          로타로
        </div>
        <div
          style={{
            fontSize: 40,
            color: "#ece7fb",
            marginTop: 16,
          }}
        >
          로또 통계 &amp; 타로 운세
        </div>
      </div>
    ),
    { ...size }
  );
}
