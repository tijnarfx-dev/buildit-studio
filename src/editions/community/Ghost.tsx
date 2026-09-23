// src/editions/community/Ghost.tsx
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { findBuilding } from "./buildings";

interface Props {
  posRef: React.MutableRefObject<{ x: number; y: number; z: number; active: boolean }>;
  typeId: string | null;
  rotationY: number;
}

export function Ghost({ posRef, typeId, rotationY }: Props) {
  const meshRef = useRef<THREE.Mesh>(null);
  const def = typeId ? findBuilding(typeId) : null;

  useFrame(() => {
    const m = meshRef.current;
    if (!m || !def) return;
    const p = posRef.current;
    if (!p.active) { m.visible = false; return; }
    m.visible = true;
    m.position.set(p.x, p.y + def.sizeY / 2, p.z);
    m.rotation.y = rotationY;
  });

  if (!def) return null;

  return (
    <mesh ref={meshRef} visible={false}>
      <boxGeometry args={[def.sizeX, def.sizeY, def.sizeZ]} />
      <meshStandardMaterial
        color={def.color}
        transparent
        opacity={0.5}
        depthWrite={false}
      />
    </mesh>
  );
}