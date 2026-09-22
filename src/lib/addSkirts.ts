// src/lib/addSkirts.ts
export interface SkirtedGeometry {
  positions: Float32Array;
  indices: Uint32Array;
}

export function addSkirts(
  positions: Float32Array,
  indices: Uint32Array,
  skirtDepth: number,
): SkirtedGeometry {
  const vertCount = positions.length / 3;

  // Find actual mesh extents
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < vertCount; i++) {
    const x = positions[i * 3];
    const z = positions[i * 3 + 2];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }

  const spanX = Math.max(maxX - minX, 1e-6);
  const spanZ = Math.max(maxZ - minZ, 1e-6);
  const epsX = spanX * 0.01;  // 1% tolerance
  const epsZ = spanZ * 0.01;

  const sides: { N: number[]; S: number[]; E: number[]; W: number[] } =
    { N: [], S: [], E: [], W: [] };

  for (let i = 0; i < vertCount; i++) {
    const x = positions[i * 3];
    const z = positions[i * 3 + 2];
    if (Math.abs(x - minX) < epsX) sides.W.push(i);
    if (Math.abs(x - maxX) < epsX) sides.E.push(i);
    if (Math.abs(z - minZ) < epsZ) sides.N.push(i);
    if (Math.abs(z - maxZ) < epsZ) sides.S.push(i);
  }

  const extraPos: number[] = [];
  const extraIdx: number[] = [];

  const buildSkirt = (verts: number[], sortAxis: 0 | 2) => {
    if (verts.length < 2) return;
    verts.sort((a, b) => positions[a * 3 + sortAxis] - positions[b * 3 + sortAxis]);
    const base = vertCount + extraPos.length / 3;
    for (const i of verts) {
      extraPos.push(positions[i * 3], positions[i * 3 + 1] - skirtDepth, positions[i * 3 + 2]);
    }
    for (let i = 0; i < verts.length - 1; i++) {
      const a = verts[i], b = verts[i + 1];
      const c = base + i, d = base + i + 1;
      extraIdx.push(a, c, b);
      extraIdx.push(b, c, d);
    }
  };

  buildSkirt(sides.N, 0);
  buildSkirt(sides.S, 0);
  buildSkirt(sides.E, 2);
  buildSkirt(sides.W, 2);

  const outPos = new Float32Array(positions.length + extraPos.length);
  outPos.set(positions);
  outPos.set(extraPos, positions.length);

  const outIdx = new Uint32Array(indices.length + extraIdx.length);
  outIdx.set(indices);
  outIdx.set(extraIdx, indices.length);

  return { positions: outPos, indices: outIdx };
}