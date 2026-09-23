// src/core/CursorHUD.tsx
import { useEffect, useState } from "react";
import { cursorStore, type CursorInfo } from "./hudStores";

const fmtLat = (v: number) => `${Math.abs(v).toFixed(5)}° ${v >= 0 ? "N" : "S"}`;
const fmtLon = (v: number) => `${Math.abs(v).toFixed(5)}° ${v >= 0 ? "E" : "W"}`;

export function CursorHUD() {
  const [c, setC] = useState<CursorInfo>(cursorStore.value);
  useEffect(() => cursorStore.subscribe(setC), []);

  return (
    <div style={boxStyle}>
      <div style={rowStyle}>
        <span style={labelStyle}>World</span>
        <span style={valueStyle}>
          {c.active ? `${c.x.toFixed(0)}, ${c.z.toFixed(0)}` : "—"}
        </span>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>Lat</span>
        <span style={valueStyle}>{c.active ? fmtLat(c.lat) : "—"}</span>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>Lon</span>
        <span style={valueStyle}>{c.active ? fmtLon(c.lon) : "—"}</span>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>Slope</span>
        <span style={valueStyle}>
          {c.active ? `${c.slopeDeg.toFixed(1)}°` : "—"}
        </span>
      </div>
    </div>
  );
}

const boxStyle: React.CSSProperties = {
  position: "absolute",
  top: 12,
  right: 12,
  zIndex: 10,
  background: "rgba(255, 255, 255, 0.92)",
  padding: "8px 12px",
  borderRadius: 6,
  fontFamily: "system-ui, sans-serif",
  fontSize: 12,
  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
  minWidth: 190,
  backdropFilter: "blur(4px)",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "2px 0",
};

const labelStyle: React.CSSProperties = { color: "#666" };

const valueStyle: React.CSSProperties = {
  fontWeight: 600,
  color: "#111",
  fontVariantNumeric: "tabular-nums",
};