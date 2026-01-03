import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(circle at 30% 30%, rgba(34,211,238,0.35), rgba(0,0,0,0) 55%), radial-gradient(circle at 70% 70%, rgba(168,85,247,0.45), rgba(0,0,0,0) 60%), linear-gradient(135deg, #0b0b12 0%, #070a10 100%)",
        }}
      >
        <div
          style={{
            width: 152,
            height: 152,
            borderRadius: 46,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            border: "2px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.06)",
          }}
        >
          <div
            style={{
              width: 68,
              height: 68,
              borderRadius: 22,
              background: "linear-gradient(135deg, #a855f7 0%, #22d3ee 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#0b0b12",
              fontWeight: 900,
              fontSize: 42,
              lineHeight: 1,
            }}
          >
            A
          </div>
          <div
            style={{
              color: "white",
              fontSize: 26,
              fontWeight: 900,
              letterSpacing: -0.8,
            }}
          >
            AÇAI
          </div>
          <div
            style={{
              color: "rgba(255,255,255,0.75)",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 1.6,
              textTransform: "uppercase",
            }}
          >
            DA HORA
          </div>
        </div>
      </div>
    ),
    size,
  );
}

