// // src/components/TerrainTile.tsx
// import { useEffect, useMemo, useState } from "react";
// import { invoke } from "@tauri-apps/api/core";
// import * as THREE from "three";
// import { decodeQuantizedMesh, type DecodedMesh } from "../lib/quantizedMesh";
// import { tileWorldBounds } from "../lib/tileMath";

// interface Props { z: number; x: number; y: number; }

// export function TerrainTile({ z, x, y }: Props) {
//   const [mesh, setMesh] = useState<DecodedMesh | null>(null);

//   useEffect(() => {
//   let alive = true;
//   invoke<number[] | ArrayBuffer>("get_terrain_tile", { zoom: z, x, y })
//     .then((res) => {
//       if (!alive) return;

//       // `Response::new(Vec<u8>)` in Tauri v2 arrives as ArrayBuffer.
//       // Older `Result<Vec<u8>, _>` arrives as number[].
//       const bytes: Uint8Array =
//         res instanceof ArrayBuffer
//           ? new Uint8Array(res)
//           : new Uint8Array(res as number[]);

//       const head = Array.from(bytes.slice(0, 16))
//         .map((b) => b.toString(16).padStart(2, "0"))
//         .join(" ");
//       console.log(`tile ${z}/${x}/${y}: ${bytes.byteLength} bytes, head=[${head}]`);

//       const decoded = decodeQuantizedMesh(bytes.buffer);
//       setMesh(decoded);
//     })
//     .catch((e) => console.warn(`tile ${z}/${x}/${y} failed:`, e));
//   return () => { alive = false; };
// }, [z, x, y]);

//   const geometry = useMemo(() => {
//     if (!mesh) return null;
//     const g = new THREE.BufferGeometry();
//     g.setAttribute("position", new THREE.BufferAttribute(mesh.positions, 3));
//     g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
//     g.computeVertexNormals();
//     return g;
//   }, [mesh]);

//   const world = useMemo(() => tileWorldBounds(z, x, y), [z, x, y]);

//   // Dispose GPU resources when tile unmounts
//   useEffect(() => () => { geometry?.dispose(); }, [geometry]);

//   if (!geometry) return null;

//   return (
//     <mesh
//       geometry={geometry}
//       position={[world.centerX, 0, world.centerZ]}
//       scale={[world.sizeX / 2, 1, world.sizeZ / 2]}
//     >
//       <meshStandardMaterial color="#8B7355" flatShading side={THREE.DoubleSide} />
//     </mesh>
//   );
// }


// src/components/TerrainTile.tsx
import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import * as THREE from "three";
import { tileWorldBounds } from "../lib/tileMath";

interface Props { z: number; x: number; y: number; }

export function TerrainTile({ z, x, y }: Props) {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);

  useEffect(() => {
    let alive = true;
    invoke<ArrayBuffer>("get_terrain_tile_mesh", { zoom: z, x, y })
      .then((buf) => {
        if (!alive) return;
        const view = new DataView(buf);
        const vcount = view.getUint32(0, true);
        const icount = view.getUint32(4, true);
        const posStart = 8;
        const idxStart = posStart + vcount * 12;

        const positions = new Float32Array(buf, posStart, vcount * 3);
        const indices   = new Uint32Array(buf, idxStart, icount);

        // DataView slices reference the same buffer; safe as long as we don't
        // mutate the original. Copy to own the memory:
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(positions.slice(), 3));
        g.setIndex(new THREE.BufferAttribute(indices.slice(), 1));
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
    <mesh
      geometry={geometry}
      position={[world.centerX, 0, world.centerZ]}
      scale={[world.sizeX / 2, 1, world.sizeZ / 2]}
    >      
      <meshStandardMaterial color="#8B7355" side={THREE.DoubleSide} />
    </mesh>
  );
}