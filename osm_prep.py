"""
Preprocess OpenStreetMap data for Imphal Valley into a bundled GeoJSON overlay.

Run once on a dev machine with internet:
    python osm_prep.py

Outputs:
    src-tauri/resources/osm/imphal_osm.geojson
    src-tauri/resources/osm/imphal_osm.meta.json

To force a fresh Overpass query, delete:
    osm_cache/overpass_raw.json

Attribution: © OpenStreetMap contributors, ODbL 1.0 — see NOTICE.md
"""
from __future__ import annotations

import json
import math
import time
import urllib.parse
import urllib.request
from pathlib import Path

from shapely.geometry import LineString

# ---------------------------------------------------------------------------
# Bounds — must match src-tauri/src/terrain.rs (west/south/east/north).
# ---------------------------------------------------------------------------
WEST  = 92.9998611
SOUTH = 23.9998611
EAST  = 95.0004166
NORTH = 25.0001389

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

ROAD_CLASSES = [
    "motorway", "trunk", "primary", "secondary",
    "tertiary", "unclassified", "residential", "service",
]
WATER_CLASSES = ["river", "stream", "canal"]

# Simplification tolerances (meters). Bigger → smaller file, less detail.
SIMPLIFY_ROADS_M = 10.0
SIMPLIFY_WATER_M = 25.0
SIMPLIFY_RAIL_M  = 15.0

OUT_DIR     = Path("src-tauri/resources/osm")
OUT_GEOJSON = OUT_DIR / "imphal_osm.geojson"
OUT_META    = OUT_DIR / "imphal_osm.meta.json"
CACHE_RAW   = Path("osm_cache/overpass_raw.json")

COORD_DECIMALS = 5   # ~1 m at this latitude


# ---------------------------------------------------------------------------
# Overpass
# ---------------------------------------------------------------------------
def build_query() -> str:
    bbox = f"{SOUTH},{WEST},{NORTH},{EAST}"
    roads_re = "|".join(ROAD_CLASSES)
    water_re = "|".join(WATER_CLASSES)
    return f"""
[out:json][timeout:180];
(
  way["highway"~"^({roads_re})$"]({bbox});
  way["waterway"~"^({water_re})$"]({bbox});
  way["railway"="rail"]({bbox});
);
out geom;
""".strip()


def fetch_overpass() -> dict:
    if CACHE_RAW.exists():
        print(f"[osm] using cached response: {CACHE_RAW}")
        return json.loads(CACHE_RAW.read_text())

    q = build_query()
    print(f"[osm] querying Overpass ({len(q)} chars)...")
    body = urllib.parse.urlencode({"data": q}).encode()
    req = urllib.request.Request(
        OVERPASS_URL,
        data=body,
        headers={
            "User-Agent": "buildit-studio-osm-prep/0.1 (offline desktop app)",
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=240) as r:
        raw = r.read()
    print(f"[osm] got {len(raw) / 1e6:.2f} MB in {time.time() - t0:.1f}s")

    CACHE_RAW.parent.mkdir(parents=True, exist_ok=True)
    CACHE_RAW.write_bytes(raw)
    return json.loads(raw)


# ---------------------------------------------------------------------------
# Classification
# ---------------------------------------------------------------------------
def classify(tags: dict) -> tuple[str, str] | None:
    hw = tags.get("highway")
    ww = tags.get("waterway")
    rw = tags.get("railway")

    if hw in ROAD_CLASSES:
        tier = "major" if hw in ("motorway", "trunk", "primary", "secondary") else "minor"
        return ("road", tier)
    if ww in WATER_CLASSES:
        return ("water", ww)
    if rw == "rail":
        return ("rail", "rail")
    return None


# ---------------------------------------------------------------------------
# Geometry
# ---------------------------------------------------------------------------
def way_coords_lonlat(way: dict):
    geom = way.get("geometry")
    if not geom:
        return None
    pts = [(g["lon"], g["lat"]) for g in geom if "lon" in g and "lat" in g]
    return pts if len(pts) >= 2 else None


def simplify_lonlat(coords, tol_m: float):
    """Simplify a lon/lat polyline with a tolerance given in meters."""
    mean_lat = sum(c[1] for c in coords) / len(coords)
    mlon = 111_320.0 * math.cos(math.radians(mean_lat))
    mlat = 110_540.0

    line = LineString([(x * mlon, y * mlat) for (x, y) in coords])
    s = line.simplify(tol_m, preserve_topology=True)
    if s.is_empty or s.geom_type != "LineString" or len(s.coords) < 2:
        return None

    inv_lon, inv_lat = 1.0 / mlon, 1.0 / mlat
    r = COORD_DECIMALS
    return [[round(x * inv_lon, r), round(y * inv_lat, r)] for (x, y) in s.coords]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    data = fetch_overpass()
    elems = data.get("elements", [])
    print(f"[osm] {len(elems)} elements from Overpass")

    features: list[dict] = []
    counts: dict[tuple[str, str], int] = {}
    verts_in = verts_out = 0

    for el in elems:
        if el.get("type") != "way":
            continue
        tags = el.get("tags") or {}
        cls = classify(tags)
        if cls is None:
            continue
        kind, subkind = cls

        coords = way_coords_lonlat(el)
        if coords is None:
            continue

        tol = (
            SIMPLIFY_ROADS_M if kind == "road"
            else SIMPLIFY_WATER_M if kind == "water"
            else SIMPLIFY_RAIL_M
        )
        simple = simplify_lonlat(coords, tol)
        if simple is None:
            continue

        verts_in += len(coords)
        verts_out += len(simple)

        features.append({
            "type": "Feature",
            "properties": {
                "kind": kind,
                "subkind": subkind,
                "name": tags.get("name"),
                "ref": tags.get("ref"),
            },
            "geometry": {"type": "LineString", "coordinates": simple},
        })
        counts[(kind, subkind)] = counts.get((kind, subkind), 0) + 1

    print(f"[osm] kept {len(features)} features")
    print(f"[osm] vertices: {verts_in:,} -> {verts_out:,} "
          f"({100 * verts_out / max(1, verts_in):.1f}%)")
    for k in sorted(counts):
        print(f"       {k[0]:5s} {k[1]:12s} {counts[k]:6d}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    OUT_GEOJSON.write_text(
        json.dumps({"type": "FeatureCollection", "features": features},
                   separators=(",", ":")),
        encoding="utf-8",
    )

    meta = {
        "source": "OpenStreetMap via Overpass API",
        "overpass_url": OVERPASS_URL,
        "extracted_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "bbox": {"west": WEST, "south": SOUTH, "east": EAST, "north": NORTH},
        "attribution": "© OpenStreetMap contributors, ODbL 1.0",
        "license_url": "https://opendatacommons.org/licenses/odbl/1-0/",
        "feature_counts": {f"{k[0]}/{k[1]}": v for k, v in counts.items()},
        "simplify_tolerance_m": {
            "road": SIMPLIFY_ROADS_M, "water": SIMPLIFY_WATER_M, "rail": SIMPLIFY_RAIL_M,
        },
    }
    OUT_META.write_text(json.dumps(meta, indent=2), encoding="utf-8")

    print(f"[osm] wrote {OUT_GEOJSON} ({OUT_GEOJSON.stat().st_size / 1e6:.2f} MB)")
    print(f"[osm] wrote {OUT_META}")


if __name__ == "__main__":
    main()