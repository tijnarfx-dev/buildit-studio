use tauri::{AppHandle, Manager};

#[tauri::command]
pub async fn load_osm_geojson(app: AppHandle) -> Result<String, String> {
    let path = app
        .path()
        .resource_dir()
        .map_err(|e| format!("resource_dir: {}", e))?
        .join("resources")
        .join("osm")
        .join("imphal_osm.geojson");

    let s = std::fs::read_to_string(&path).map_err(|e| format!("read {:?}: {}", path, e))?;
    println!("[osm] loaded {} bytes from {:?}", s.len(), path);
    Ok(s)
}
