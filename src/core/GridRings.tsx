// src/core/GridRings.tsx
import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useDem } from "./DemContext";
import { sampleElevation } from "./dem";

const RING_RADII_M = [1000, 5000, 10000];
const SEGMENTS = 96;
const ELEV_OFFSET = 8;

interface Ring {
  radius: number;
  geom: THREE.BufferGeometry;
}

export function GridRings({ visible = true }: { visible?: boolean }) {
  const { dem } = useDem();
  const controls = useThree((s) => s.controls) as
    | { target: THREE.Vector3 }
    | null;

  const rings: Ring[] | null = useMemo(() => {
    if (!dem) return null;
    return RING_RADII_M.map((radius) => {
      const geom = new THREE.BufferGeometry();
      geom.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(SEGMENTS * 3), 3),
      );
      geom.computeBoundingSphere();
      return { radius, geom };
    });
  }, [dem]);

  const lastCenter = useRef(new THREE.Vector3(NaN, 0, NaN));

  useFrame(() => {
    if (!dem || !rings) return;

    const cx = controls?.target.x ?? 0;
    const cz = controls?.target.z ?? 0;

    // Rebuild only if the target moved > 1 m.
    if (
      Math.abs(lastCenter.current.x - cx) < 1 &&
      Math.abs(lastCenter.current.z - cz) < 1
    )
      return;
    lastCenter.current.set(cx, 0, cz);

    for (const { radius, geom } of rings) {
      const attr = geom.attributes.position as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      for (let i = 0; i < SEGMENTS; i++) {
        const a = (i / SEGMENTS) * Math.PI * 2;
        const x = cx + Math.cos(a) * radius;
        const z = cz + Math.sin(a) * radius;
        const y = sampleElevation(dem, x, z) + ELEV_OFFSET;
        arr[i * 3] = x;
        arr[i * 3 + 1] = y;
        arr[i * 3 + 2] = z;
      }
      attr.needsUpdate = true;
      geom.computeBoundingSphere();
    }
  });

  if (!rings || !visible) return null;

  return (
    <>
      {rings.map(({ radius, geom }) => (
        <lineLoop key={radius} geometry={geom} frustumCulled={false}>
          <lineBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.55}
            depthWrite={false}
          />
        </lineLoop>
      ))}
    </>
  );
}