import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
            width: 420,
            height: 420,
            borderRadius: 120,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            border: "2px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.06)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
          }}
        >
          <div
            style={{
              width: 128,
              height: 128,
              borderRadius: 40,
              background: "linear-gradient(135deg, #a855f7 0%, #22d3ee 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#0b0b12",
              fontWeight: 900,
              fontSize: 72,
              lineHeight: 1,
            }}
          >
            A
          </div>
          <div
            style={{
              color: "white",
              fontSize: 54,
              fontWeight: 900,
              letterSpacing: -1.5,
            }}
          >
            AÇAI
          </div>
          <div
            style={{
              color: "rgba(255,255,255,0.75)",
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: 2,
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

