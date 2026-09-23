// src/core/dem.ts
// Coordinate system: world origin at DEM center.
//   +X = east (meters)
//   +Y = elevation (meters, absolute)
//   +Z = north (meters)   [note: this matches the Terrain mesh orientation]

export const METERS_PER_DEG_LAT = 110_540;
export const metersPerDegLon = (lat: number) =>
  111_320 * Math.cos((lat * Math.PI) / 180);

export interface DemBounds {
  west: number;
  south: number;
  east: number;
  north: number;
  centerLon: number;
  centerLat: number;
  widthM: number;
  depthM: number;
}

export interface DemData {
  bounds: DemBounds;
  width: number;
  height: number;
  heights: Float32Array; // row-major, north → south
}

export function makeBounds(
  west: number, south: number, east: number, north: number
): DemBounds {
  const centerLon = (west + east) / 2;
  const centerLat = (south + north) / 2;
  const mLon = metersPerDegLon(centerLat);
  return {
    west, south, east, north,
    centerLon, centerLat,
    widthM: (east - west) * mLon,
    depthM: (north - south) * METERS_PER_DEG_LAT,
  };
}

export function worldToLonLat(b: DemBounds, x: number, z: number) {
  const mLon = metersPerDegLon(b.centerLat);
  return {
    lon: b.centerLon + x / mLon,
    lat: b.centerLat - z / METERS_PER_DEG_LAT,
  };
}

export function lonLatToWorld(b: DemBounds, lon: number, lat: number) {
  const mLon = metersPerDegLon(b.centerLat);
  return {
    x: (lon - b.centerLon) * mLon,
    z: (b.centerLat - lat) * METERS_PER_DEG_LAT,
  };
}

/** Sample DEM elevation at world (x,z) using bilinear interpolation. */
export function sampleElevation(dem: DemData, x: number, z: number): number {
  const { bounds, width, height, heights } = dem;
  const u = (x / bounds.widthM) + 0.5;   // [0,1] from west to east
  const v = 0.5 + (z / bounds.depthM);   // [0,1] from north to south

  const fx = Math.min(Math.max(u, 0), 1) * (width - 1);
  const fy = Math.min(Math.max(v, 0), 1) * (height - 1);

  const x0 = Math.floor(fx), x1 = Math.min(x0 + 1, width - 1);
  const y0 = Math.floor(fy), y1 = Math.min(y0 + 1, height - 1);
  const tx = fx - x0, ty = fy - y0;

  const h00 = heights[y0 * width + x0];
  const h10 = heights[y0 * width + x1];
  const h01 = heights[y1 * width + x0];
  const h11 = heights[y1 * width + x1];

  return (
    h00 * (1 - tx) * (1 - ty) +
    h10 * tx * (1 - ty) +
    h01 * (1 - tx) * ty +
    h11 * tx * ty
  );
}

/** Snap a world coordinate to a metric grid of `size` meters. */
export const snapToGrid = (v: number, size: number) =>
  Math.round(v / size) * size;