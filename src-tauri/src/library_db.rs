use rusqlite::{params, Connection, OptionalExtension, Transaction};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::cmp::Ordering;
use std::path::{Path, PathBuf};
use unicode_normalization::UnicodeNormalization;
use std::sync::{Arc, Mutex};
use std::time::Duration;

const DETAIL_KEYS: &[&str] = &[
    "lyrics",
    "isInstrumental",
    "is_instrumental",
    "composer",
    "contentGroup",
    "content_group",
    "comment",
    "conductor",
    "lyricist",
    "customTags",
    "custom_tags",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackSummary {
    pub id: String,
    pub path: Option<String>,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration: f64,
    pub src: String,
    pub cover_art: Option<String>,
    pub genre: Option<String>,
    pub year: Option<u32>,
    pub track_number: Option<u32>,
    pub track_total: Option<u32>,
    pub bitrate: Option<u32>,
    pub format: Option<String>,
    pub file_size: Option<u64>,
    pub date_added: i64,
    pub play_count: u64,
    pub is_favorite: bool,
    pub is_missing: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TrackDetails {
    pub lyrics: Option<String>,
    pub is_instrumental: Option<bool>,
    pub composer: Option<String>,
    pub content_group: Option<String>,
    pub comment: Option<String>,
    pub conductor: Option<String>,
    pub lyricist: Option<String>,
    pub custom_tags: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackPage {
    pub items: Vec<TrackSummary>,
    pub offset: u64,
    pub total: u64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LegacyTrackReference {
    pub id: String,
    pub path: String,
    #[serde(default)]
    pub is_favorite: bool,
    #[serde(default)]
    pub play_count: u64,
    #[serde(default)]
    pub date_added: i64,
}

/// A single SQLite connection is shared behind a mutex. SQLite serializes writes, while WAL
/// permits readers to continue during bounded scan batches.
#[derive(Clone)]
pub struct LibraryDb {
    connection: Arc<Mutex<Connection>>,
    path: PathBuf,
}

impl LibraryDb {
    pub fn open(path: impl AsRef<Path>) -> Result<Self, String> {
        let path = path.as_ref().to_path_buf();
        if path != Path::new(":memory:") {
            if let Some(parent) = path.parent().filter(|parent| !parent.as_os_str().is_empty()) {
                std::fs::create_dir_all(parent).map_err(|e| format!("Create library directory: {e}"))?;
            }
        }
        let connection = Connection::open(&path).map_err(|e| format!("Open library database: {e}"))?;
        connection.busy_timeout(Duration::from_secs(5)).map_err(|e| e.to_string())?;
        connection.create_collation("NATURAL_NOCASE", natural_compare)
            .map_err(|e| format!("Register library collation: {e}"))?;
        connection.execute_batch(
            "PRAGMA journal_mode=WAL;
             PRAGMA synchronous=NORMAL;
             PRAGMA foreign_keys=ON;
             PRAGMA cache_size=-4096;
             CREATE TABLE IF NOT EXISTS tracks (
                id TEXT PRIMARY KEY NOT NULL,
                path TEXT,
                path_key TEXT UNIQUE,
                title TEXT NOT NULL,
                artist TEXT NOT NULL,
                album TEXT NOT NULL,
                genre TEXT,
                year INTEGER,
                track_number INTEGER,
                track_total INTEGER,
                duration REAL NOT NULL DEFAULT 0,
                src TEXT NOT NULL,
                cover_art TEXT,
                bitrate INTEGER,
                format TEXT,
                file_size INTEGER,
                date_added INTEGER NOT NULL DEFAULT 0,
                play_count INTEGER NOT NULL DEFAULT 0,
                is_favorite INTEGER NOT NULL DEFAULT 0,
                is_missing INTEGER NOT NULL DEFAULT 0,
                search_text TEXT NOT NULL DEFAULT '',
                details_json TEXT NOT NULL DEFAULT '{}'
             );
             CREATE INDEX IF NOT EXISTS idx_tracks_title ON tracks(title COLLATE NATURAL_NOCASE, id);
             CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist COLLATE NATURAL_NOCASE, title COLLATE NATURAL_NOCASE, id);
             CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album COLLATE NATURAL_NOCASE, title COLLATE NATURAL_NOCASE, id);
             CREATE INDEX IF NOT EXISTS idx_tracks_genre ON tracks(genre COLLATE NATURAL_NOCASE, id);
             CREATE INDEX IF NOT EXISTS idx_tracks_favorite ON tracks(is_favorite, id);
             CREATE INDEX IF NOT EXISTS idx_tracks_path_key ON tracks(path_key);
             CREATE TABLE IF NOT EXISTS legacy_path_map (
                path_key TEXT PRIMARY KEY NOT NULL,
                old_id TEXT NOT NULL,
                is_favorite INTEGER NOT NULL DEFAULT 0,
                play_count INTEGER NOT NULL DEFAULT 0,
                date_added INTEGER NOT NULL DEFAULT 0
             );"
        ).map_err(|e| format!("Initialize library database: {e}"))?;
        Ok(Self { connection: Arc::new(Mutex::new(connection)), path })
    }

    pub fn path(&self) -> &Path { &self.path }

    pub fn count(&self, search: Option<&str>) -> Result<u64, String> {
        let connection = self.connection.lock().map_err(|_| "Library database lock is poisoned".to_string())?;
        let search = normalize_search(search.unwrap_or_default());
        let count = connection.query_row(
            "SELECT COUNT(*) FROM tracks WHERE (?1 = '' OR instr(search_text, ?1) > 0)",
            [search],
            |row| row.get::<_, i64>(0),
        ).map_err(|e| e.to_string())?;
        Ok(count.max(0) as u64)
    }

    pub fn page(&self, search: Option<&str>, sort_by: &str, descending: bool, offset: u64, limit: u32) -> Result<TrackPage, String> {
        let limit = limit.clamp(1, 500) as u64;
        let search = normalize_search(search.unwrap_or_default());
        let column = sort_column(sort_by);
        let direction = if descending { "DESC" } else { "ASC" };
        let sql = format!(
            "SELECT id,path,title,artist,album,genre,year,track_number,track_total,duration,src,cover_art,bitrate,format,file_size,date_added,play_count,is_favorite,is_missing
             FROM tracks WHERE (?1 = '' OR instr(search_text, ?1) > 0)
             ORDER BY {column} COLLATE NATURAL_NOCASE {direction}, id {direction} LIMIT ?2 OFFSET ?3"
        );
        let connection = self.connection.lock().map_err(|_| "Library database lock is poisoned".to_string())?;
        let total = connection.query_row(
            "SELECT COUNT(*) FROM tracks WHERE (?1 = '' OR instr(search_text, ?1) > 0)",
            [&search], |row| row.get::<_, i64>(0),
        ).map_err(|e| e.to_string())?.max(0) as u64;
        let mut statement = connection.prepare(&sql).map_err(|e| e.to_string())?;
        let sql_limit = limit as i64;
        let sql_offset = offset.min(i64::MAX as u64) as i64;
        let rows = statement.query_map(params![search, sql_limit, sql_offset], row_to_summary).map_err(|e| e.to_string())?;
        let mut items = Vec::new();
        for row in rows { items.push(row.map_err(|e| e.to_string())?); }
        Ok(TrackPage { items, offset, total })
    }

    pub fn details(&self, id: &str) -> Result<Option<TrackDetails>, String> {
        let connection = self.connection.lock().map_err(|_| "Library database lock is poisoned".to_string())?;
        let raw = connection.query_row("SELECT details_json FROM tracks WHERE id=?1", [id], |row| row.get::<_, String>(0)).optional().map_err(|e| e.to_string())?;
        raw.map(|json| serde_json::from_str(&json).map_err(|e| format!("Decode track details: {e}"))).transpose()
    }

    pub fn summaries_by_paths(&self, paths: &[String]) -> Result<Vec<TrackSummary>, String> {
        let connection = self.connection.lock().map_err(|_| "Library database lock is poisoned".to_string())?;
        let mut result = Vec::with_capacity(paths.len());
        let mut statement = connection.prepare(
            "SELECT id,path,title,artist,album,genre,year,track_number,track_total,duration,src,cover_art,bitrate,format,file_size,date_added,play_count,is_favorite,is_missing FROM tracks WHERE path_key=?1"
        ).map_err(|e| e.to_string())?;
        for path in paths {
            let path_key = normalize_path(path);
            if let Some(item) = statement.query_row([path_key], row_to_summary).optional().map_err(|e| e.to_string())? {
                result.push(item);
            }
        }
        Ok(result)
    }

    pub fn summaries_by_ids(&self, ids: &[String]) -> Result<Vec<TrackSummary>, String> {
        let connection = self.connection.lock().map_err(|_| "Library database lock is poisoned".to_string())?;
        let mut result = Vec::with_capacity(ids.len());
        let mut statement = connection.prepare(
            "SELECT id,path,title,artist,album,genre,year,track_number,track_total,duration,src,cover_art,bitrate,format,file_size,date_added,play_count,is_favorite,is_missing FROM tracks WHERE id=?1"
        ).map_err(|e| e.to_string())?;
        for id in ids {
            if let Some(item) = statement.query_row([id], row_to_summary).optional().map_err(|e| e.to_string())? {
                result.push(item);
            }
        }
        Ok(result)
    }

    pub fn seed_legacy_track_map(&self, tracks: &[LegacyTrackReference]) -> Result<usize, String> {
        let mut connection = self.connection.lock().map_err(|_| "Library database lock is poisoned".to_string())?;
        let transaction = connection.transaction().map_err(|e| e.to_string())?;
        let mut statement = transaction.prepare(
            "INSERT INTO legacy_path_map(path_key,old_id,is_favorite,play_count,date_added) VALUES (?1,?2,?3,?4,?5)
             ON CONFLICT(path_key) DO NOTHING"
        ).map_err(|e| e.to_string())?;
        let mut inserted = 0usize;
        for track in tracks.iter().filter(|track| !track.id.is_empty() && !track.path.trim().is_empty()) {
            inserted += statement.execute(params![
                normalize_path(&track.path), track.id, track.is_favorite,
                track.play_count.min(i64::MAX as u64) as i64, track.date_added
            ]).map_err(|e| e.to_string())?;
        }
        drop(statement);
        transaction.commit().map_err(|e| e.to_string())?;
        Ok(inserted)
    }

    pub fn upsert_batch(&self, tracks: &[Value]) -> Result<usize, String> {
        let mut connection = self.connection.lock().map_err(|_| "Library database lock is poisoned".to_string())?;
        let transaction = connection.transaction().map_err(|e| e.to_string())?;
        let mut changed = 0;
        for track in tracks {
            upsert_one(&transaction, track)?;
            changed += 1;
        }
        transaction.commit().map_err(|e| e.to_string())?;
        Ok(changed)
    }

    pub fn merge_details(&self, ids: &[String], patch: &Value) -> Result<(), String> {
        let patch = patch.as_object().ok_or("Track details patch must be a JSON object")?;
        let mut connection = self.connection.lock().map_err(|_| "Library database lock is poisoned".to_string())?;
        let transaction = connection.transaction().map_err(|e| e.to_string())?;
        for id in ids {
            let current: Option<String> = transaction.query_row(
                "SELECT details_json FROM tracks WHERE id=?1", [id], |row| row.get(0)
            ).optional().map_err(|e| e.to_string())?;
            let Some(current) = current else { continue };
            let mut details: Map<String, Value> = serde_json::from_str(&current).unwrap_or_default();
            for (key, value) in patch { details.insert(key.clone(), value.clone()); }
            let encoded = serde_json::to_string(&details).map_err(|e| e.to_string())?;
            transaction.execute("UPDATE tracks SET details_json=?1 WHERE id=?2", params![encoded, id]).map_err(|e| e.to_string())?;
        }
        transaction.commit().map_err(|e| e.to_string())
    }

    pub fn set_favorites(&self, ids: &[String], favorite: bool) -> Result<(), String> {
        let mut connection = self.connection.lock().map_err(|_| "Library database lock is poisoned".to_string())?;
        let transaction = connection.transaction().map_err(|e| e.to_string())?;
        for chunk in ids.chunks(500) {
            let mut statement = transaction.prepare("UPDATE tracks SET is_favorite=?1 WHERE id=?2").map_err(|e| e.to_string())?;
            for id in chunk { statement.execute(params![favorite, id]).map_err(|e| e.to_string())?; }
        }
        transaction.commit().map_err(|e| e.to_string())
    }

    pub fn delete_ids(&self, ids: &[String]) -> Result<(), String> {
        let mut connection = self.connection.lock().map_err(|_| "Library database lock is poisoned".to_string())?;
        let transaction = connection.transaction().map_err(|e| e.to_string())?;
        for id in ids { transaction.execute("DELETE FROM tracks WHERE id=?1", [id]).map_err(|e| e.to_string())?; }
        transaction.commit().map_err(|e| e.to_string())
    }
}

fn collation_key(value: &str) -> Vec<char> {
    value.nfd()
        .filter(|character| !unicode_normalization::char::is_combining_mark(*character))
        .flat_map(char::to_lowercase)
        .collect()
}

/// Locale-neutral, case/accent-insensitive natural ordering. It gives SQL paging the
/// numeric-aware behavior of the current UI collator for Latin and Cyrillic titles.
fn natural_compare(left: &str, right: &str) -> Ordering {
    let left = collation_key(left);
    let right = collation_key(right);
    let (mut li, mut ri) = (0, 0);

    while li < left.len() && ri < right.len() {
        if left[li].is_ascii_digit() && right[ri].is_ascii_digit() {
            let left_end = (li..left.len()).find(|&index| !left[index].is_ascii_digit()).unwrap_or(left.len());
            let right_end = (ri..right.len()).find(|&index| !right[index].is_ascii_digit()).unwrap_or(right.len());
            let left_significant = (li..left_end).find(|&index| left[index] != '0').unwrap_or(left_end);
            let right_significant = (ri..right_end).find(|&index| right[index] != '0').unwrap_or(right_end);
            let left_digits = &left[left_significant..left_end];
            let right_digits = &right[right_significant..right_end];
            let numeric_order = left_digits.len().cmp(&right_digits.len())
                .then_with(|| left_digits.cmp(right_digits));
            if numeric_order != Ordering::Equal { return numeric_order; }
            li = left_end;
            ri = right_end;
            continue;
        }
        match left[li].cmp(&right[ri]) {
            Ordering::Equal => { li += 1; ri += 1; }
            order => return order,
        }
    }
    left.len().cmp(&right.len())
}

fn sort_column(value: &str) -> &'static str {
    match value {
        "artist" => "artist",
        "album" => "album",
        "genre" => "genre",
        "year" => "year",
        "duration" => "duration",
        "dateAdded" => "date_added",
        "playCount" => "play_count",
        "trackNumber" => "track_number",
        "format" => "format",
        "fileSize" => "file_size",
        _ => "title",
    }
}

fn normalize_search(value: &str) -> String { value.trim().to_lowercase() }
fn normalize_path(value: &str) -> String { value.trim().replace('\\', "/").to_lowercase() }
fn string(value: &Value, camel: &str, snake: &str, default: &str) -> String {
    value.get(camel).or_else(|| value.get(snake)).and_then(Value::as_str).unwrap_or(default).to_string()
}
fn optional_string(value: &Value, camel: &str, snake: &str) -> Option<String> {
    value.get(camel).or_else(|| value.get(snake)).and_then(Value::as_str).filter(|s| !s.is_empty()).map(str::to_string)
}
fn number(value: &Value, camel: &str, snake: &str) -> Option<i64> {
    value.get(camel).or_else(|| value.get(snake)).and_then(Value::as_i64)
}

fn upsert_one(transaction: &Transaction<'_>, value: &Value) -> Result<(), String> {
    let incoming_id = value.get("id").and_then(Value::as_str).filter(|v| !v.is_empty()).ok_or("Track has no ID")?;
    let path = optional_string(value, "path", "path");
    let path_key = path.as_deref().map(normalize_path);
    // A rescan can produce a fresh ID for an already-known file. Keep the existing ID
    // so playlist and queue references survive rescans.
    let legacy_state: Option<(String, bool, i64, i64)> = if let Some(path_key) = path_key.as_deref() {
        transaction.query_row(
            "SELECT old_id,is_favorite,play_count,date_added FROM legacy_path_map WHERE path_key=?1",
            [path_key],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        ).optional().map_err(|e| e.to_string())?
    } else {
        None
    };
    let existing_path_id = if let Some(path_key) = path_key.as_deref() {
        transaction.query_row("SELECT id FROM tracks WHERE path_key=?1", [path_key], |row| row.get::<_, String>(0)).optional().map_err(|e| e.to_string())?
    } else {
        None
    };
    let id = existing_path_id.as_deref().or_else(|| legacy_state.as_ref().map(|state| state.0.as_str())).unwrap_or(incoming_id);
    let existing_state: Option<(i64, i64, bool, bool)> = transaction.query_row(
        "SELECT date_added,play_count,is_favorite,is_missing FROM tracks WHERE id=?1",
        [id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
    ).optional().map_err(|e| e.to_string())?;
    let date_added = number(value, "dateAdded", "date_added")
        .or_else(|| existing_state.map(|state| state.0))
        .or_else(|| legacy_state.as_ref().map(|state| state.3))
        .unwrap_or_else(|| std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis().min(i64::MAX as u128) as i64);
    let play_count = number(value, "playCount", "play_count")
        .or_else(|| existing_state.map(|state| state.1))
        .or_else(|| legacy_state.as_ref().map(|state| state.2)).unwrap_or(0);
    let is_favorite = value.get("isFavorite").or_else(|| value.get("is_favorite")).and_then(Value::as_bool)
        .or_else(|| existing_state.map(|state| state.2))
        .or_else(|| legacy_state.as_ref().map(|state| state.1)).unwrap_or(false);
    let is_missing = value.get("isMissing").or_else(|| value.get("is_missing")).and_then(Value::as_bool)
        .or_else(|| existing_state.map(|state| state.3)).unwrap_or(false);
    let title = string(value, "title", "title", "Unknown");
    let artist = string(value, "artist", "artist", "Unknown Artist");
    let album = string(value, "album", "album", "Unknown Album");
    let genre = optional_string(value, "genre", "genre");
    let mut details = Map::new();
    for key in DETAIL_KEYS {
        if let Some(item) = value.get(*key) {
            let normalized = match *key {
                "is_instrumental" => "isInstrumental",
                "content_group" => "contentGroup",
                "custom_tags" => "customTags",
                other => other,
            };
            details.insert(normalized.to_string(), item.clone());
        }
    }
    let current_details = transaction.query_row("SELECT details_json FROM tracks WHERE id=?1", [id], |row| row.get::<_, String>(0))
        .optional().map_err(|e| e.to_string())?;
    let mut merged_details: Map<String, Value> = current_details
        .and_then(|json| serde_json::from_str(&json).ok())
        .unwrap_or_default();
    for (key, detail) in details { merged_details.insert(key, detail); }
    let details_json = serde_json::to_string(&Value::Object(merged_details)).map_err(|e| e.to_string())?;
    let mut search_parts = vec![title.clone(), artist.clone(), album.clone()];
    if let Some(g) = &genre { search_parts.push(g.clone()); }
    if let Some(p) = &path { search_parts.push(p.clone()); }
    let search_text = search_parts.join("\n").to_lowercase();
    let src = path.clone().unwrap_or_else(|| string(value, "src", "src", ""));
    let raw_cover = optional_string(value, "coverArt", "cover_art");
    let cover_art = raw_cover.map(|cover| {
        crate::storage::to_portable_cover(&cover, &crate::storage::get_portable_base_dir()).unwrap_or(cover)
    });
    transaction.execute(
        "INSERT INTO tracks (id,path,path_key,title,artist,album,genre,year,track_number,track_total,duration,src,cover_art,bitrate,format,file_size,date_added,play_count,is_favorite,is_missing,search_text,details_json)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22)
         ON CONFLICT(id) DO UPDATE SET path=excluded.path,path_key=excluded.path_key,title=excluded.title,artist=excluded.artist,album=excluded.album,genre=excluded.genre,year=excluded.year,track_number=excluded.track_number,track_total=excluded.track_total,duration=excluded.duration,src=excluded.src,cover_art=excluded.cover_art,bitrate=excluded.bitrate,format=excluded.format,file_size=excluded.file_size,date_added=excluded.date_added,play_count=excluded.play_count,is_favorite=excluded.is_favorite,is_missing=excluded.is_missing,search_text=excluded.search_text,details_json=excluded.details_json",
        params![
            id, path, path_key, title, artist, album, genre,
            number(value,"year","year"), number(value,"trackNumber","track_number"), number(value,"trackTotal","track_total"),
            value.get("duration").and_then(Value::as_f64).or_else(|| value.get("duration_seconds").and_then(Value::as_f64)).unwrap_or(0.0),
            src, cover_art, number(value,"bitrate","bitrate"), optional_string(value,"format","format"),
            number(value,"fileSize","file_size"), date_added, play_count, is_favorite, is_missing, search_text, details_json
        ],
    ).map_err(|e| format!("Save track {id}: {e}"))?;
    if let Some(path_key) = path_key {
        transaction.execute("DELETE FROM legacy_path_map WHERE path_key=?1", [path_key]).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn row_to_summary(row: &rusqlite::Row<'_>) -> rusqlite::Result<TrackSummary> {
    let year: Option<i64> = row.get(6)?;
    let track_number: Option<i64> = row.get(7)?;
    let track_total: Option<i64> = row.get(8)?;
    let bitrate: Option<i64> = row.get(12)?;
    let file_size: Option<i64> = row.get(14)?;
    let play_count: i64 = row.get(16)?;
    Ok(TrackSummary {
        id: row.get(0)?, path: row.get(1)?, title: row.get(2)?, artist: row.get(3)?, album: row.get(4)?,
        genre: row.get(5)?, year: year.and_then(|value| u32::try_from(value).ok()),
        track_number: track_number.and_then(|value| u32::try_from(value).ok()),
        track_total: track_total.and_then(|value| u32::try_from(value).ok()), duration: row.get(9)?,
        src: row.get(10)?, cover_art: row.get(11)?, bitrate: bitrate.and_then(|value| u32::try_from(value).ok()),
        format: row.get(13)?, file_size: file_size.and_then(|value| u64::try_from(value).ok()),
        date_added: row.get(15)?, play_count: play_count.max(0) as u64,
        is_favorite: row.get(17)?, is_missing: row.get(18)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn database() -> LibraryDb { LibraryDb::open(":memory:").expect("database initializes") }

    #[test]
    fn natural_collation_handles_cyrillic_accents_and_numeric_sequences() {
        assert_eq!(natural_compare("Песня 2", "Песня 10"), Ordering::Less);
        assert_eq!(natural_compare("Éclair 2", "eclair 10"), Ordering::Less);
        assert_eq!(natural_compare("Ёж", "Еж"), Ordering::Equal);
    }

    #[test]
    fn stores_summary_and_details_separately_and_searches_case_insensitively() {
        let db = database();
        db.upsert_batch(&[
            json!({"id":"1","title":"Песня 10","artist":"Ёж","album":"Альбом","lyrics":"long lyrics","path":"C:\\Music\\one.flac","duration":42.0}),
            json!({"id":"2","title":"Песня 2","artist":"А","album":"Альбом","path":"C:\\Music\\two.flac"}),
        ]).unwrap();
        assert_eq!(db.count(Some("ЁЖ")).unwrap(), 1);
        let page = db.page(Some("песня"), "title", false, 0, 1).unwrap();
        assert_eq!(page.total, 2);
        assert_eq!(page.items.len(), 1);
        assert!(db.details("1").unwrap().unwrap().lyrics.unwrap().contains("long lyrics"));
    }

    #[test]
    fn rescanning_same_path_preserves_track_id_for_playlist_references() {
        let db = database();
        db.upsert_batch(&[json!({"id":"old-id","title":"Old","artist":"A","album":"B","path":"C:\\Music\\song.mp3","isFavorite":true,"playCount":9,"dateAdded":123})]).unwrap();
        db.upsert_batch(&[json!({"id":"new-id","title":"Updated","artist":"A","album":"B","path":"c:/music/SONG.mp3"})]).unwrap();
        let page = db.page(None, "title", false, 0, 10).unwrap();
        assert_eq!(page.total, 1);
        assert_eq!(page.items[0].id, "old-id");
        assert_eq!(page.items[0].title, "Updated");
        assert!(page.items[0].is_favorite);
        assert_eq!(page.items[0].play_count, 9);
        assert_eq!(page.items[0].date_added, 123);
    }

    #[test]
    fn detail_patch_merges_without_dropping_unmodified_fields() {
        let db = database();
        db.upsert_batch(&[json!({"id":"1","title":"Song","artist":"Artist","album":"Album","lyrics":"old lyrics","composer":"Composer"})]).unwrap();
        db.merge_details(&["1".into()], &json!({"lyrics":"new lyrics","comment":null})).unwrap();
        let details = db.details("1").unwrap().unwrap();
        assert_eq!(details.lyrics.as_deref(), Some("new lyrics"));
        assert_eq!(details.composer.as_deref(), Some("Composer"));
        assert_eq!(details.comment, None);
    }

    #[test]
    fn custom_tags_are_preserved_across_metadata_upsert() {
        let db = database();
        db.upsert_batch(&[json!({"id":"1","title":"Song","artist":"Artist","album":"Album","customTags":{"MOOD":"calm"}})]).unwrap();
        db.upsert_batch(&[json!({"id":"1","title":"Updated","artist":"Artist","album":"Album","lyrics":null,"composer":null})]).unwrap();
        assert_eq!(db.page(None, "title", false, 0, 10).unwrap().items[0].title, "Updated");
        assert_eq!(db.details("1").unwrap().unwrap().custom_tags, Some(json!({"MOOD":"calm"})));
    }

    #[test]
    fn legacy_path_map_preserves_playlist_ids_and_user_state_after_rescan() {
        let db = database();
        db.seed_legacy_track_map(&[LegacyTrackReference {
            id: "playlist-track-id".into(),
            path: "C:\\Music\\legacy.flac".into(),
            is_favorite: true,
            play_count: 12,
            date_added: 456,
        }]).unwrap();
        db.upsert_batch(&[json!({"id":"fresh-scan-id","title":"Rescanned","artist":"Artist","album":"Album","path":"c:/music/LEGACY.flac"})]).unwrap();
        let page = db.page(None, "title", false, 0, 10).unwrap();
        assert_eq!(page.items[0].id, "playlist-track-id");
        assert!(page.items[0].is_favorite);
        assert_eq!(page.items[0].play_count, 12);
        assert_eq!(page.items[0].date_added, 456);
    }

    #[test]
    fn upsert_is_idempotent_and_favorite_updates_are_batched() {
        let db = database();
        let item = json!({"id":"same","title":"Track","artist":"Artist","album":"Album","path":"/music/a.mp3","isFavorite":false});
        db.upsert_batch(&[item.clone(), item]).unwrap();
        assert_eq!(db.count(None).unwrap(), 1);
        db.set_favorites(&["same".to_string()], true).unwrap();
        assert!(db.page(None, "title", false, 0, 10).unwrap().items[0].is_favorite);
        db.delete_ids(&["same".to_string()]).unwrap();
        assert_eq!(db.count(None).unwrap(), 0);
    }
}
