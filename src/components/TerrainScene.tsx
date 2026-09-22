// src/components/TerrainScene.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import { invoke } from "@tauri-apps/api/core";
import { TerrainTile } from "./TerrainTile";
import { tileWorldBounds } from "../lib/tileMath";

interface TileCoord { z: number; x: number; y: number; }

const CULL_RADIUS_M = 80_000;       // was 20_000 — covers the full 1° DEM
const MOVE_THRESHOLD_M = 2_000;     // was 1_000
const POLL_INTERVAL_MS = 300;

export function TerrainScene({ zoom }: { zoom: number }) {
  const [all, setAll] = useState<TileCoord[]>([]);
  const [cameraXZ, setCameraXZ] = useState<[number, number]>([0, 0]);
  const { camera } = useThree();
  const last = useRef<[number, number]>([Infinity, Infinity]);

  // Load tile index once
  useEffect(() => {
    invoke<TileCoord[]>("list_tiles")
      .then((tiles) => {
        console.log(`Loaded ${tiles.length} tile coords`);
        setAll(tiles);
      })
      .catch((e) => console.error("list_tiles failed:", e));
  }, []);

  // Poll camera position; only trigger re-cull when it moves enough
  useEffect(() => {
    const id = setInterval(() => {
      const { x, z } = camera.position;
      const [lx, lz] = last.current;
      if (Math.hypot(x - lx, z - lz) > MOVE_THRESHOLD_M) {
        last.current = [x, z];
        setCameraXZ([x, z]);
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [camera]);

  // Filter to visible tiles
  const visible = useMemo(() => {
    const [cx, cz] = cameraXZ;
    const r2 = CULL_RADIUS_M * CULL_RADIUS_M;
    return all.filter((t) => {
      if (t.z !== zoom) return false;
      const w = tileWorldBounds(t.z, t.x, t.y);
      const dx = w.centerX - cx;
      const dz = w.centerZ - cz;
      const halfDiag = Math.hypot(w.sizeX, w.sizeZ) * 0.5;
      const edge = Math.max(0, Math.hypot(dx, dz) - halfDiag);
      return edge * edge <= r2;
    });
  }, [all, zoom, cameraXZ]);

  useEffect(() => {
  console.log(`[cull] zoom ${zoom}: ${visible.length} tiles visible`);
}, [visible.length, zoom]);

  return (
    <group>
      {visible.map((t) => (
        <TerrainTile key={`${t.z}/${t.x}/${t.y}`} z={t.z} x={t.x} y={t.y} />
      ))}
    </group>
  );
}