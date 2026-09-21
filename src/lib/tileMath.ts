// src/lib/tileMath.ts
// Local ENU (East-North-Up) frame centered on the valley.
// Three.js convention: X = east, Y = up (elevation), Z = -north (so camera looking -Z faces north).

export const VALLEY_CENTER_LON = 94.0;
export const VALLEY_CENTER_LAT = 25.0;

const METERS_PER_DEG_LAT = 110_540;
export function metersPerDegLon(latDeg: number): number {
  return 111_320 * Math.cos((latDeg * Math.PI) / 180);
}

export interface LonLatBounds { west: number; south: number; east: number; north: number; }

/**
 * Cesium geodetic TMS (GeographicTilingScheme):
 *   level 0 = 2 tiles in X (180° lon each) × 1 tile in Y (180° lat each)
 *   level z = 2^(z+1) tiles in X, 2^z tiles in Y
 *   → lonSpan = latSpan = 180 / 2^z
 */
export function tileBounds(z: number, x: number, y: number): LonLatBounds {
  const lonSpan = 180 / 2 ** z;
  const latSpan = 180 / 2 ** z;
  const west = -180 + x * lonSpan;
  const south = -90 + y * latSpan;
  return { west, south, east: west + lonSpan, north: south + latSpan };
}

export interface WorldBounds {
  west: number; east: number;
  north: number; south: number;
  centerX: number; centerZ: number;
  sizeX: number; sizeZ: number;
}

/** Convert a TMS tile to world-space AABB in meters. */
export function tileWorldBounds(z: number, x: number, y: number): WorldBounds {
  const b = tileBounds(z, x, y);
  const mLon = metersPerDegLon((b.north + b.south) / 2);

  const west  = (b.west  - VALLEY_CENTER_LON) * mLon;
  const east  = (b.east  - VALLEY_CENTER_LON) * mLon;
  // Y-up, right-handed: north is -Z
  const north = -(b.north - VALLEY_CENTER_LAT) * METERS_PER_DEG_LAT;
  const south = -(b.south - VALLEY_CENTER_LAT) * METERS_PER_DEG_LAT;

  return {
    west, east, north, south,
    centerX: (west + east) / 2,
    centerZ: (north + south) / 2,
    sizeX: east - west,
    sizeZ: south - north, // positive
  };
}