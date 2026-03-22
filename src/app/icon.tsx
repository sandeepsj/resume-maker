import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          background: "#2563eb",
          borderRadius: 7,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 5,
        }}
      >
        {/* Document shape */}
        <div
          style={{
            width: 18,
            height: 22,
            background: "white",
            borderRadius: 2,
            display: "flex",
            flexDirection: "column",
            padding: "3px 3px",
            gap: 2,
            position: "relative",
          }}
        >
          {/* Folded corner */}
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: 5,
              height: 5,
              background: "#2563eb",
              borderBottomLeftRadius: 2,
            }}
          />
          {/* Text lines */}
          <div style={{ width: "85%", height: 2, background: "#2563eb", borderRadius: 1, marginTop: 4 }} />
          <div style={{ width: "100%", height: 2, background: "#bfdbfe", borderRadius: 1 }} />
          <div style={{ width: "100%", height: 2, background: "#bfdbfe", borderRadius: 1 }} />
          <div style={{ width: "70%", height: 2, background: "#bfdbfe", borderRadius: 1 }} />
          <div style={{ width: "100%", height: 2, background: "#bfdbfe", borderRadius: 1 }} />
          <div style={{ width: "80%", height: 2, background: "#bfdbfe", borderRadius: 1 }} />
        </div>
      </div>
    ),
    { ...size }
  );
}
