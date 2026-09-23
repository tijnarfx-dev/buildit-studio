// src/core/CameraHUD.tsx
import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { altitudeStore, headingStore } from "./hudStores";

const _dir = new THREE.Vector3();

/**
 * Must be placed INSIDE <Canvas>. Pushes camera altitude + heading to the
 * shared stores at ~15 Hz (no per-frame React re-renders).
 */
export function CameraReporter() {
  const { camera } = useThree();
  const lastPush = useRef(0);

  useFrame((_, delta) => {
    lastPush.current += delta;
    if (lastPush.current < 1 / 15) return;
    lastPush.current = 0;

    altitudeStore.set(camera.position.y);

    camera.getWorldDirection(_dir);
    const headingRad = Math.atan2(_dir.x, _dir.z); // 0 = north (+Z), +east
    const deg = (THREE.MathUtils.radToDeg(headingRad) + 360) % 360;
    headingStore.set(deg);
  });

  return null;
}

export function CameraHUD({
  groundElevation,
}: {
  groundElevation: number | null;
}) {
  const [alt, setAlt] = useState(altitudeStore.value);

  useEffect(() => altitudeStore.subscribe(setAlt), []);

  const altAboveGround =
    groundElevation != null ? Math.max(0, alt - groundElevation) : null;

  const fmt = (m: number) =>
    Math.abs(m) >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m.toFixed(0)} m`;

  return (
    <div style={hudBoxStyle}>
      <div style={hudRowStyle}>
        <span style={hudLabelStyle}>Altitude</span>
        <span style={hudValueStyle}>{fmt(alt)}</span>
      </div>
      {altAboveGround != null && (
        <div style={hudRowStyle}>
          <span style={hudLabelStyle}>Above ground</span>
          <span style={hudValueStyle}>{fmt(altAboveGround)}</span>
        </div>
      )}
    </div>
  );
}

export function CompassRose() {
  const [heading, setHeading] = useState(headingStore.value);
  useEffect(() => headingStore.subscribe(setHeading), []);

  const ticks = [];
  for (let i = 0; i < 24; i++) {
    const a = i * 15;
    const isCardinal = a % 90 === 0;
    const isMajor = a % 45 === 0;
    const r1 = 34;
    const r2 = isCardinal ? 23 : isMajor ? 27 : 30;
    const rad = ((a - 90) * Math.PI) / 180;
    ticks.push(
      <line
        key={i}
        x1={Math.cos(rad) * r1}
        y1={Math.sin(rad) * r1}
        x2={Math.cos(rad) * r2}
        y2={Math.sin(rad) * r2}
        stroke="#333"
        strokeWidth={isCardinal ? 1.5 : 0.6}
      />,
    );
  }

  return (
    <div style={compassBoxStyle}>
      <svg width={76} height={76} viewBox="-38 -38 76 76">
        <circle
          r={35}
          fill="rgba(255,255,255,0.92)"
          stroke="#333"
          strokeWidth={1}
        />
        <g transform={`rotate(${-heading})`}>
          {ticks}
          <text
            x={0}
            y={-25}
            textAnchor="middle"
            fontSize={11}
            fontWeight={700}
            fill="#c0392b"
          >
            N
          </text>
          <text x={25} y={4} textAnchor="middle" fontSize={9} fill="#333">
            E
          </text>
          <text x={0} y={32} textAnchor="middle" fontSize={9} fill="#333">
            S
          </text>
          <text x={-25} y={4} textAnchor="middle" fontSize={9} fill="#333">
            W
          </text>
        </g>
        <polygon points="0,-35 -4,-29 4,-29" fill="#c0392b" />
      </svg>
      <div
        style={{
          fontSize: 10,
          textAlign: "center",
          color: "#666",
          marginTop: 2,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {heading.toFixed(0)}°
      </div>
    </div>
  );
}

// ---- styles ----
const hudBoxStyle: React.CSSProperties = {
  position: "absolute",
  bottom: 16,
  left: 16,
  zIndex: 10,
  background: "rgba(255, 255, 255, 0.92)",
  padding: "8px 12px",
  borderRadius: 6,
  fontFamily: "system-ui, sans-serif",
  fontSize: 12,
  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
  minWidth: 170,
  backdropFilter: "blur(4px)",
};

const hudRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "2px 0",
};

const hudLabelStyle: React.CSSProperties = { color: "#666" };

const hudValueStyle: React.CSSProperties = {
  fontWeight: 600,
  color: "#111",
  fontVariantNumeric: "tabular-nums",
};

const compassBoxStyle: React.CSSProperties = {
  position: "absolute",
  bottom: 16,
  right: 16,
  zIndex: 10,
  padding: 4,
  borderRadius: 40,
  background: "rgba(255,255,255,0.92)",
  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
  backdropFilter: "blur(4px)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
};