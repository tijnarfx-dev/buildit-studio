// src/lib/quantizedMesh.ts
// Minimal decoder for Cesium quantized-mesh-1.0.
// Returns positions (Float32Array, xyz) and indices (Uint32Array).

export interface DecodedMesh {
  positions: Float32Array; // xyz interleaved, centered at (0,0,0)
  indices: Uint32Array;
  minHeight: number;
  maxHeight: number;
  center: [number, number, number];
}

const MAGIC = "quantized-mesh-1.0";

function readMagic(view: DataView): string {
  let s = "";
  for (let i = 0; i < 24; i++) {
    const c = view.getUint8(i);
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
}

const zigZag = (v: number) => (v >> 1) ^ (-(v & 1));

export function decodeQuantizedMesh(buffer: ArrayBufferLike): DecodedMesh {
  const view = new DataView(buffer);
  const magic = readMagic(view);
  if (magic !== MAGIC) throw new Error(`Bad magic: "${magic}"`);

  let offset = 24;
  const version = view.getUint32(offset, true); offset += 4;
  if (version !== 1) throw new Error(`Unsupported version ${version}`);

  const vertexCount = view.getUint32(offset, true); offset += 4;
  const triangleCount = view.getUint32(offset, true); offset += 4;

  // Header (unchanged from spec):
  const centerX = view.getFloat64(offset, true); offset += 8;
  const centerY = view.getFloat64(offset, true); offset += 8;
  const centerZ = view.getFloat64(offset, true); offset += 8;
  const minHeight = view.getFloat32(offset, true); offset += 4;
  const maxHeight = view.getFloat32(offset, true); offset += 4;

  // Skip bounding sphere (center[3] + radius) = 32 bytes
  offset += 32;
  // Skip horizon occlusion point (3 doubles) = 24 bytes
  offset += 24;

  // ----- Vertex data -----
  // u, v, height arrays — each u16, delta + zigzag encoded
  const u = new Uint16Array(buffer, offset, vertexCount);
  offset += vertexCount * 2;
  const v = new Uint16Array(buffer, offset, vertexCount);
  offset += vertexCount * 2;
  const h = new Uint16Array(buffer, offset, vertexCount);
  offset += vertexCount * 2;

  const uu = new Uint16Array(vertexCount);
  const vv = new Uint16Array(vertexCount);
  const hh = new Uint16Array(vertexCount);

  let uSum = 0, vSum = 0, hSum = 0;
  for (let i = 0; i < vertexCount; i++) {
    uSum += zigZag(u[i]); uu[i] = uSum & 0xffff;
    vSum += zigZag(v[i]); vv[i] = vSum & 0xffff;
    hSum += zigZag(h[i]); hh[i] = hSum & 0xffff;
  }

  // ----- Index data -----
  // High-water-mark decode. uint16 if vertexCount < 65536, else uint32.
  const use32 = vertexCount > 65536;
  const rawIndexCount = triangleCount * 3;
  let rawIndices: Uint16Array | Uint32Array;

  if (use32) {
    // Align to 4 bytes
    if (offset % 4 !== 0) offset += 4 - (offset % 4);
    rawIndices = new Uint32Array(buffer, offset, rawIndexCount);
    offset += rawIndexCount * 4;
  } else {
    rawIndices = new Uint16Array(buffer, offset, rawIndexCount);
    offset += rawIndexCount * 2;
  }

  const indices = new Uint32Array(rawIndexCount);
  let highest = 0;
  for (let i = 0; i < rawIndexCount; i++) {
    const code = rawIndices[i];
    indices[i] = highest - code;
    if (code === 0) highest++;
  }

  // ----- Build positions -----
  // Quantized u,v map [0,65535] -> [0,1] across the tile.
  // Heights map [0,32767] -> [minHeight, maxHeight].
  // We normalize to a [-1,1] x [-1,1] x [h0,h1] box for simplicity.
  const positions = new Float32Array(vertexCount * 3);
  const heightRange = maxHeight - minHeight;
  for (let i = 0; i < vertexCount; i++) {
    const x = (uu[i] / 65535) * 2 - 1;
    const y = (vv[i] / 65535) * 2 - 1;
    const z = minHeight + (hh[i] / 32767) * heightRange;
    positions[i * 3 + 0] = x;
    positions[i * 3 + 1] = z; // scale down meters for scene
    positions[i * 3 + 2] = y;
  }

  return {
    positions,
    indices,
    minHeight,
    maxHeight,
    center: [centerX, centerY, centerZ],
  };
}