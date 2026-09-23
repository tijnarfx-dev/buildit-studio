// src/core/setupBVH.ts
import * as THREE from "three";
import {
  computeBoundsTree,
  disposeBoundsTree,
  acceleratedRaycast,
} from "three-mesh-bvh";

// Monkey-patch BufferGeometry + Mesh once, globally
(THREE.BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree;
(THREE.BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree;
(THREE.Mesh.prototype as any).raycast = acceleratedRaycast;

export const BVH_READY = true;