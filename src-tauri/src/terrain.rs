use std::fs;
use std::path::PathBuf;
use tauri::Manager;

// Command to read a terrain tile and return it as a byte vector
#[tauri::command]
pub async fn get_terrain_tile(
    app_handle: tauri::AppHandle,
    zoom: u8,
    x: u32,
    y: u32,
) -> Result<Vec<u8>, String> {
    // Construct the path to the bundled tile
    // This assumes your tiles are in "assets/terrain/{z}/{x}/{y}.terrain"
    let resource_path = app_handle
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?;

    let tile_path: PathBuf = resource_path
        .join("terrain")
        .join("srtm_tiles")
        .join(zoom.to_string())
        .join(x.to_string())
        .join(format!("{}.terrain", y));

    // Read the file
    fs::read(&tile_path).map_err(|e| format!("Failed to read tile at {:?}: {}", tile_path, e))
}
