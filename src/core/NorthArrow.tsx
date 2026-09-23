// src/core/NorthArrow.tsx
import { Html } from "@react-three/drei";
import { useDem } from "./DemContext";
import { sampleElevation } from "./dem";

interface Props {
  visible?: boolean;
  /** World-space anchor. Defaults to a spot south-west of the valley, on the hills. */
  position?: [number, number];
  /** Total length of the arrow shaft + head in meters. */
  length?: number;
}

export function NorthArrow({
  visible = true,
  position,
  length = 600,
}: Props) {
  const { dem } = useDem();
  if (!dem || !visible) return null;

  const [px, pz] = position ?? [-8_000, -25_000];
  const py = sampleElevation(dem, px, pz);

  const shaftLen = length * 0.66;
  const headLen  = length - shaftLen;
  const shaftW   = length * 0.12;
  const headW    = length * 0.22;

  // Layout: shaft spans z=0..shaftLen, head spans z=shaftLen..length.
  const shaftCenterZ = -shaftLen / 2;
  const headCenterZ  = -(shaftLen + headLen / 2);

  return (
    <group position={[px, py + 6, pz]}>
      {/* Shaft */}
      <mesh position={[0, 0, shaftCenterZ]}>
        <boxGeometry args={[shaftW, 6, shaftLen]} />
        <meshStandardMaterial color="#c0392b" />
      </mesh>
      {/* Head (cone rotated so apex points +Z = north) */}
      <mesh position={[0, 0, headCenterZ]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[headW, headLen, 4]} />
        <meshStandardMaterial color="#c0392b" />
      </mesh>
      {/* "N" label at the tip */}
      <Html
        position={[0, 40, -length + 40]}
        center
        zIndexRange={[5, 0]}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        <div
          style={{
            background: "#c0392b",
            color: "#fff",
            fontWeight: 800,
            fontFamily: "system-ui, sans-serif",
            fontSize: 12,
            borderRadius: 4,
            padding: "1px 6px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
          }}
        >
          N
        </div>
      </Html>
    </group>
  );
}