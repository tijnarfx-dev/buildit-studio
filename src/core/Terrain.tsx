// src/core/Terrain.tsx
import { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import * as THREE from "three";
import { useDem } from "./DemContext";
import { makeBounds, type DemData } from "./dem";

interface Props {
  stride: number;
  onPointerMove?: (world: THREE.Vector3) => void;
  onPointerOut?: () => void;
  onClick?: (world: THREE.Vector3) => void;
  onRightClick?: (world: THREE.Vector3) => void;
}

export function Terrain({ stride, onPointerMove, onPointerOut, onClick, onRightClick }: Props) {
  const { setDem } = useDem();
  const [geom, setGeom] = useState<THREE.BufferGeometry | null>(null);
  const downScreen = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let alive = true;
    const t0 = performance.now();
    console.log(`[dem] loading stride=${stride}`);

    invoke<ArrayBuffer>("load_dem_mesh", { stride })
      .then((buf) => {
        if (!alive) return;
        const view = new DataView(buf);
        const width  = view.getUint32(0, true);
        const height = view.getUint32(4, true);
        const west   = view.getFloat64(8, true);
        const south  = view.getFloat64(16, true);
        const east   = view.getFloat64(24, true);
        const north  = view.getFloat64(32, true);
        const heights = new Float32Array(buf, 40, width * height);

        const bounds = makeBounds(west, south, east, north);

        const positions = new Float32Array(width * height * 3);
        for (let j = 0; j < height; j++) {
          for (let i = 0; i < width; i++) {
            const idx = (j * width + i) * 3;
            positions[idx]     = (i / (width - 1) - 0.5) * bounds.widthM;
            positions[idx + 1] = heights[j * width + i];
            positions[idx + 2] = (0.5 - j / (height - 1)) * bounds.depthM;
          }
        }

        const indices = new Uint32Array((width - 1) * (height - 1) * 6);
        let k = 0;
        for (let j = 0; j < height - 1; j++) {
          for (let i = 0; i < width - 1; i++) {
            const a = j * width + i;
            const b = a + 1;
            const c = a + width;
            const d = c + 1;
            indices[k++] = a; indices[k++] = c; indices[k++] = b;
            indices[k++] = b; indices[k++] = c; indices[k++] = d;
          }
        }

        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        g.setIndex(new THREE.BufferAttribute(indices, 1));
        g.computeVertexNormals();
        g.computeBoundingSphere();
        (g as any).computeBoundsTree();   // ← BVH acceleration

        const data: DemData = { bounds, width, height, heights };
        setDem(data);
        setGeom(g);
        console.log(
          `[dem] ${width}×${height} loaded in ${(performance.now() - t0).toFixed(0)} ms`
        );
      })
      .catch((e) => console.error("[dem] failed:", e));

    return () => { alive = false; };
  }, [stride, setDem]);

  useEffect(() => () => { geom?.dispose(); }, [geom]);

  if (!geom) return null;

  return (
    <mesh
      geometry={geom}
      onPointerDown={(e) => {
        e.stopPropagation();
        downScreen.current = { x: e.clientX ?? 0, y: e.clientY ?? 0 };
      }}
      onPointerMove={(e) => { e.stopPropagation(); if (onPointerMove && e.point) onPointerMove(e.point.clone()); }}
      onPointerOut={() => onPointerOut?.()}
      onPointerUp={(e) => {
        e.stopPropagation();
        const d = downScreen.current;
        downScreen.current = null;
        if (!d) return;
        const dist = Math.hypot((e.clientX ?? 0) - d.x, (e.clientY ?? 0) - d.y);
        if (dist > 5) return;   // dragged → not a click
        if (onClick && e.point) onClick(e.point.clone());
      }}
      onContextMenu={(e) => {
        e.stopPropagation();
        if (onRightClick && e.point) onRightClick(e.point.clone());
      }}
    >
      <meshStandardMaterial color="#8B7355" side={THREE.DoubleSide} />
    </mesh>
  );
}
