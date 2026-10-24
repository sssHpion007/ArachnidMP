use jpeg_decoder::{Decoder as JpegDecoder, PixelFormat as JpegPixelFormat};
use jpeg_encoder::{ColorType as JpegColorType, Encoder as JpegEncoder};
use rusqlite::{blob::Blob, params, Connection, DatabaseName, OptionalExtension};
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::{BufReader, Cursor, Read};
use std::path::Path;
use std::sync::{Arc, Mutex};

const VARIANT_SIZES: [u32; 2] = [96, 256];
const MAX_SOURCE_BYTES: u64 = 64 * 1024 * 1024;
const MAX_SOURCE_PIXELS: u64 = 100_000_000;
const MAX_SOURCE_DIMENSION: u32 = 32_768;
const JPEG_QUALITY: u8 = 84;

#[derive(Clone)]
pub struct CoverCache {
    connection: Arc<Mutex<Connection>>,
}

#[derive(Debug, Clone)]
pub struct CoverImage {
    pub bytes: Vec<u8>,
    pub mime: String,
}

impl CoverCache {
    pub fn open(path: impl AsRef<Path>) -> Result<Self, String> {
        let path = path.as_ref().to_path_buf();
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|error| format!("Create cover cache directory: {error}"))?;
        }

        let connection = Connection::open(&path).map_err(|error| format!("Open cover cache: {error}"))?;
        connection.busy_timeout(std::time::Duration::from_secs(5)).map_err(|error| error.to_string())?;
        connection.execute_batch(
            "PRAGMA journal_mode=WAL;
             PRAGMA synchronous=NORMAL;
             PRAGMA foreign_keys=ON;
             PRAGMA auto_vacuum=INCREMENTAL;
             CREATE TABLE IF NOT EXISTS artworks (
                hash TEXT PRIMARY KEY NOT NULL,
                mime TEXT NOT NULL,
                source BLOB NOT NULL,
                source_size INTEGER NOT NULL,
                created_at INTEGER NOT NULL DEFAULT (unixepoch())
             );
             CREATE TABLE IF NOT EXISTS variants (
                hash TEXT NOT NULL REFERENCES artworks(hash) ON DELETE CASCADE,
                size INTEGER NOT NULL,
                mime TEXT NOT NULL,
                data BLOB NOT NULL,
                PRIMARY KEY(hash, size)
             );
             CREATE TABLE IF NOT EXISTS track_artwork (
                track_id TEXT PRIMARY KEY NOT NULL,
                hash TEXT NOT NULL REFERENCES artworks(hash) ON DELETE CASCADE
             );
             CREATE INDEX IF NOT EXISTS idx_track_artwork_hash ON track_artwork(hash);"
        ).map_err(|error| format!("Initialize cover cache: {error}"))?;

        Ok(Self { connection: Arc::new(Mutex::new(connection)) })
    }

    fn artwork_exists(&self, hash: &str) -> Result<bool, String> {
        let connection = self.connection.lock().map_err(|_| "Cover cache lock is poisoned".to_string())?;
        connection.query_row(
            "SELECT EXISTS(SELECT 1 FROM artworks WHERE hash=?1)", [hash], |row| row.get(0)
        ).map_err(|error| format!("Check cached artwork: {error}"))
    }

    pub fn store_bytes(&self, bytes: &[u8], mime_hint: &str) -> Result<String, String> {
        if bytes.is_empty() || bytes.len() as u64 > MAX_SOURCE_BYTES {
            return Err("Cover image is empty or exceeds the 64 MiB cache limit".to_string());
        }
        let hash = hex_digest(bytes);
        if self.artwork_exists(&hash)? { return Ok(hash); }
        let mime = detect_mime(bytes, mime_hint);
        let variants = generate_variants_from_bytes(bytes, &mime);
        self.insert_source_and_variants(&hash, &mime, bytes.len() as u64, Some(bytes), variants)?;
        Ok(hash)
    }

    /// Reads a regular image file incrementally for hashing and SQLite storage. The decoder
    /// independently opens the file and writes only target-sized output buffers.
    pub fn store_file(&self, path: impl AsRef<Path>) -> Result<String, String> {
        let path = path.as_ref();
        let metadata = fs::metadata(path).map_err(|error| format!("Read cover metadata: {error}"))?;
        let source_size = metadata.len();
        if source_size == 0 || source_size > MAX_SOURCE_BYTES {
            return Err("Cover image is empty or exceeds the 64 MiB cache limit".to_string());
        }

        let extension_mime = mime_from_extension(path.extension().and_then(|value| value.to_str()).unwrap_or_default());
        let mut sniff_file = File::open(path).map_err(|error| format!("Open cover image: {error}"))?;
        let mut header = [0u8; 12];
        let header_size = sniff_file.read(&mut header).map_err(|error| format!("Read cover header: {error}"))?;
        let mime = detect_mime(&header[..header_size], &extension_mime);

        let mut hasher = Sha256::new();
        let mut source_file = File::open(path).map_err(|error| format!("Open cover image: {error}"))?;
        let mut block = [0u8; 64 * 1024];
        loop {
            let count = source_file.read(&mut block).map_err(|error| format!("Hash cover image: {error}"))?;
            if count == 0 { break; }
            hasher.update(&block[..count]);
        }
        let hash = encode_hex(&hasher.finalize());
        if self.artwork_exists(&hash)? { return Ok(hash); }
        let variants = generate_variants_from_file(path, &mime);

        let connection = self.connection.lock().map_err(|_| "Cover cache lock is poisoned".to_string())?;
        let exists: bool = connection.query_row(
            "SELECT EXISTS(SELECT 1 FROM artworks WHERE hash=?1)", [&hash], |row| row.get(0)
        ).map_err(|error| format!("Check cached artwork: {error}"))?;
        if exists { return Ok(hash); }

        let transaction = connection.unchecked_transaction().map_err(|error| error.to_string())?;
        transaction.execute(
            "INSERT INTO artworks(hash,mime,source,source_size) VALUES(?1,?2,zeroblob(?3),?3)",
            params![hash, mime, source_size as i64],
        ).map_err(|error| format!("Create cached artwork: {error}"))?;
        let row_id: i64 = transaction.query_row("SELECT rowid FROM artworks WHERE hash=?1", [&hash], |row| row.get(0))
            .map_err(|error| format!("Find cached artwork row: {error}"))?;
        let mut blob: Blob<'_> = transaction.blob_open(DatabaseName::Main, "artworks", "source", row_id, false)
            .map_err(|error| format!("Open artwork cache blob: {error}"))?;
        let mut source_file = File::open(path).map_err(|error| format!("Reopen cover image: {error}"))?;
        let copied = std::io::copy(&mut source_file, &mut blob).map_err(|error| format!("Write artwork cache blob: {error}"))?;
        if copied != source_size {
            return Err(format!("Cover image changed while being cached (expected {source_size} bytes, read {copied})"));
        }
        drop(blob);
        insert_variants(&transaction, &hash, variants)?;
        transaction.commit().map_err(|error| format!("Commit cached artwork: {error}"))?;
        Ok(hash)
    }

    fn insert_source_and_variants(
        &self,
        hash: &str,
        mime: &str,
        source_size: u64,
        source: Option<&[u8]>,
        variants: Vec<(u32, String, Vec<u8>)>,
    ) -> Result<(), String> {
        let connection = self.connection.lock().map_err(|_| "Cover cache lock is poisoned".to_string())?;
        let transaction = connection.unchecked_transaction().map_err(|error| error.to_string())?;
        transaction.execute(
            "INSERT OR IGNORE INTO artworks(hash,mime,source,source_size) VALUES(?1,?2,?3,?4)",
            params![hash, mime, source, source_size as i64],
        ).map_err(|error| format!("Store source artwork: {error}"))?;
        insert_variants(&transaction, hash, variants)?;
        transaction.commit().map_err(|error| format!("Commit source artwork: {error}"))
    }

    pub fn set_track_artwork(&self, track_id: &str, cover: Option<&str>) -> Result<(), String> {
        self.set_track_artwork_batch(&[(track_id.to_string(), cover.map(|value| value.to_string()))])
    }

    pub fn set_track_artwork_batch(&self, track_covers: &[(String, Option<String>)]) -> Result<(), String> {
        if track_covers.is_empty() { return Ok(()); }
        let connection = self.connection.lock().map_err(|_| "Cover cache lock is poisoned".to_string())?;
        let transaction = connection.unchecked_transaction().map_err(|error| error.to_string())?;
        for (track_id, cover) in track_covers {
            let hash = cover.as_deref().and_then(parse_cover_hash);
            let exists = if let Some(hash) = hash.as_ref() {
                transaction.query_row(
                    "SELECT EXISTS(SELECT 1 FROM artworks WHERE hash=?1)", [hash], |row| row.get::<_, bool>(0)
                ).map_err(|error| error.to_string())?
            } else { false };
            if exists {
                transaction.execute(
                    "INSERT INTO track_artwork(track_id,hash) VALUES(?1,?2)
                     ON CONFLICT(track_id) DO UPDATE SET hash=excluded.hash",
                    params![track_id, hash],
                ).map_err(|error| format!("Link track to artwork: {error}"))?;
            } else {
                transaction.execute("DELETE FROM track_artwork WHERE track_id=?1", [track_id])
                    .map_err(|error| error.to_string())?;
            }
        }
        collect_orphans(&transaction)?;
        transaction.commit().map_err(|error| error.to_string())
    }

    pub fn remove_tracks(&self, track_ids: &[String]) -> Result<(), String> {
        if track_ids.is_empty() { return Ok(()); }
        let connection = self.connection.lock().map_err(|_| "Cover cache lock is poisoned".to_string())?;
        let transaction = connection.unchecked_transaction().map_err(|error| error.to_string())?;
        for id in track_ids {
            transaction.execute("DELETE FROM track_artwork WHERE track_id=?1", [id])
                .map_err(|error| format!("Remove track artwork reference: {error}"))?;
        }
        collect_orphans(&transaction)?;
        transaction.commit().map_err(|error| error.to_string())?;
        drop(connection);
        self.release_incremental_pages()
    }

    pub fn reconcile_library_covers(&self, track_covers: &[(String, Option<String>)]) -> Result<(), String> {
        let connection = self.connection.lock().map_err(|_| "Cover cache lock is poisoned".to_string())?;
        let transaction = connection.unchecked_transaction().map_err(|error| error.to_string())?;
        let mut desired = std::collections::HashMap::new();
        for (track_id, cover) in track_covers {
            let Some(hash) = cover.as_deref().and_then(parse_cover_hash) else { continue };
            let exists: bool = transaction.query_row(
                "SELECT EXISTS(SELECT 1 FROM artworks WHERE hash=?1)", [&hash], |row| row.get(0)
            ).map_err(|error| error.to_string())?;
            if exists { desired.insert(track_id.clone(), hash); }
        }

        let current = {
            let mut statement = transaction.prepare("SELECT track_id,hash FROM track_artwork")
                .map_err(|error| error.to_string())?;
            let rows = statement.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
                .map_err(|error| error.to_string())?;
            rows.collect::<rusqlite::Result<Vec<_>>>().map_err(|error| error.to_string())?
        };
        let current_by_track = current.iter().cloned().collect::<std::collections::HashMap<_, _>>();
        for (track_id, hash) in &desired {
            if current_by_track.get(track_id) != Some(hash) {
                transaction.execute(
                    "INSERT INTO track_artwork(track_id,hash) VALUES(?1,?2)
                     ON CONFLICT(track_id) DO UPDATE SET hash=excluded.hash",
                    params![track_id, hash],
                ).map_err(|error| format!("Reconcile track artwork: {error}"))?;
            }
        }
        for (track_id, _) in current {
            if !desired.contains_key(&track_id) {
                transaction.execute("DELETE FROM track_artwork WHERE track_id=?1", [track_id])
                    .map_err(|error| error.to_string())?;
            }
        }
        collect_orphans(&transaction)?;
        transaction.commit().map_err(|error| error.to_string())?;
        drop(connection);
        self.release_incremental_pages()
    }

    pub fn get_image(&self, hash: &str, size: Option<u32>) -> Result<Option<CoverImage>, String> {
        if !is_valid_hash(hash) { return Ok(None); }
        let connection = self.connection.lock().map_err(|_| "Cover cache lock is poisoned".to_string())?;
        if let Some(size) = size.filter(|value| VARIANT_SIZES.contains(value)) {
            let variant = connection.query_row(
                "SELECT mime,data FROM variants WHERE hash=?1 AND size=?2",
                params![hash, size],
                |row| Ok(CoverImage { mime: row.get(0)?, bytes: row.get(1)? }),
            ).optional().map_err(|error| format!("Read cover variant: {error}"))?;
            if variant.is_some() { return Ok(variant); }
        }
        connection.query_row(
            "SELECT mime,source FROM artworks WHERE hash=?1",
            [hash],
            |row| Ok(CoverImage { mime: row.get(0)?, bytes: row.get(1)? }),
        ).optional().map_err(|error| format!("Read original artwork: {error}"))
    }

    fn release_incremental_pages(&self) -> Result<(), String> {
        let connection = self.connection.lock().map_err(|_| "Cover cache lock is poisoned".to_string())?;
        connection.execute_batch("PRAGMA incremental_vacuum(64);").map_err(|error| error.to_string())
    }
}

fn insert_variants(
    connection: &Connection,
    hash: &str,
    variants: Vec<(u32, String, Vec<u8>)>,
) -> Result<(), String> {
    for (size, mime, data) in variants {
        connection.execute(
            "INSERT OR IGNORE INTO variants(hash,size,mime,data) VALUES(?1,?2,?3,?4)",
            params![hash, size, mime, data],
        ).map_err(|error| format!("Store artwork variant: {error}"))?;
    }
    Ok(())
}

fn collect_orphans(connection: &Connection) -> Result<(), String> {
    connection.execute(
        "DELETE FROM artworks WHERE NOT EXISTS (SELECT 1 FROM track_artwork WHERE track_artwork.hash=artworks.hash)",
        [],
    ).map_err(|error| format!("Collect unused artwork: {error}"))?;
    Ok(())
}

fn hex_digest(bytes: &[u8]) -> String { encode_hex(&Sha256::digest(bytes)) }

fn encode_hex(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(HEX[(byte >> 4) as usize] as char);
        output.push(HEX[(byte & 0x0f) as usize] as char);
    }
    output
}

fn is_valid_hash(value: &str) -> bool {
    value.len() == 64 && value.bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn parse_cover_hash(value: &str) -> Option<String> {
    let url = value.strip_prefix("http://cover.localhost/")
        .or_else(|| value.strip_prefix("https://cover.localhost/"))
        .or_else(|| value.strip_prefix("cover://localhost/"))?;
    let hash = url.split('/').next()?;
    is_valid_hash(hash).then(|| hash.to_ascii_lowercase())
}

pub fn cover_url(hash: &str, size: Option<u32>) -> String {
    let variant = size.filter(|value| VARIANT_SIZES.contains(value))
        .map(|value| value.to_string()).unwrap_or_else(|| "original".to_string());
    if cfg!(target_os = "windows") {
        format!("https://cover.localhost/{hash}/{variant}")
    } else {
        format!("cover://localhost/{hash}/{variant}")
    }
}

pub fn parse_cover_request(path: &str) -> Option<(String, Option<u32>)> {
    let mut parts = path.trim_start_matches('/').split('/');
    let hash = parts.next()?;
    let variant = parts.next().unwrap_or("original");
    if parts.next().is_some() || !is_valid_hash(hash) { return None; }
    let size = if variant == "original" { None } else { Some(variant.parse::<u32>().ok()?) };
    if size.is_some_and(|value| !VARIANT_SIZES.contains(&value)) { return None; }
    Some((hash.to_ascii_lowercase(), size))
}

fn detect_mime(bytes: &[u8], hint: &str) -> String {
    if bytes.starts_with(b"\xFF\xD8\xFF") { return "image/jpeg".to_string(); }
    if bytes.starts_with(b"\x89PNG\r\n\x1A\n") { return "image/png".to_string(); }
    if bytes.starts_with(b"RIFF") && bytes.get(8..12) == Some(b"WEBP") { return "image/webp".to_string(); }
    match hint.to_ascii_lowercase().as_str() {
        "image/png" | "png" => "image/png".to_string(),
        "image/webp" | "webp" => "image/webp".to_string(),
        "image/gif" | "gif" => "image/gif".to_string(),
        "image/bmp" | "bmp" => "image/bmp".to_string(),
        _ => "image/jpeg".to_string(),
    }
}

fn mime_from_extension(extension: &str) -> String {
    match extension.to_ascii_lowercase().as_str() {
        "png" => "image/png".to_string(),
        "webp" => "image/webp".to_string(),
        "gif" => "image/gif".to_string(),
        "bmp" => "image/bmp".to_string(),
        _ => "image/jpeg".to_string(),
    }
}

fn generate_variants_from_bytes(bytes: &[u8], mime: &str) -> Vec<(u32, String, Vec<u8>)> {
    match mime {
        "image/jpeg" => VARIANT_SIZES.iter().filter_map(|size| {
            decode_scaled_jpeg(Cursor::new(bytes), *size).ok().map(|data| (*size, "image/jpeg".to_string(), data))
        }).collect(),
        "image/png" => VARIANT_SIZES.iter().filter_map(|size| {
            decode_streamed_png(Cursor::new(bytes), *size).ok().map(|data| (*size, "image/png".to_string(), data))
        }).collect(),
        _ => Vec::new(),
    }
}

fn generate_variants_from_file(path: &Path, mime: &str) -> Vec<(u32, String, Vec<u8>)> {
    match mime {
        "image/jpeg" => VARIANT_SIZES.iter().filter_map(|size| {
            let file = File::open(path).ok()?;
            decode_scaled_jpeg(BufReader::new(file), *size).ok().map(|data| (*size, "image/jpeg".to_string(), data))
        }).collect(),
        "image/png" => VARIANT_SIZES.iter().filter_map(|size| {
            let file = File::open(path).ok()?;
            decode_streamed_png(BufReader::new(file), *size).ok().map(|data| (*size, "image/png".to_string(), data))
        }).collect(),
        _ => Vec::new(),
    }
}

fn decode_scaled_jpeg<R: Read>(reader: R, target: u32) -> Result<Vec<u8>, String> {
    let mut decoder = JpegDecoder::new(reader);
    decoder.read_info().map_err(|error| format!("Read JPEG header: {error}"))?;
    let (source_width, source_height, pixel_format) = {
        let info = decoder.info().ok_or("JPEG has no image header")?;
        (info.width, info.height, info.pixel_format)
    };
    if source_width as u32 > MAX_SOURCE_DIMENSION
        || source_height as u32 > MAX_SOURCE_DIMENSION
        || (source_width as u64).saturating_mul(source_height as u64) > MAX_SOURCE_PIXELS {
        return Err("JPEG exceeds thumbnail pixel limit".to_string());
    }
    let (scaled_width, scaled_height) = decoder.scale(target as u16, target as u16)
        .map_err(|error| format!("Configure reduced JPEG decode: {error}"))?;
    let pixels = decoder.decode().map_err(|error| format!("Decode reduced JPEG: {error}"))?;
    let width = scaled_width as usize;
    let height = scaled_height as usize;
    let rgb = jpeg_to_rgb(&pixels, width, height, pixel_format)?;
    let (output_width, output_height) = target_dimensions(width, height, target as usize);
    let sampled = box_resize_rgb(&rgb, width, height, output_width, output_height);
    let mut encoded = Vec::new();
    JpegEncoder::new(&mut encoded, JPEG_QUALITY)
        .encode(&sampled, output_width as u16, output_height as u16, JpegColorType::Rgb)
        .map_err(|error| format!("Encode JPEG variant: {error}"))?;
    Ok(encoded)
}

fn jpeg_to_rgb(data: &[u8], width: usize, height: usize, format: JpegPixelFormat) -> Result<Vec<u8>, String> {
    let pixels = width.checked_mul(height).ok_or("Invalid JPEG dimensions")?;
    let mut output = Vec::with_capacity(pixels.saturating_mul(3));
    match format {
        JpegPixelFormat::RGB24 => output.extend_from_slice(data),
        JpegPixelFormat::L8 => {
            for &gray in data { output.extend_from_slice(&[gray, gray, gray]); }
        }
        JpegPixelFormat::L16 => {
            for sample in data.chunks_exact(2) { let gray = sample[0]; output.extend_from_slice(&[gray, gray, gray]); }
        }
        JpegPixelFormat::CMYK32 => {
            for sample in data.chunks_exact(4) {
                let c = sample[0] as u16;
                let m = sample[1] as u16;
                let y = sample[2] as u16;
                let k = sample[3] as u16;
                output.extend_from_slice(&[
                    (255u16.saturating_sub((c + k).min(255))) as u8,
                    (255u16.saturating_sub((m + k).min(255))) as u8,
                    (255u16.saturating_sub((y + k).min(255))) as u8,
                ]);
            }
        }
        _ => return Err("Unsupported JPEG pixel format".to_string()),
    }
    if output.len() != pixels.saturating_mul(3) {
        return Err("JPEG decoder returned an unexpected pixel buffer".to_string());
    }
    Ok(output)
}

fn target_dimensions(width: usize, height: usize, max_edge: usize) -> (usize, usize) {
    let scale = (max_edge as f64 / width.max(height) as f64).min(1.0);
    (((width as f64 * scale).round() as usize).max(1), ((height as f64 * scale).round() as usize).max(1))
}

fn box_resize_rgb(input: &[u8], width: usize, height: usize, target_width: usize, target_height: usize) -> Vec<u8> {
    let mut sums = vec![[0u64; 3]; target_width * target_height];
    let mut counts = vec![0u64; target_width * target_height];
    for y in 0..height {
        let out_y = (y * target_height / height).min(target_height - 1);
        for x in 0..width {
            let out_x = (x * target_width / width).min(target_width - 1);
            let input_index = (y * width + x) * 3;
            let output_index = out_y * target_width + out_x;
            for channel in 0..3 { sums[output_index][channel] += input[input_index + channel] as u64; }
            counts[output_index] += 1;
        }
    }
    let mut output = Vec::with_capacity(target_width * target_height * 3);
    for index in 0..target_width * target_height {
        let divisor = counts[index].max(1);
        for channel in 0..3 { output.push((sums[index][channel] / divisor) as u8); }
    }
    output
}

fn decode_streamed_png<R: Read + std::io::Seek>(reader: R, target: u32) -> Result<Vec<u8>, String> {
    let mut decoder = png::Decoder::new(BufReader::new(reader));
    decoder.set_transformations(png::Transformations::EXPAND | png::Transformations::STRIP_16);
    let mut reader = decoder.read_info().map_err(|error| format!("Read PNG header: {error}"))?;
    let width = reader.info().width as usize;
    let height = reader.info().height as usize;
    if width == 0 || height == 0
        || width as u32 > MAX_SOURCE_DIMENSION || height as u32 > MAX_SOURCE_DIMENSION
        || (width as u64).saturating_mul(height as u64) > MAX_SOURCE_PIXELS {
        return Err("PNG exceeds thumbnail pixel limit".to_string());
    }
    let color = reader.output_color_type().0;
    let channels = match color {
        png::ColorType::Grayscale => 1,
        png::ColorType::GrayscaleAlpha => 2,
        png::ColorType::Rgb => 3,
        png::ColorType::Rgba => 4,
        png::ColorType::Indexed => return Err("PNG palette expansion failed".to_string()),
        _ => return Err("Unsupported PNG color type".to_string()),
    };
    let target = target as usize;
    let (target_width, target_height) = target_dimensions(width, height, target);
    let mut sums = vec![[0u64; 4]; target_width * target_height];
    let mut counts = vec![0u64; target_width * target_height];
    let mut source_y = 0usize;
    while let Some(row) = reader.next_row().map_err(|error| format!("Decode PNG row: {error}"))? {
        let data = row.data();
        if data.len() < width.saturating_mul(channels) { return Err("PNG decoder returned a short row".to_string()); }
        let out_y = (source_y * target_height / height).min(target_height - 1);
        for x in 0..width {
            let out_x = (x * target_width / width).min(target_width - 1);
            let input = x * channels;
            let (r, g, b, a) = match color {
                png::ColorType::Grayscale => (data[input], data[input], data[input], 255u8),
                png::ColorType::GrayscaleAlpha => (data[input], data[input], data[input], data[input + 1]),
                png::ColorType::Rgb => (data[input], data[input + 1], data[input + 2], 255u8),
                png::ColorType::Rgba => (data[input], data[input + 1], data[input + 2], data[input + 3]),
                png::ColorType::Indexed => unreachable!(),
                _ => unreachable!(),
            };
            let output = out_y * target_width + out_x;
            let alpha = a as u64;
            sums[output][0] += r as u64 * alpha;
            sums[output][1] += g as u64 * alpha;
            sums[output][2] += b as u64 * alpha;
            sums[output][3] += alpha;
            counts[output] += 1;
        }
        source_y += 1;
    }
    if source_y != height { return Err("PNG decoder returned an incomplete image".to_string()); }

    let mut rgba = Vec::with_capacity(target_width * target_height * 4);
    for index in 0..target_width * target_height {
        let count = counts[index].max(1);
        let alpha_sum = sums[index][3];
        let alpha = (alpha_sum / count).min(255) as u8;
        for channel in 0..3 {
            let value = if alpha_sum == 0 { 0 } else { (sums[index][channel] / alpha_sum).min(255) as u8 };
            rgba.push(value);
        }
        rgba.push(alpha);
    }

    let mut encoded = Vec::new();
    {
        let mut encoder = png::Encoder::new(&mut encoded, target_width as u32, target_height as u32);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);
        let mut writer = encoder.write_header().map_err(|error| format!("Write PNG variant header: {error}"))?;
        writer.write_image_data(&rgba).map_err(|error| format!("Write PNG variant: {error}"))?;
    }
    Ok(encoded)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn deduplicates_artwork_and_collects_after_last_track_reference() {
        let cache = CoverCache::open(":memory:").unwrap();
        // A tiny valid JPEG is provided by the encoder, which also exercises the native scaled path.
        let source = {
            let pixels = vec![180u8; 32 * 32 * 3];
            let mut bytes = Vec::new();
            JpegEncoder::new(&mut bytes, 80).encode(&pixels, 32, 32, JpegColorType::Rgb).unwrap();
            bytes
        };
        let hash = cache.store_bytes(&source, "image/jpeg").unwrap();
        assert_eq!(cache.store_bytes(&source, "image/jpeg").unwrap(), hash);
        let url = cover_url(&hash, None);
        cache.set_track_artwork("a", Some(url.as_str())).unwrap();
        cache.set_track_artwork("b", Some(url.as_str())).unwrap();
        assert!(cache.get_image(&hash, Some(96)).unwrap().is_some());
        cache.remove_tracks(&["a".to_string()]).unwrap();
        assert!(cache.get_image(&hash, None).unwrap().is_some());
        cache.remove_tracks(&["b".to_string()]).unwrap();
        assert!(cache.get_image(&hash, None).unwrap().is_none());
    }

    #[test]
    fn png_variants_are_generated_from_streamed_rows_without_upscaling() {
        let cache = CoverCache::open(":memory:").unwrap();
        let mut source = Vec::new();
        {
            let mut encoder = png::Encoder::new(&mut source, 2, 4);
            encoder.set_color(png::ColorType::Rgba);
            encoder.set_depth(png::BitDepth::Eight);
            let mut writer = encoder.write_header().unwrap();
            writer.write_image_data(&[255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 255, 255, 255, 255, 255, 0,
                12, 34, 56, 255, 90, 80, 70, 255, 1, 2, 3, 255, 0, 0, 0, 255]).unwrap();
        }
        let hash = cache.store_bytes(&source, "image/png").unwrap();
        let connection = cache.connection.lock().unwrap();
        let variant_count: i64 = connection.query_row("SELECT COUNT(*) FROM variants WHERE hash=?1", [&hash], |row| row.get(0)).unwrap();
        assert_eq!(variant_count, 2);
        drop(connection);
        let variant = cache.get_image(&hash, Some(96)).unwrap().unwrap();
        assert_eq!(variant.mime, "image/png");
        assert!(variant.bytes.starts_with(b"\x89PNG\r\n\x1A\n"));
    }

    #[test]
    fn cover_request_rejects_invalid_hash_and_size() {
        assert_eq!(parse_cover_request("/"), None);
        assert_eq!(parse_cover_request(&format!("/{}/96", "a".repeat(64))), Some(("a".repeat(64), Some(96))));
        assert_eq!(parse_cover_request(&format!("/{}/128", "a".repeat(64))), None);
    }
}
