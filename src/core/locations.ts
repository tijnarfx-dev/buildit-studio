// src/core/locations.ts
// Curated label list for Imphal Valley. lon/lat are WGS84 decimal degrees.
// Coordinates are approximate (±~500 m) — edit freely, hot-reloads in dev.

export type LocationKind = "city" | "town" | "district" | "landmark" | "lake";

export interface LocationLabel {
  id: string;
  name: string;
  lon: number;
  lat: number;
  kind: LocationKind;
}

export const LOCATIONS: LocationLabel[] = [
  // --- Core city + wards ---
  { id: "imphal",         name: "Imphal",            lon: 93.9442, lat: 24.8083, kind: "city"     },
  { id: "kangla",         name: "Kangla Fort",       lon: 93.9389, lat: 24.8069, kind: "landmark" },
  { id: "ima-keithel",    name: "Ima Keithel",       lon: 93.9436, lat: 24.8080, kind: "landmark" },
  { id: "uripok",         name: "Uripok",            lon: 93.9242, lat: 24.8092, kind: "district" },
  { id: "sagolband",      name: "Sagolband",         lon: 93.9181, lat: 24.7994, kind: "district" },
  { id: "thangmeiband",   name: "Thangmeiband",      lon: 93.9217, lat: 24.8144, kind: "district" },
  { id: "singjamei",      name: "Singjamei",         lon: 93.9194, lat: 24.7861, kind: "district" },
  { id: "kwakeithel",     name: "Kwakeithel",        lon: 93.9083, lat: 24.7917, kind: "district" },
  { id: "wangkei",        name: "Wangkhei",          lon: 93.9486, lat: 24.7950, kind: "district" },
  { id: "porompat",       name: "Porompat",          lon: 93.9711, lat: 24.7964, kind: "district" },
  { id: "mantripukhri",   name: "Mantripukhri",      lon: 93.9389, lat: 24.8311, kind: "town"     },

  // --- Towns in greater Imphal ---
  { id: "lilong",         name: "Lilong",            lon: 93.9667, lat: 24.6750, kind: "town"     },
  { id: "nambol",         name: "Nambol",            lon: 93.8361, lat: 24.7031, kind: "town"     },
  { id: "mayang-imphal",  name: "Mayang Imphal",     lon: 93.8750, lat: 24.6917, kind: "town"     },
  { id: "wangoi",         name: "Wangoi",            lon: 93.8833, lat: 24.7250, kind: "town"     },

  // --- District HQ / far valley ---
  { id: "bishnupur",      name: "Bishnupur",         lon: 93.7667, lat: 24.6333, kind: "town"     },
  { id: "moirang",        name: "Moirang",           lon: 93.7700, lat: 24.5000, kind: "town"     },
  { id: "thoubal",        name: "Thoubal",           lon: 94.0167, lat: 24.6333, kind: "town"     },
  { id: "kakching",       name: "Kakching",          lon: 93.9833, lat: 24.5000, kind: "town"     },
  { id: "sugnu",          name: "Sugnu",             lon: 93.9500, lat: 24.4667, kind: "town"     },

  // --- Landmarks ---
  { id: "imphal-airport", name: "Imphal Airport",    lon: 93.8967, lat: 24.7600, kind: "landmark" },
  { id: "loktak",         name: "Loktak Lake",       lon: 93.8000, lat: 24.5500, kind: "lake"     },
];