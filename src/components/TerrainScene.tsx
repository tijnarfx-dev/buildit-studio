// src/components/TerrainScene.tsx
import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { TerrainTile } from "./TerrainTile";

interface TileCoord { z: number; x: number; y: number; }

export function TerrainScene({ zoom }: { zoom: number }) {
  const [all, setAll] = useState<TileCoord[]>([]);

  useEffect(() => {
    invoke<TileCoord[]>("list_tiles")
      .then((tiles) => {
        console.log(`Loaded ${tiles.length} tile coords`);
        setAll(tiles);
      })
      .catch((e) => console.error("list_tiles failed:", e));
  }, []);

  const visible = useMemo(() => all.filter((t) => t.z === zoom), [all, zoom]);

  return (
    <group>
      {visible.map((t) => (
        <TerrainTile key={`${t.z}/${t.x}/${t.y}`} z={t.z} x={t.x} y={t.y} />
      ))}
    </group>
  );
}