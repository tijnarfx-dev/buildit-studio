use std::fs::File;
use std::io::BufReader;
use std::sync::Mutex;
use tauri::ipc::Response;
use tauri::{AppHandle, Manager};

pub struct DemData {
    pub width: u32,
    pub height: u32,
    pub west: f64,
    pub south: f64,
    pub east: f64,
    pub north: f64,
    pub heights: Vec<f32>,
}

pub struct DemCache(pub Mutex<Option<DemData>>);

impl DemCache {
    pub fn new() -> Self {
        Self(Mutex::new(None))
    }
}

fn read_full_dem(path: &std::path::Path) -> Result<DemData, String> {
    let file = File::open(path).map_err(|e| format!("open {:?}: {}", path, e))?;
    let mut decoder = tiff::decoder::Decoder::new(BufReader::new(file))
        .map_err(|e| format!("tiff decoder: {}", e))?;
    let (w, h) = decoder.dimensions().map_err(|e| format!("dims: {}", e))?;
    let img = decoder
        .read_image()
        .map_err(|e| format!("read_image: {}", e))?;

    use tiff::decoder::DecodingResult as DR;
    let heights: Vec<f32> = match img {
        DR::F32(v) => v,
        DR::F64(v) => v.into_iter().map(|x| x as f32).collect(),
        DR::I16(v) => v.into_iter().map(|x| x as f32).collect(),
        DR::I32(v) => v.into_iter().map(|x| x as f32).collect(),
        DR::U8(v) => v.into_iter().map(|x| x as f32).collect(),
        DR::U16(v) => v.into_iter().map(|x| x as f32).collect(),
        DR::U32(v) => v.into_iter().map(|x| x as f32).collect(),
        _ => return Err("unsupported pixel format".to_string()),
    };

    let west = 92.9998611_f64;
    let north = 25.0001389_f64;
    let px_size = 0.000277777777778_f64;
    let east = west + w as f64 * px_size;
    let south = north - h as f64 * px_size;

    Ok(DemData {
        width: w,
        height: h,
        west,
        south,
        east,
        north,
        heights,
    })
}

#[tauri::command]
pub async fn load_dem_mesh(
    app: AppHandle,
    cache: tauri::State<'_, DemCache>,
    stride: u32,
) -> Result<Response, String> {
    let needs_load = cache.0.lock().unwrap().is_none();
    if needs_load {
        let path = app
            .path()
            .resource_dir()
            .map_err(|e| format!("resource_dir: {}", e))?
            .join("resources")
            .join("dem")
            .join("imphal_full.tif");

        let t0 = std::time::Instant::now();
        let dem = tauri::async_runtime::spawn_blocking(move || read_full_dem(&path))
            .await
            .map_err(|e| format!("join: {}", e))??;

        println!(
            "[dem] full DEM loaded in {} ms: {}×{} ({:.1}M px, {:.1} MB)",
            t0.elapsed().as_millis(),
            dem.width,
            dem.height,
            (dem.width as f64 * dem.height as f64) / 1e6,
            (dem.heights.len() * 4) as f64 / 1e6,
        );
        *cache.0.lock().unwrap() = Some(dem);
    }

    let guard = cache.0.lock().unwrap();
    let dem = guard.as_ref().unwrap();
    let stride = stride.max(1) as usize;
    let out_w = (dem.width as usize + stride - 1) / stride;
    let out_h = (dem.height as usize + stride - 1) / stride;

    let t1 = std::time::Instant::now();
    let mut out = Vec::with_capacity(40 + out_w * out_h * 4);
    out.extend_from_slice(&(out_w as u32).to_le_bytes());
    out.extend_from_slice(&(out_h as u32).to_le_bytes());
    out.extend_from_slice(&dem.west.to_le_bytes());
    out.extend_from_slice(&dem.south.to_le_bytes());
    out.extend_from_slice(&dem.east.to_le_bytes());
    out.extend_from_slice(&dem.north.to_le_bytes());

    let src_w = dem.width as usize;
    let src_h = dem.height as usize;
    for j in 0..out_h {
        let py = (j * stride).min(src_h - 1);
        let row = py * src_w;
        for i in 0..out_w {
            let px = (i * stride).min(src_w - 1);
            out.extend_from_slice(&dem.heights[row + px].to_le_bytes());
        }
    }

    println!(
        "[dem] subsample stride={} → {}×{} in {} ms",
        stride,
        out_w,
        out_h,
        t1.elapsed().as_millis()
    );

    Ok(Response::new(out))
}

// ---- Persistence ----

fn city_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {}", e))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("mkdir: {}", e))?;
    Ok(dir.join("city.json"))
}

#[tauri::command]
pub async fn save_city(app: AppHandle, json: String) -> Result<(), String> {
    let path = city_path(&app)?;
    std::fs::write(&path, json).map_err(|e| format!("write {:?}: {}", path, e))?;
    println!("[city] saved to {:?}", path);
    Ok(())
}

#[tauri::command]
pub async fn load_city(app: AppHandle) -> Result<Option<String>, String> {
    let path = city_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    let s = std::fs::read_to_string(&path).map_err(|e| format!("read: {}", e))?;
    println!("[city] loaded from {:?}", path);
    Ok(Some(s))
}

#[tauri::command]
pub async fn load_terrain_texture(app: AppHandle) -> Result<Response, String> {
    let path = app
        .path()
        .resource_dir()
        .map_err(|e| format!("resource_dir: {}", e))?
        .join("resources")
        .join("dem")
        .join("imphal_texture.jpg");

    let bytes = std::fs::read(&path).map_err(|e| format!("read {:?}: {}", path, e))?;

    println!(
        "[dem] texture loaded: {} bytes from {:?}",
        bytes.len(),
        path
    );
    Ok(Response::new(bytes))
}
