// src/components/Terrain.tsx
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import * as THREE from "three";
import { decodeQuantizedMesh, type DecodedMesh } from "../lib/quantizedMesh";

interface Props {
  zoom: number;
  x: number;
  y: number;
}

export function Terrain({ zoom, x, y }: Props) {
  const [mesh, setMesh] = useState<DecodedMesh | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Rust returns Vec<u8> which lands in JS as number[] or Uint8Array.
        const bytes = await invoke<number[]>("get_terrain_tile", { zoom, x, y });
        const buf = new Uint8Array(bytes).buffer;
        const decoded = decodeQuantizedMesh(buf);
        if (!cancelled) setMesh(decoded);
        console.log(`Tile ${zoom}/${x}/${y}:`, decoded);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [zoom, x, y]);

  if (error) return <mesh><boxGeometry /><meshBasicMaterial color="red" /></mesh>;
  if (!mesh) return null;

  return (
    <mesh>
      <bufferGeometry
        onUpdate={(g) => {
          g.setAttribute("position", new THREE.BufferAttribute(mesh.positions, 3));
          g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
          g.computeVertexNormals();
          g.computeBoundingSphere();
        }}
      />
      <meshStandardMaterial color="#8B7355" flatShading side={THREE.DoubleSide} />
    </mesh>
  );
}