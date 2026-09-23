// src/editions/community/PlacedBuildings.tsx
import React from "react";
import { findBuilding } from "./buildings";
import type { PlacedBuilding } from "./Community";

export const PlacedBuildings = React.memo(function PlacedBuildings({
  placed,
}: {
  placed: PlacedBuilding[];
}) {
  return (
    <>
      {placed.map((p) => {
        const def = findBuilding(p.typeId);
        if (!def) return null;
        return (
          <mesh
            key={p.id}
            position={[p.worldX, p.elevation + def.sizeY / 2, p.worldZ]}
            rotation={[0, p.rotationY, 0]}
          >
            <boxGeometry args={[def.sizeX, def.sizeY, def.sizeZ]} />
            <meshStandardMaterial color={def.color} />
          </mesh>
        );
      })}
    </>
  );
});