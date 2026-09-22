import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import * as THREE from "three";

const METERS_PER_DEG_LAT = 110_540;
const metersPerDegLon = (lat: number) => 111_320 * Math.cos((lat * Math.PI) / 180);

export function Terrain({ stride }: { stride: number }) {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [stats, setStats] = useState<string>("");

  useEffect(() => {
    let alive = true;
    const t0 = performance.now();
    console.log(`[dem] loading stride=${stride}`);
    invoke<ArrayBuffer>("load_dem_mesh", { stride })
      .then((buf) => {
        if (!alive) return;
        const view = new DataView(buf);
        const width  = view.getUint32(0, true);    // bytes 0-3
        const height = view.getUint32(4, true);    // bytes 4-7
        const west   = view.getFloat64(8, true);   // bytes 8-15
        const south  = view.getFloat64(16, true);  // bytes 16-23
        const east   = view.getFloat64(24, true);  // bytes 24-31
        const north  = view.getFloat64(32, true);  // bytes 32-39
        const heights = new Float32Array(buf, 40, width * height);  // ← 40, not 32

        const midLat = (south + north) / 2;
        const widthM = (east - west) * metersPerDegLon(midLat);
        const depthM = (north - south) * METERS_PER_DEG_LAT;

        const positions = new Float32Array(width * height * 3);
        let minH = Infinity, maxH = -Infinity;
        for (let j = 0; j < height; j++) {
          for (let i = 0; i < width; i++) {
            const idx = (j * width + i) * 3;
            positions[idx]     = (i / (width - 1) - 0.5) * widthM;
            positions[idx + 1] = heights[j * width + i];
            positions[idx + 2] = (0.5 - j / (height - 1)) * depthM;
            if (positions[idx + 1] < minH) minH = positions[idx + 1];
            if (positions[idx + 1] > maxH) maxH = positions[idx + 1];
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
        setGeometry(g);

        const ms = (performance.now() - t0).toFixed(0);
        const info = `${width}×${height} = ${(width * height / 1e6).toFixed(2)}M verts, ` +
                     `elev ${minH.toFixed(0)}–${maxH.toFixed(0)} m, ${ms} ms`;
        console.log(`[dem] ${info}`);
        setStats(info);
      })
      .catch((e) => console.error("[dem] failed:", e));
    return () => { alive = false; };
  }, [stride]);

  useEffect(() => () => { geometry?.dispose(); }, [geometry]);

  if (!geometry) return null;

  return (
    <>
      <mesh geometry={geometry}>
        <meshStandardMaterial color="#8B7355" side={THREE.DoubleSide} />
      </mesh>
      {/* Debug text via DOM — handled in App, this is just for context */}
    </>
  );
}