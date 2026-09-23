// src/editions/community/buildings.ts
export interface BuildingType {
  id: string;
  name: string;
  color: string;
  sizeX: number; // meters
  sizeY: number;
  sizeZ: number;
  cost: number;
}

export const BUILDINGS: BuildingType[] = [
  { id: "road",    name: "Road",    color: "#404040", sizeX: 30, sizeY: 0.5, sizeZ: 30, cost: 10  },
  { id: "house",   name: "House",   color: "#c8a47e", sizeX: 25, sizeY: 12,  sizeZ: 25, cost: 100 },
  { id: "shop",    name: "Shop",    color: "#d29a3a", sizeX: 30, sizeY: 15,  sizeZ: 30, cost: 250 },
  { id: "factory", name: "Factory", color: "#7d8794", sizeX: 50, sizeY: 20,  sizeZ: 40, cost: 800 },
];

export const findBuilding = (id: string) =>
  BUILDINGS.find((b) => b.id === id);