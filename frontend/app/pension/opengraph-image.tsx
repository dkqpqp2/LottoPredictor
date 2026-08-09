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
          background: "linear-gradient(160deg, #081128 0%, #0f1b3d 45%, #16264d 100%)",
        }}
      >
        <div
          style={{
            fontSize: 100,
            fontWeight: 800,
            color: "#ff8f4d",
            letterSpacing: -3,
          }}
        >
          연금복권720+
        </div>
        <div
          style={{
            fontSize: 40,
            color: "#eef1f8",
            marginTop: 16,
          }}
        >
          조 1~5 · 6자리 번호 뽑기
        </div>
      </div>
    ),
    { ...size }
  );
}
