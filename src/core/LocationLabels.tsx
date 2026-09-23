// src/core/LocationLabels.tsx
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { useDem } from "./DemContext";
import { lonLatToWorld, sampleElevation } from "./dem";
import { LOCATIONS, type LocationKind } from "./locations";

const STYLE: Record<
  LocationKind,
  { bg: string; fg: string; border: string; weight: number; font: number }
> = {
  city:     { bg: "#ffffff", fg: "#111",    border: "#222",    weight: 700, font: 12 },
  town:     { bg: "#ffffff", fg: "#222",    border: "#777",    weight: 600, font: 11 },
  district: { bg: "#f6f6f6", fg: "#333",    border: "#aaa",    weight: 500, font: 10 },
  landmark: { bg: "#fffbe6", fg: "#7a5c00", border: "#d4a800", weight: 600, font: 11 },
  lake:     { bg: "#e8f4fb", fg: "#0b5a8a", border: "#3a9ad9", weight: 600, font: 11 },
};

const ELEV_OFFSET = 50; // meters above terrain

export function LocationLabels({ visible = true }: { visible?: boolean }) {
  const { dem } = useDem();
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as
    | { target: THREE.Vector3; update: () => void }
    | null;

  if (!dem || !visible) return null;

  const handleClick = (x: number, y: number, z: number) => {
    if (!controls) return;
    const delta = new THREE.Vector3(x, y, z).sub(controls.target);
    controls.target.add(delta);
    camera.position.add(delta);
    controls.update();
  };

  return (
    <>
      {LOCATIONS.map((loc) => {
        const { x, z } = lonLatToWorld(dem.bounds, loc.lon, loc.lat);
        const groundY = sampleElevation(dem, x, z);
        const y = groundY + ELEV_OFFSET;
        const s = STYLE[loc.kind];
        return (
          <Html
            key={loc.id}
            position={[x, y, z]}
            center
            zIndexRange={[5, 0]}
            style={{ pointerEvents: "none", userSelect: "none" }}
          >
            <div
              onClick={(e) => {
                e.stopPropagation();
                handleClick(x, groundY, z);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                background: s.bg,
                color: s.fg,
                border: `1px solid ${s.border}`,
                borderRadius: 4,
                padding: "1px 6px",
                fontFamily: "system-ui, sans-serif",
                fontSize: s.font,
                fontWeight: s.weight,
                lineHeight: 1.25,
                whiteSpace: "nowrap",
                boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                cursor: "pointer",
                pointerEvents: "auto",
              }}
              title={`${loc.name} — ${loc.lat.toFixed(4)}N, ${loc.lon.toFixed(4)}E (click to focus)`}
            >
              {loc.name}
            </div>
          </Html>
        );
      })}
    </>
  );
}