use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use tauri::ipc::Response;
use tauri::{AppHandle, Manager};

/// Tileset metadata structure, mirrors resources/terrain/srtm_tiles/tileset.json
#[derive(Serialize)]
pub struct TilesetMeta {
    pub min_level: u8,
    pub max_level: u8,
    pub bounds: [f64; 4],
}

#[tauri::command]
pub async fn get_terrain_tile(
    app: AppHandle,
    zoom: u8,
    x: u32,
    y: u32,
) -> Result<Response, String> {
    let path = tile_path(&app, zoom, x, y)?;
    let raw = fs::read(&path).map_err(|e| format!("read {:?}: {}", path, e))?;

    // Trace bytes we're about to send
    println!(
        "[terrain] {}/{}/{}: on-disk {} bytes, first={:02x} {:02x}",
        zoom,
        x,
        y,
        raw.len(),
        raw[0],
        raw[1]
    );

    // Gzip magic: 1F 8B
    let bytes = if raw.len() >= 2 && raw[0] == 0x1F && raw[1] == 0x8B {
        use std::io::Read;
        let mut gz = flate2::read::GzDecoder::new(&raw[..]);
        let mut out = Vec::new();
        gz.read_to_end(&mut out)
            .map_err(|e| format!("gunzip {:?}: {}", path, e))?;
        println!("[terrain]   → decompressed to {} bytes", out.len());
        out
    } else {
        raw
    };

    // First 16 bytes of what we're sending (should start with "quantized")
    let head: Vec<String> = bytes
        .iter()
        .take(16)
        .map(|b| format!("{:02x}", b))
        .collect();
    println!("[terrain]   → sending head=[{}]", head.join(" "));

    Ok(Response::new(bytes))
}

/// Convenience: return tileset metadata so the frontend knows what to load.
#[tauri::command]
pub async fn get_tileset(app: AppHandle) -> Result<TilesetMeta, String> {
    let path = resource_root(&app)?.join("tileset.json");
    let raw = fs::read_to_string(&path).map_err(|e| format!("read {:?}: {}", path, e))?;
    let json: serde_json::Value =
        serde_json::from_str(&raw).map_err(|e| format!("parse tileset: {}", e))?;

    Ok(TilesetMeta {
        min_level: json["minLevel"].as_u64().unwrap_or(10) as u8,
        max_level: json["maxLevel"].as_u64().unwrap_or(13) as u8,
        bounds: [
            json["bounds"][0].as_f64().unwrap_or(0.0),
            json["bounds"][1].as_f64().unwrap_or(0.0),
            json["bounds"][2].as_f64().unwrap_or(0.0),
            json["bounds"][3].as_f64().unwrap_or(0.0),
        ],
    })
}

// ---------- helpers ----------

/// Resolves to <resource_dir>/resources/terrain/srtm_tiles
fn resource_root(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("resource_dir: {}", e))?;
    Ok(dir.join("resources").join("terrain").join("srtm_tiles"))
}

fn tile_path(app: &AppHandle, zoom: u8, x: u32, y: u32) -> Result<PathBuf, String> {
    Ok(resource_root(app)?
        .join(zoom.to_string())
        .join(x.to_string())
        .join(format!("{}.terrain", y)))
}

#[derive(Serialize)]
pub struct TileCoord {
    pub z: u8,
    pub x: u32,
    pub y: u32,
}

/// Walk resources/terrain/srtm_tiles/{z}/{x}/{y}.terrain and return coords.
#[tauri::command]
pub async fn list_tiles(app: AppHandle) -> Result<Vec<TileCoord>, String> {
    let root = resource_root(&app)?;
    let mut out = Vec::new();
    walk_z(&root, &mut out).map_err(|e| format!("walk {:?}: {}", root, e))?;
    Ok(out)
}

fn walk_z(dir: &std::path::Path, out: &mut Vec<TileCoord>) -> std::io::Result<()> {
    for z_entry in fs::read_dir(dir)? {
        let z_entry = z_entry?;
        if !z_entry.file_type()?.is_dir() {
            continue;
        }
        let z: u8 = match z_entry.file_name().to_string_lossy().parse() {
            Ok(v) => v,
            Err(_) => continue,
        };
        for x_entry in fs::read_dir(z_entry.path())? {
            let x_entry = x_entry?;
            if !x_entry.file_type()?.is_dir() {
                continue;
            }
            let x: u32 = match x_entry.file_name().to_string_lossy().parse() {
                Ok(v) => v,
                Err(_) => continue,
            };
            for y_entry in fs::read_dir(x_entry.path())? {
                let y_entry = y_entry?;
                let name = y_entry.file_name();
                let name = name.to_string_lossy();
                let stem = match name.strip_suffix(".terrain") {
                    Some(s) => s,
                    None => continue,
                };
                let y: u32 = match stem.parse() {
                    Ok(v) => v,
                    Err(_) => continue,
                };
                out.push(TileCoord { z, x, y });
            }
        }
    }
    Ok(())
}

/// Decode a terrain tile in Rust and return a compact binary blob:
///   [vertexCount: u32 LE][indexCount: u32 LE]
///   [positions: f32 × 3 × vertexCount]  (x, y, z)
///   [indices:   u32 × indexCount]
///
/// Heights are kept as absolute metres. X/Y are quantized u/v mapped to [0,1].
#[tauri::command]
pub async fn get_terrain_tile_mesh(
    app: AppHandle,
    zoom: u8,
    x: u32,
    y: u32,
) -> Result<Response, String> {
    // ---- read + gunzip ----
    let path = tile_path(&app, zoom, x, y)?;
    let raw = fs::read(&path).map_err(|e| format!("read {:?}: {}", path, e))?;
    let bytes = if raw.len() >= 2 && raw[0] == 0x1F && raw[1] == 0x8B {
        use std::io::Read;
        let mut gz = flate2::read::GzDecoder::new(&raw[..]);
        let mut out = Vec::new();
        gz.read_to_end(&mut out)
            .map_err(|e| format!("gunzip: {}", e))?;
        out
    } else {
        raw
    };

    // ---- decode using quantized-mesh's own decoder ----
    let mesh = quantized_mesh::DecodedMesh::decode(&bytes)
        .map_err(|e| format!("decode tile {}/{}/{}: {}", zoom, x, y, e))?;

    // let vcount = mesh.vertices.u.len();
    // let icount = mesh.indices.len();
    let vcount = mesh.vertices.u.len();
    let icount = mesh.indices.len();

    // Emit-only-empty-diagnostic for tiles with < 3 vertices
    if vcount < 3 {
        println!(
            "[terrain-empty] {}/{}/{}: verts={}, idx={} — skipping",
            zoom, x, y, vcount, icount
        );
        // Return a minimal "empty" payload: counts = 0, no data
        let mut out = Vec::with_capacity(8);
        out.extend_from_slice(&0u32.to_le_bytes());
        out.extend_from_slice(&0u32.to_le_bytes());
        return Ok(Response::new(out));
    }

    // Also log a one-time summary line per tile
    println!(
        "[terrain] {}/{}/{}: verts={}, idx={}, min={:.1}, max={:.1}",
        zoom, x, y, vcount, icount, mesh.header.min_height, mesh.header.max_height
    );

    let min_h = mesh.header.min_height as f64;
    let max_h = mesh.header.max_height as f64;
    let span = (max_h - min_h).max(1e-6);

    let mut out: Vec<u8> = Vec::with_capacity(8 + vcount * 12 + icount * 4);
    out.extend_from_slice(&(vcount as u32).to_le_bytes());
    out.extend_from_slice(&(icount as u32).to_le_bytes());

    for i in 0..vcount {
        // u,v in [0, 32767] → [-1, 1] scene units
        let u = (mesh.vertices.u[i] as f32 / 32767.0) * 2.0 - 1.0;
        let v = (mesh.vertices.v[i] as f32 / 32767.0) * 2.0 - 1.0;
        // height in metres (absolute)
        let h = min_h as f32 + (mesh.vertices.height[i] as f32 / 32767.0) * span as f32;
        out.extend_from_slice(&u.to_le_bytes());
        out.extend_from_slice(&h.to_le_bytes()); // Y = elevation
        out.extend_from_slice(&v.to_le_bytes());
    }
    for idx in &mesh.indices {
        out.extend_from_slice(&idx.to_le_bytes());
    }

    Ok(Response::new(out))
}
