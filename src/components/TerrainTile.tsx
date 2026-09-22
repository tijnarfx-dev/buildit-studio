// src/components/TerrainTile.tsx
import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import * as THREE from "three";
import { tileWorldBounds } from "../lib/tileMath";
import { addSkirts } from "../lib/addSkirts";


interface Props { z: number; x: number; y: number; }

export function TerrainTile({ z, x, y }: Props) {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);

  // Add near the top of the file:
  const TILE_OVERLAP = 0.02; // 1% extra, i.e. ~25 m at zoom 12

  useEffect(() => {
    let alive = true;
    invoke<ArrayBuffer>("get_terrain_tile_mesh", { zoom: z, x, y })
      .then((buf) => {
        if (!alive) return;
        const view = new DataView(buf);
        const vcount = view.getUint32(0, true);
        const icount = view.getUint32(4, true);

        if (vcount < 3 || icount < 3) {
          // Empty or degenerate tile — nothing to render
          return;
        }

        const rawPos = new Float32Array(buf, 8, vcount * 3);
        const rawIdx = new Uint32Array(buf, 8 + vcount * 12, icount);
        
        // Skirt depth: 150 m is plenty — bigger than any plausible crack,
        // small enough not to poke through neighbouring valleys.
        // const { positions, indices } = addSkirts(rawPos.slice(), rawIdx.slice(), 150);
        const { positions, indices } = addSkirts(rawPos.slice(), rawIdx.slice(), 500);
        
        // DataView slices reference the same buffer; safe as long as we don't
        // mutate the original. Copy to own the memory:
        
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        g.setIndex(new THREE.BufferAttribute(indices, 1));
        g.computeVertexNormals();
        g.computeBoundingSphere();
        setGeometry(g);

      })
      .catch((e) => console.warn(`tile ${z}/${x}/${y} failed:`, e));
    return () => { alive = false; };
  }, [z, x, y]);

  useEffect(() => () => { geometry?.dispose(); }, [geometry]);

  const world = useMemo(() => tileWorldBounds(z, x, y), [z, x, y]);

  if (!geometry) return null;

  return (
    // Then in the return:
    <mesh
      geometry={geometry}
      position={[world.centerX, 0, world.centerZ]}
      scale={[
        (world.sizeX / 2) * (1 + TILE_OVERLAP),
        1,
        (world.sizeZ / 2) * (1 + TILE_OVERLAP),
      ]}
    >
      <meshStandardMaterial color="#8B7355" side={THREE.DoubleSide} />
    </mesh>
  );
}