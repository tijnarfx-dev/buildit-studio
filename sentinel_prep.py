"""
Preprocess Sentinel-2 L2A tiles into a single 4096² JPEG aligned with the DEM.
"""
import numpy as np
import rasterio
from rasterio.merge import merge
from rasterio.warp import reproject, Resampling
from rasterio.transform import from_bounds as transform_from_bounds
from pathlib import Path
from PIL import Image

# ---- Configuration ----
# SAFE_DIR    = Path(r"C:\Users\John\data\imphal_valley\copernicus\sentinel2")
# DEM_PATH    = Path(r"D:\John\data\imphal_valley\copernicus\dem\imphal_merged_dem.tif")
# OUT_PATH    = Path(r"src-tauri\resources\dem\imphal_texture.jpg")

SAFE_DIR = Path("/mnt/c/users/john/data/imphal_valley/copernicus/sentinel2")
DEM_PATH = Path("/mnt/c/users/john/data/imphal_valley/copernicus/dem/imphal_full.tif")
OUT_PATH = Path("src-tauri/resources/dem/imphal_texture.jpg")
TARGET_SIZE = 4096

# ---- 1. DEM bounds (crop target) ----
with rasterio.open(DEM_PATH) as dem:
    dem_bounds = dem.bounds
    print(f"DEM bounds: {dem_bounds}")
    print(f"DEM CRS:    {dem.crs}")

# ---- 2. Find band files ----
def find_band(band):
    return [
        m for m in SAFE_DIR.glob(f"**/*_{band}_10m.jp2")
        if "PREVIEW" not in m.name.upper()
    ]

reds   = find_band("B04")
greens = find_band("B03")
blues  = find_band("B02")
scls   = [m for m in SAFE_DIR.glob("**/*_SCL_20m.jp2") if "PREVIEW" not in m.name.upper()]

print(f"B04 tiles: {len(reds)}  B03: {len(greens)}  B02: {len(blues)}  SCL: {len(scls)}")
if not (reds and greens and blues):
    raise SystemExit("Missing bands.")

# ---- 3. Mosaic ----
def mosaic(paths):
    srcs = [rasterio.open(p) for p in paths]
    arr, transform = merge(srcs)
    crs = srcs[0].crs
    for s in srcs:
        s.close()
    return arr[0].astype(np.float32), transform, crs

red,   src_transform, src_crs = mosaic(reds)
green, _, _                   = mosaic(greens)
blue,  _, _                   = mosaic(blues)
scl,   _, _                   = mosaic(scls) if scls else (None, None, None)

print(f"Mosaic: {red.shape}, CRS: {src_crs}")

# ---- 4. Reproject to WGS84 at DEM bounds ----
dst_crs = "EPSG:4326"
dst_transform = transform_from_bounds(
    dem_bounds.left, dem_bounds.bottom, dem_bounds.right, dem_bounds.top,
    TARGET_SIZE, TARGET_SIZE,
)

def reproject_band(src_arr, resampling):
    dst = np.zeros((TARGET_SIZE, TARGET_SIZE), dtype=np.float32)
    reproject(
        source=src_arr,
        destination=dst,
        src_transform=src_transform,
        src_crs=src_crs,
        src_nodata=None,
        dst_transform=dst_transform,
        dst_crs=dst_crs,
        dst_nodata=0,
        resampling=resampling,
    )
    return dst

red_ll   = reproject_band(red,   Resampling.bilinear)
green_ll = reproject_band(green, Resampling.bilinear)
blue_ll  = reproject_band(blue,  Resampling.bilinear)

if scl is not None:
    scl_ll = reproject_band(scl, Resampling.nearest).astype(np.uint8)
    cloud_mask = np.isin(scl_ll, [3, 8, 9, 10])
    print(f"Cloud/shadow: {100*cloud_mask.mean():.1f}%")
else:
    cloud_mask = np.zeros_like(red_ll, dtype=bool)

# ---- 5. Composite + contrast stretch ----
rgb = np.stack([red_ll, green_ll, blue_ll], axis=-1)

if cloud_mask.any():
    for ch in range(3):
        median = np.median(rgb[~cloud_mask, ch])
        rgb[cloud_mask, ch] = median

valid = ~cloud_mask
for ch in range(3):
    p2  = np.percentile(rgb[valid, ch], 2)
    p98 = np.percentile(rgb[valid, ch], 98)
    if p98 > p2:
        rgb[..., ch] = np.clip((rgb[..., ch] - p2) / (p98 - p2), 0, 1)

# Mild saturation boost
gray = rgb.mean(axis=-1, keepdims=True)
rgb = np.clip(gray + (rgb - gray) * 1.15, 0, 1)

img = (rgb * 255).astype(np.uint8)

# ---- 6. Save ----
OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
Image.fromarray(img).save(OUT_PATH, quality=88, optimize=True)
print(f"Wrote {OUT_PATH} ({OUT_PATH.stat().st_size / 1e6:.2f} MB)")