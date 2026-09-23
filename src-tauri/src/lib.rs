mod terrain;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(terrain::DemCache::new())
        .invoke_handler(tauri::generate_handler![
            greet,
            terrain::load_dem_mesh,
            terrain::save_city,
            terrain::load_city,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
