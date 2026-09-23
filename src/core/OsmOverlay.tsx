// src/core/OsmOverlay.tsx
import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import * as THREE from "three";
import { useDem } from "./DemContext";
import { lonLatToWorld, sampleElevation } from "./dem";

interface GeoFeature {
  type: "Feature";
  properties: {
    kind: "road" | "water" | "rail";
    subkind: string;
    name: string | null;
    ref: string | null;
  };
  geometry: { type: "LineString"; coordinates: [number, number][] };
}
interface GeoFC { type: "FeatureCollection"; features: GeoFeature[]; }

type RGB = [number, number, number];
const ROAD_MAJOR: RGB = [1.00, 0.72, 0.25];
const ROAD_MINOR: RGB = [0.95, 0.88, 0.60];
const WATER:      RGB = [0.15, 0.55, 0.85];
const RAIL:       RGB = [0.28, 0.28, 0.30];

const pickColor = (kind: string, subkind: string): RGB =>
  kind === "road"  ? (subkind === "major" ? ROAD_MAJOR : ROAD_MINOR) :
  kind === "water" ? WATER :
  kind === "rail"  ? RAIL : [1, 1, 1];

export interface OsmVisibility { roads: boolean; water: boolean; rail: boolean; }

interface Props {
  visible?: OsmVisibility;
  elevationOffset?: number;
}

type Bucket = "roads" | "water" | "rail";

export function OsmOverlay({
  visible = { roads: true, water: true, rail: false },
  elevationOffset = 6,
}: Props) {
  const { dem } = useDem();
  const [raw, setRaw] = useState<GeoFC | null>(null);

  useEffect(() => {
    invoke<string>("load_osm_geojson")
      .then((s) => {
        const t0 = performance.now();
        const fc = JSON.parse(s) as GeoFC;
        console.log(
          `[osm] parsed ${fc.features.length} features in ${(performance.now() - t0).toFixed(0)} ms`
        );
        setRaw(fc);
      })
      .catch((e) => console.error("[osm] load failed:", e));
  }, []);

  const built = useMemo(() => {
    if (!raw || !dem) return null;
    const t0 = performance.now();

    const posB: Record<Bucket, number[]> = { roads: [], water: [], rail: [] };
    const colB: Record<Bucket, number[]> = { roads: [], water: [], rail: [] };
    let segs = 0;

    for (const f of raw.features) {
      const { kind, subkind } = f.properties;
      const key: Bucket = kind === "road" ? "roads" : kind === "water" ? "water" : "rail";
      const [r, g, b] = pickColor(kind, subkind);
      const coords = f.geometry.coordinates;

      for (let i = 0; i < coords.length - 1; i++) {
        const [lon0, lat0] = coords[i];
        const [lon1, lat1] = coords[i + 1];
        const w0 = lonLatToWorld(dem.bounds, lon0, lat0);
        const w1 = lonLatToWorld(dem.bounds, lon1, lat1);
        const y0 = sampleElevation(dem, w0.x, w0.z) + elevationOffset;
        const y1 = sampleElevation(dem, w1.x, w1.z) + elevationOffset;

        posB[key].push(w0.x, y0, w0.z, w1.x, y1, w1.z);
        colB[key].push(r, g, b, r, g, b);
        segs++;
      }
    }

    const geoms: Partial<Record<Bucket, THREE.BufferGeometry>> = {};
    for (const key of ["roads", "water", "rail"] as const) {
      if (posB[key].length === 0) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(posB[key], 3));
      g.setAttribute("color", new THREE.Float32BufferAttribute(colB[key], 3));
      g.computeBoundingSphere();
      geoms[key] = g;
    }

    console.log(
      `[osm] built ${segs} segments ` +
      `(roads=${posB.roads.length / 6}, water=${posB.water.length / 6}, rail=${posB.rail.length / 6}) ` +
      `in ${(performance.now() - t0).toFixed(0)} ms`
    );
    return geoms;
  }, [raw, dem, elevationOffset]);

  useEffect(() => {
    return () => { if (built) for (const g of Object.values(built)) g.dispose(); };
  }, [built]);

  if (!built) return null;

  return (
    <>
      {(["roads", "water", "rail"] as const).map((key) => {
        const g = built[key];
        if (!g) return null;
        return (
          <lineSegments key={key} geometry={g} visible={visible[key]}>
            <lineBasicMaterial
              vertexColors
              transparent
              opacity={0.95}
              depthWrite={false}
            />
          </lineSegments>
        );
      })}
    </>
  );
}