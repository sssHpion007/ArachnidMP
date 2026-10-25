use rusqlite::{params, Connection, OptionalExtension, Transaction};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::cmp::Ordering;
use std::path::Path;
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
pub struct TrackIdReplacement {
    pub imported_id: String,
    pub retained_id: String,
}

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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryCollectionGroup {
    pub name: String,
    pub track_ids: Vec<String>,
    pub track_count: usize,
    pub cover_art: Option<String>,
    pub total_duration: f64,
    pub artist: Option<String>,
    pub year: Option<u32>,
    pub albums_count: Option<usize>,
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
        #[cfg(target_os = "windows")]
        normalize_legacy_windows_cover_urls(&connection)?;
        migrate_search_index(&connection)?;
        Ok(Self { connection: Arc::new(Mutex::new(connection)) })
    }

    pub fn ordered_subset_ids(
        &self,
        ids: &[String],
        search: Option<&str>,
        sort_by: &str,
        descending: bool,
    ) -> Result<Vec<String>, String> {
        let search = normalize_search(search.unwrap_or_default());
        let mut connection = self.connection.lock().map_err(|_| "Library database lock is poisoned".to_string())?;
        let transaction = connection.transaction().map_err(|e| e.to_string())?;
        transaction.execute_batch(
            "CREATE TEMP TABLE IF NOT EXISTS requested_track_order (ordinal INTEGER PRIMARY KEY NOT NULL, id TEXT NOT NULL);
             CREATE INDEX IF NOT EXISTS idx_requested_track_order_id ON requested_track_order(id);
             DELETE FROM requested_track_order;"
        ).map_err(|e| e.to_string())?;
        {
            let mut insert = transaction.prepare("INSERT INTO requested_track_order(id, ordinal) VALUES (?1, ?2)")
                .map_err(|e| e.to_string())?;
            for (ordinal, id) in ids.iter().enumerate() {
                insert.execute(params![id, ordinal.min(i64::MAX as usize) as i64]).map_err(|e| e.to_string())?;
            }
        }
        let direction = if descending { "DESC" } else { "ASC" };
        let order_clause = if sort_by == "custom" {
            format!("requested_track_order.ordinal {direction}")
        } else {
            format!("tracks.{} COLLATE NATURAL_NOCASE {direction}, requested_track_order.ordinal ASC", sort_column(sort_by))
        };
        let sql = format!(
            "SELECT tracks.id FROM tracks JOIN requested_track_order USING(id)
             WHERE (?1 = '' OR instr(tracks.search_text, ?1) > 0) ORDER BY {order_clause}"
        );
        let mut statement = transaction.prepare(&sql).map_err(|e| e.to_string())?;
        let rows = statement.query_map([search], |row| row.get::<_, String>(0)).map_err(|e| e.to_string())?;
        let mut ordered = Vec::new();
        for row in rows { ordered.push(row.map_err(|e| e.to_string())?); }
        drop(statement);
        transaction.commit().map_err(|e| e.to_string())?;
        Ok(ordered)
    }

    pub fn ordered_ids(
        &self,
        search: Option<&str>,
        sort_by: &str,
        descending: bool,
        favorite_only: bool,
    ) -> Result<Vec<String>, String> {
        let search = normalize_search(search.unwrap_or_default());
        let column = sort_column(sort_by);
        let direction = if descending { "DESC" } else { "ASC" };
        let sql = format!(
            "SELECT id FROM tracks WHERE (?1 = '' OR instr(search_text, ?1) > 0) AND (?2 = 0 OR is_favorite = 1) ORDER BY {column} COLLATE NATURAL_NOCASE {direction}, id {direction}"
        );
        let connection = self.connection.lock().map_err(|_| "Library database lock is poisoned".to_string())?;
        let mut statement = connection.prepare(&sql).map_err(|e| e.to_string())?;
        let rows = statement.query_map(params![search, favorite_only], |row| row.get::<_, String>(0)).map_err(|e| e.to_string())?;
        let mut ids = Vec::new();
        for row in rows { ids.push(row.map_err(|e| e.to_string())?); }
        Ok(ids)
    }

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
        self.page_filtered(search, sort_by, descending, offset, limit, None, None, false)
    }

    pub fn page_filtered(
        &self, search: Option<&str>, sort_by: &str, descending: bool, offset: u64, limit: u32,
        filter_kind: Option<&str>, filter_value: Option<&str>, favorite_only: bool,
    ) -> Result<TrackPage, String> {
        self.page_filtered_excluding(search, sort_by, descending, offset, limit, filter_kind, filter_value, favorite_only, &[])
    }

    pub fn page_filtered_excluding(
        &self, search: Option<&str>, sort_by: &str, descending: bool, offset: u64, limit: u32,
        filter_kind: Option<&str>, filter_value: Option<&str>, favorite_only: bool, excluded_ids: &[String],
    ) -> Result<TrackPage, String> {
        self.page_filtered_excluding_with_total(
            search, sort_by, descending, offset, limit, filter_kind, filter_value, favorite_only, excluded_ids, true,
        )
    }

    pub fn page_filtered_excluding_with_total(
        &self, search: Option<&str>, sort_by: &str, descending: bool, offset: u64, limit: u32,
        filter_kind: Option<&str>, filter_value: Option<&str>, favorite_only: bool, excluded_ids: &[String], include_total: bool,
    ) -> Result<TrackPage, String> {
        let limit = limit.clamp(1, 500) as u64;
        let search = normalize_search(search.unwrap_or_default());
        let filter_kind = filter_kind.unwrap_or_default();
        let filter_value = filter_value.unwrap_or_default().trim().to_string();
        let column = sort_column(sort_by);
        let direction = if descending { "DESC" } else { "ASC" };
        let predicate = "(?1 = '' OR instr(search_text, ?1) > 0)
            AND (?2 = '' OR (?2 = 'album' AND trim(album) = ?3)
                OR (?2 = 'artist' AND trim(artist) = ?3)
                OR (?2 = 'genre' AND ((?3 = '' AND (genre IS NULL OR trim(genre) = ''))
                    OR instr('|' || replace(replace(replace(replace(replace(lower(coalesce(genre,'')), ' ', ''), '/', '|'), ';', '|'), ',', '|'), char(92), '|') || '|', '|' || lower(replace(?3, ' ', '')) || '|') > 0)))
            AND (?4 = 0 OR is_favorite = 1)";
        let exclusion_clause = if excluded_ids.is_empty() {
            String::new()
        } else {
            let placeholders = (5..5 + excluded_ids.len()).map(|index| format!("?{index}"))
                .collect::<Vec<_>>().join(",");
            format!(" AND id NOT IN ({placeholders})")
        };
        let limit_parameter = 5 + excluded_ids.len();
        let offset_parameter = limit_parameter + 1;
        let sql = format!(
            "SELECT id,path,title,artist,album,genre,year,track_number,track_total,duration,src,cover_art,bitrate,format,file_size,date_added,play_count,is_favorite,is_missing
             FROM tracks WHERE {predicate}{exclusion_clause}
             ORDER BY {column} COLLATE NATURAL_NOCASE {direction}, id {direction} LIMIT ?{limit_parameter} OFFSET ?{offset_parameter}"
        );
        let connection = self.connection.lock().map_err(|_| "Library database lock is poisoned".to_string())?;
        let mut query_values = vec![
            rusqlite::types::Value::Text(search.clone()),
            rusqlite::types::Value::Text(filter_kind.to_string()),
            rusqlite::types::Value::Text(filter_value.clone()),
            rusqlite::types::Value::Integer(if favorite_only { 1 } else { 0 }),
        ];
        query_values.extend(excluded_ids.iter().cloned().map(rusqlite::types::Value::Text));
        let total = if include_total {
            let count = connection.query_row(
                &format!("SELECT COUNT(*) FROM tracks WHERE {predicate}{exclusion_clause}"),
                rusqlite::params_from_iter(query_values.iter()), |row| row.get::<_, i64>(0),
            ).map_err(|e| e.to_string())?;
            count.max(0) as u64
        } else {
            0
        };
        let mut page_values = query_values;
        page_values.push(rusqlite::types::Value::Integer(limit as i64));
        page_values.push(rusqlite::types::Value::Integer(offset.min(i64::MAX as u64) as i64));
        let mut statement = connection.prepare(&sql).map_err(|e| e.to_string())?;
        let rows = statement.query_map(rusqlite::params_from_iter(page_values.iter()), row_to_summary).map_err(|e| e.to_string())?;
        let mut items = Vec::new();
        for row in rows { items.push(row.map_err(|e| e.to_string())?); }
        Ok(TrackPage { items, offset, total })
    }

    pub fn collection_groups(
        &self, kind: &str, language: &str, search: Option<&str>, excluded_ids: &[String], include_track_ids: bool,
    ) -> Result<Vec<LibraryCollectionGroup>, String> {
        use std::collections::{HashMap, HashSet};
        let no_album = if language == "ru" { "Без альбома" } else { "No Album" };
        let unknown_artist = if language == "ru" { "Неизвестный исполнитель" } else { "Unknown Artist" };
        let no_genre = if language == "ru" { "Без жанра" } else { "No Genre" };
        if !matches!(kind, "albums" | "artists" | "genres") {
            return Err(format!("Unknown library collection kind: {kind}"));
        }
        let query = normalize_search(search.unwrap_or_default());
        let connection = self.connection.lock().map_err(|_| "Library database lock is poisoned".to_string())?;
        let mut statement = connection.prepare(
            "SELECT id,path,title,artist,album,genre,year,track_number,track_total,duration,src,cover_art,bitrate,format,file_size,date_added,play_count,is_favorite,is_missing,search_text
             FROM tracks ORDER BY title COLLATE NATURAL_NOCASE, id"
        ).map_err(|e| e.to_string())?;
        let rows = statement.query_map([], |row| {
            let summary = row_to_summary(row)?;
            let search_text: String = row.get(19)?;
            Ok((summary, search_text))
        }).map_err(|e| e.to_string())?;
        let excluded_ids: HashSet<&str> = excluded_ids.iter().map(String::as_str).collect();
        let mut groups: HashMap<String, LibraryCollectionGroup> = HashMap::new();
        let mut artist_albums: HashMap<String, HashSet<String>> = HashMap::new();
        let mut matched = HashSet::new();
        for row in rows {
            let (track, search_text) = row.map_err(|e| e.to_string())?;
            if excluded_ids.contains(track.id.as_str()) { continue; }
            let matches = query.is_empty() || search_text.contains(&query);
            let duration = if track.duration.is_finite() { track.duration.max(0.0) } else { 0.0 };
            let mut names = Vec::new();
            match kind {
                "albums" => {
                    let name = track.album.trim();
                    names.push(if name.is_empty() { no_album.to_string() } else { name.to_string() });
                }
                "artists" => {
                    let name = track.artist.trim();
                    names.push(if name.is_empty() { unknown_artist.to_string() } else { name.to_string() });
                }
                _ => {
                    let genres: HashSet<String> = track.genre.as_deref().unwrap_or("")
                        .split(|character| matches!(character, ',' | '/' | ';' | '\\'))
                        .map(str::trim).filter(|genre| !genre.is_empty()).map(str::to_string).collect();
                    if genres.is_empty() { names.push(no_genre.to_string()); }
                    else { names.extend(genres); }
                }
            }
            for name in names {
                let group = groups.entry(name.clone()).or_insert_with(|| LibraryCollectionGroup {
                    name: name.clone(), track_ids: Vec::new(), track_count: 0, cover_art: track.cover_art.clone(), total_duration: 0.0,
                    artist: if kind == "albums" {
                        let artist = track.artist.trim();
                        Some(if artist.is_empty() { unknown_artist.to_string() } else { artist.to_string() })
                    } else { None },
                    year: if kind == "albums" { track.year } else { None },
                    albums_count: None,
                });
                if include_track_ids {
                    group.track_ids.push(track.id.clone());
                }
                group.track_count += 1;
                group.total_duration += duration;
                if group.cover_art.is_none() { group.cover_art = track.cover_art.clone(); }
                if kind == "albums" && group.year.is_none() { group.year = track.year; }
                if kind == "artists" {
                    let album = if track.album.trim().is_empty() { "Unknown" } else { track.album.trim() };
                    let albums = artist_albums.entry(name.clone()).or_default();
                    albums.insert(album.to_string());
                    group.albums_count = Some(albums.len());
                }
                if matches { matched.insert(name); }
            }
        }
        let mut result: Vec<_> = groups.into_values()
            .filter(|group| query.is_empty() || group.name.to_lowercase().contains(&query) || matched.contains(&group.name))
            .collect();
        if kind == "genres" {
            result.sort_by(|left, right| right.track_ids.len().cmp(&left.track_ids.len()).then_with(|| natural_compare(&left.name, &right.name)));
        } else {
            result.sort_by(|left, right| natural_compare(&left.name, &right.name));
        }
        Ok(result)
    }

    pub fn details(&self, id: &str) -> Result<Option<TrackDetails>, String> {
        let connection = self.connection.lock().map_err(|_| "Library database lock is poisoned".to_string())?;
        let raw = connection.query_row("SELECT details_json FROM tracks WHERE id=?1", [id], |row| row.get::<_, String>(0)).optional().map_err(|e| e.to_string())?;
        raw.map(|json| serde_json::from_str(&json).map_err(|e| format!("Decode track details: {e}"))).transpose()
    }

    pub fn ids_by_paths(&self, paths: &[String]) -> Result<Vec<String>, String> {
        let connection = self.connection.lock().map_err(|_| "Library database lock is poisoned".to_string())?;
        let mut statement = connection.prepare("SELECT id FROM tracks WHERE path_key=?1")
            .map_err(|e| e.to_string())?;
        let mut ids = Vec::with_capacity(paths.len());
        for path in paths {
            let path_key = normalize_path(path);
            if let Some(id) = statement.query_row([path_key], |row| row.get::<_, String>(0)).optional().map_err(|e| e.to_string())? {
                ids.push(id);
            }
        }
        Ok(ids)
    }

    pub fn reconcile_missing_imports(&self, paths: &[String], known_existing_ids: &[String]) -> Result<Vec<TrackIdReplacement>, String> {
        let known_existing_ids = known_existing_ids.iter().map(String::as_str).collect::<std::collections::HashSet<_>>();
        let mut connection = self.connection.lock().map_err(|_| "Library database lock is poisoned".to_string())?;
        let transaction = connection.transaction().map_err(|e| e.to_string())?;

        let mut imported = Vec::with_capacity(paths.len());
        {
            let mut statement = transaction.prepare(
                "SELECT id,path,title,artist,album,genre,year,track_number,track_total,duration,src,cover_art,bitrate,format,file_size,date_added,play_count,is_favorite,is_missing,search_text,details_json
                 FROM tracks WHERE path_key=?1"
            ).map_err(|e| e.to_string())?;
            for path in paths {
                let path_key = normalize_path(path);
                if let Some((summary, search_text, details_json)) = statement.query_row([path_key], |row| {
                    Ok((row_to_summary(row)?, row.get::<_, String>(19)?, row.get::<_, String>(20)?))
                }).optional().map_err(|e| e.to_string())? {
                    imported.push((summary, search_text, details_json));
                }
            }
        }

        let mut used_missing_ids = std::collections::HashSet::new();
        let mut replacements = Vec::new();
        for (summary, search_text, details_json) in imported {
            if summary.is_missing || known_existing_ids.contains(summary.id.as_str()) { continue; }
            let Some(key) = title_artist_key(&summary.title, &summary.artist) else { continue };
            let retained_id = {
                let mut statement = transaction.prepare(
                    "SELECT id,title,artist FROM tracks WHERE title=?1 COLLATE NATURAL_NOCASE AND is_missing=1 ORDER BY rowid"
                ).map_err(|e| e.to_string())?;
                let mut rows = statement.query([&summary.title]).map_err(|e| e.to_string())?;
                let mut match_id = None;
                while let Some(row) = rows.next().map_err(|e| e.to_string())? {
                    let id: String = row.get(0).map_err(|e| e.to_string())?;
                    let title: String = row.get(1).map_err(|e| e.to_string())?;
                    let artist: String = row.get(2).map_err(|e| e.to_string())?;
                    if id != summary.id && !used_missing_ids.contains(&id)
                        && title_artist_key(&title, &artist).as_deref() == Some(key.as_str())
                    {
                        match_id = Some(id);
                        break;
                    }
                }
                match_id
            };
            let Some(retained_id) = retained_id else { continue };
            used_missing_ids.insert(retained_id.clone());

            transaction.execute("DELETE FROM tracks WHERE id=?1", [&summary.id]).map_err(|e| e.to_string())?;
            let changed = transaction.execute(
                "UPDATE tracks SET path=?1,path_key=?2,title=?3,artist=?4,album=?5,genre=?6,year=?7,track_number=?8,track_total=?9,duration=?10,src=?11,cover_art=?12,bitrate=?13,format=?14,file_size=?15,is_missing=0,search_text=?16,details_json=?17 WHERE id=?18 AND is_missing=1",
                params![
                    summary.path,
                    summary.path.as_deref().map(normalize_path),
                    summary.title,
                    summary.artist,
                    summary.album,
                    summary.genre,
                    summary.year,
                    summary.track_number,
                    summary.track_total,
                    summary.duration,
                    summary.src,
                    summary.cover_art,
                    summary.bitrate,
                    summary.format,
                    summary.file_size,
                    search_text,
                    details_json,
                    retained_id,
                ],
            ).map_err(|e| e.to_string())?;
            if changed != 1 {
                return Err(format!("Missing track {retained_id} changed during import reconciliation"));
            }
            if let Some(path) = summary.path.as_deref() {
                let path_key = normalize_path(path);
                transaction.execute("DELETE FROM legacy_path_map WHERE path_key=?1", [path_key]).map_err(|e| e.to_string())?;
            }
            replacements.push(TrackIdReplacement { imported_id: summary.id, retained_id });
        }
        transaction.commit().map_err(|e| e.to_string())?;
        Ok(replacements)
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

    pub fn merge_summary(&self, ids: &[String], patch: &Value) -> Result<usize, String> {
        let patch = patch.as_object().ok_or("Track summary patch must be a JSON object")?;
        let mut connection = self.connection.lock().map_err(|_| "Library database lock is poisoned".to_string())?;
        let transaction = connection.transaction().map_err(|e| e.to_string())?;
        let mut changed = 0usize;
        for id in ids {
            let current = transaction.query_row(
                "SELECT title,artist,album,genre,year,track_number,track_total,cover_art FROM tracks WHERE id=?1",
                [id],
                |row| Ok((
                    row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?,
                    row.get::<_, Option<String>>(3)?, row.get::<_, Option<i64>>(4)?,
                    row.get::<_, Option<i64>>(5)?, row.get::<_, Option<i64>>(6)?,
                    row.get::<_, Option<String>>(7)?,
                )),
            ).optional().map_err(|e| e.to_string())?;
            let Some((current_title, current_artist, current_album, current_genre, current_year, current_number, current_total, current_cover)) = current else { continue };
            let title = patch.get("title").and_then(Value::as_str).map(str::to_string).unwrap_or(current_title);
            let artist = patch.get("artist").and_then(Value::as_str).map(str::to_string).unwrap_or(current_artist);
            let album = patch.get("album").and_then(Value::as_str).map(str::to_string).unwrap_or(current_album);
            let genre = match patch.get("genre") {
                Some(Value::Null) => None,
                Some(Value::String(value)) if value.is_empty() => None,
                Some(Value::String(value)) => Some(value.clone()),
                _ => current_genre,
            };
            let numeric = |camel: &str, current: Option<i64>| -> Option<i64> {
                match patch.get(camel) {
                    Some(Value::Null) => None,
                    Some(value) => value.as_i64().or_else(|| value.as_u64().and_then(|n| i64::try_from(n).ok())),
                    None => current,
                }
            };
            let year = numeric("year", current_year);
            let track_number = numeric("trackNumber", current_number);
            let track_total = numeric("trackTotal", current_total);
            let cover_art = match patch.get("coverArt") {
                Some(Value::Null) => None,
                Some(Value::String(value)) if value.is_empty() => None,
                Some(Value::String(value)) => Some(value.clone()),
                _ => current_cover,
            };
            let mut search_parts = vec![title.clone(), artist.clone(), album.clone()];
            if let Some(genre) = &genre { search_parts.push(genre.clone()); }
            let search_text = search_parts.join("\n").to_lowercase();
            changed += transaction.execute(
                "UPDATE tracks SET title=?1,artist=?2,album=?3,genre=?4,year=?5,track_number=?6,track_total=?7,cover_art=?8,search_text=?9 WHERE id=?10",
                params![title, artist, album, genre, year, track_number, track_total, cover_art, search_text, id],
            ).map_err(|e| e.to_string())?;
        }
        transaction.commit().map_err(|e| e.to_string())?;
        Ok(changed)
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

    pub fn set_missing(&self, ids: &[String], missing: bool) -> Result<usize, String> {
        let mut connection = self.connection.lock().map_err(|_| "Library database lock is poisoned".to_string())?;
        let transaction = connection.transaction().map_err(|e| e.to_string())?;
        let mut changed = 0usize;
        {
            let mut statement = transaction.prepare("UPDATE tracks SET is_missing=?1 WHERE id=?2").map_err(|e| e.to_string())?;
            for id in ids {
                changed += statement.execute(params![missing, id]).map_err(|e| e.to_string())?;
            }
        }
        transaction.commit().map_err(|e| e.to_string())?;
        Ok(changed)
    }

    pub fn delete_ids(&self, ids: &[String]) -> Result<(), String> {
        let mut connection = self.connection.lock().map_err(|_| "Library database lock is poisoned".to_string())?;
        let transaction = connection.transaction().map_err(|e| e.to_string())?;
        for id in ids { transaction.execute("DELETE FROM tracks WHERE id=?1", [id]).map_err(|e| e.to_string())?; }
        transaction.commit().map_err(|e| e.to_string())
    }

    pub fn cached_cover_links(&self) -> Result<Vec<(String, Option<String>)>, String> {
        let connection = self.connection.lock().map_err(|_| "Library database lock is poisoned".to_string())?;
        let mut statement = connection.prepare(
            "SELECT id,cover_art FROM tracks
             WHERE cover_art LIKE 'https://cover.localhost/%'
                OR cover_art LIKE 'http://cover.localhost/%'
                OR cover_art LIKE 'cover://localhost/%'"
        ).map_err(|error| error.to_string())?;
        let rows = statement.query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
            .map_err(|error| error.to_string())?;
        rows.collect::<rusqlite::Result<Vec<_>>>().map_err(|error| error.to_string())
    }

    pub fn cover_links_for_paths(&self, paths: &[String]) -> Result<Vec<(String, Option<String>)>, String> {
        let connection = self.connection.lock().map_err(|_| "Library database lock is poisoned".to_string())?;
        let mut statement = connection.prepare("SELECT id,cover_art FROM tracks WHERE path_key=?1")
            .map_err(|error| error.to_string())?;
        let mut links = Vec::new();
        for path in paths {
            let path_key = normalize_path(path);
            if let Some(link) = statement.query_row([path_key], |row| Ok((row.get(0)?, row.get(1)?)))
                .optional().map_err(|error| error.to_string())? {
                links.push(link);
            }
        }
        Ok(links)
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

fn title_artist_key(title: &str, artist: &str) -> Option<String> {
    let key = format!("{}|||{}", title.trim().to_lowercase(), artist.trim().to_lowercase());
    if key == "|||" || key == "unknown|||unknown artist" { None } else { Some(key) }
}
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
        if let Some(item) = value.get(*key).filter(|item| !item.is_null()) {
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
    let search_text = search_parts.join("\n").to_lowercase();
    let src = path.clone().unwrap_or_else(|| string(value, "src", "src", ""));
    // A scanner may fail to inspect tags or persist the artwork because of a transient
    // I/O/cache error. In that case preserve the last known cover instead of treating
    // the missing result as an explicit removal. A completed scan with no cover still
    // serializes coverArt: null and clears the old link as intended.
    let cover_scan_incomplete = value.get("coverArtScanComplete")
        .or_else(|| value.get("cover_art_scan_complete"))
        .and_then(Value::as_bool) == Some(false);
    let cover_field_present = !cover_scan_incomplete
        && (value.get("coverArt").is_some() || value.get("cover_art").is_some());
    let raw_cover = optional_string(value, "coverArt", "cover_art");
    let cover_art = raw_cover.map(|cover| {
        crate::storage::to_portable_cover(&cover, &crate::storage::get_portable_base_dir()).unwrap_or(cover)
    });
    transaction.execute(
        "INSERT INTO tracks (id,path,path_key,title,artist,album,genre,year,track_number,track_total,duration,src,cover_art,bitrate,format,file_size,date_added,play_count,is_favorite,is_missing,search_text,details_json)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22)
         ON CONFLICT(id) DO UPDATE SET path=excluded.path,path_key=excluded.path_key,title=excluded.title,artist=excluded.artist,album=excluded.album,genre=excluded.genre,year=excluded.year,track_number=excluded.track_number,track_total=excluded.track_total,duration=excluded.duration,src=excluded.src,cover_art=CASE WHEN ?23 THEN excluded.cover_art ELSE tracks.cover_art END,bitrate=excluded.bitrate,format=excluded.format,file_size=excluded.file_size,date_added=excluded.date_added,play_count=excluded.play_count,is_favorite=excluded.is_favorite,is_missing=excluded.is_missing,search_text=excluded.search_text,details_json=excluded.details_json",
        params![
            id, path, path_key, title, artist, album, genre,
            number(value,"year","year"), number(value,"trackNumber","track_number"), number(value,"trackTotal","track_total"),
            value.get("duration").and_then(Value::as_f64).or_else(|| value.get("duration_seconds").and_then(Value::as_f64)).unwrap_or(0.0),
            src, cover_art, number(value,"bitrate","bitrate"), optional_string(value,"format","format"),
            number(value,"fileSize","file_size"), date_added, play_count, is_favorite, is_missing, search_text, details_json, cover_field_present
        ],
    ).map_err(|e| format!("Save track {id}: {e}"))?;
    if let Some(path_key) = path_key {
        transaction.execute("DELETE FROM legacy_path_map WHERE path_key=?1", [path_key]).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn normalize_legacy_windows_cover_urls(connection: &Connection) -> Result<(), String> {
    // Earlier builds stored HTTPS URLs, but Tauri's default Windows custom-protocol
    // origin is HTTP. Rewrite only this app's cache origin; artwork hashes/BLOBs stay intact.
    connection.execute(
        "UPDATE tracks
         SET cover_art=replace(cover_art, 'https://cover.localhost/', 'http://cover.localhost/')
         WHERE cover_art LIKE 'https://cover.localhost/%'",
        [],
    ).map_err(|error| format!("Normalize cached cover URLs for Windows: {error}"))?;
    Ok(())
}

fn migrate_search_index(connection: &Connection) -> Result<(), String> {
    let version = connection.query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
        .map_err(|error| format!("Read library database version: {error}"))?;
    if version >= 1 { return Ok(()); }

    // Rebuild the Unicode-aware substring index in bounded batches. This also removes
    // legacy path text so native search exactly matches the previous title/artist/album/genre filter.
    let mut last_rowid = 0i64;
    loop {
        let batch: Vec<(i64, String, String, String, Option<String>)> = {
            let mut statement = connection.prepare(
                "SELECT rowid,title,artist,album,genre FROM tracks WHERE rowid>?1 ORDER BY rowid LIMIT 500"
            ).map_err(|error| format!("Prepare library search migration: {error}"))?;
            let rows = statement.query_map([last_rowid], |row| Ok((
                row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?,
            ))).map_err(|error| format!("Read library search migration batch: {error}"))?;
            rows.collect::<rusqlite::Result<Vec<_>>>()
                .map_err(|error| format!("Decode library search migration batch: {error}"))?
        };
        if batch.is_empty() { break; }
        let mut update = connection.prepare("UPDATE tracks SET search_text=?1 WHERE rowid=?2")
            .map_err(|error| format!("Prepare library search index update: {error}"))?;
        for (rowid, title, artist, album, genre) in batch {
            let mut fields = vec![title, artist, album];
            if let Some(genre) = genre { fields.push(genre); }
            update.execute(params![fields.join("\n").to_lowercase(), rowid])
                .map_err(|error| format!("Update library search index: {error}"))?;
            last_rowid = rowid;
        }
    }
    connection.pragma_update(None, "user_version", 1i64)
        .map_err(|error| format!("Save library database version: {error}"))
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
    fn explicit_rescan_cover_value_replaces_or_clears_but_missing_field_preserves_it() {
        let db = database();
        let cover = format!("https://cover.localhost/{}/original", "a".repeat(64));
        db.upsert_batch(&[json!({
            "id":"scan-1", "path":"C:\\\\Music\\\\scan.flac", "title":"Scan",
            "artist":"Artist", "album":"Album", "coverArt":cover.clone()
        })]).unwrap();
        assert_eq!(db.summaries_by_ids(&["scan-1".into()]).unwrap()[0].cover_art.as_deref(), Some(cover.as_str()));

        db.upsert_batch(&[json!({"id":"fresh-id", "path":"C:\\\\Music\\\\scan.flac", "title":"Scan again"})]).unwrap();
        assert_eq!(db.summaries_by_ids(&["scan-1".into()]).unwrap()[0].cover_art.as_deref(), Some(cover.as_str()));

        db.upsert_batch(&[json!({
            "id":"fresh-id-2", "path":"C:\\\\Music\\\\scan.flac", "title":"Scan could not read art",
            "coverArt":null, "cover_art_scan_complete":false
        })]).unwrap();
        assert_eq!(db.summaries_by_ids(&["scan-1".into()]).unwrap()[0].cover_art.as_deref(), Some(cover.as_str()));

        db.upsert_batch(&[json!({
            "id":"fresh-id-3", "path":"C:\\\\Music\\\\scan.flac", "title":"Scan completed without art",
            "coverArt":null, "cover_art_scan_complete":true
        })]).unwrap();
        assert_eq!(db.summaries_by_ids(&["scan-1".into()]).unwrap()[0].cover_art, None);
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn legacy_https_cover_urls_are_rewritten_to_tauri_windows_origin() {
        let db = database();
        let legacy_url = format!("https://cover.localhost/{}/original", "b".repeat(64));
        db.upsert_batch(&[json!({
            "id":"legacy-cover", "path":"C:\\\\Music\\\\legacy.flac", "title":"Legacy",
            "coverArt":legacy_url
        })]).unwrap();
        normalize_legacy_windows_cover_urls(&db.connection.lock().unwrap()).unwrap();
        let expected = format!("http://cover.localhost/{}/original", "b".repeat(64));
        assert_eq!(db.summaries_by_ids(&["legacy-cover".into()]).unwrap()[0].cover_art.as_deref(), Some(expected.as_str()));
    }

    #[test]
    fn collection_groups_are_built_from_the_native_catalog_without_track_details() {
        let db = database();
        db.upsert_batch(&[
            json!({"id":"1","title":"Song 1","artist":"Artist","album":"Album","genre":"Rock; Jazz","duration":10.0,"path":"/music/1.flac"}),
            json!({"id":"2","title":"Song 2","artist":"Artist","album":"Album","genre":"Rock","duration":20.0,"path":"/music/2.flac"}),
            json!({"id":"3","title":"Other","artist":"Other Artist","album":"Other Album","genre":"Jazz","duration":30.0,"path":"/music/3.flac"}),
        ]).unwrap();
        let albums = db.collection_groups("albums", "en", None, &[], true).unwrap();
        assert_eq!(albums.len(), 2);
        assert_eq!(albums[0].name, "Album");
        assert_eq!(albums[0].track_ids, vec!["1", "2"]);
        assert_eq!(albums[0].total_duration, 30.0);
        let mini_albums = db.collection_groups("albums", "en", None, &[], false).unwrap();
        assert_eq!(mini_albums[0].track_count, 2);
        assert!(mini_albums.iter().all(|group| group.track_ids.is_empty()));
        let genres = db.collection_groups("genres", "en", Some("song 1"), &[], true).unwrap();
        assert_eq!(genres.len(), 2);
        let rock = genres.iter().find(|group| group.name == "Rock").unwrap();
        let jazz = genres.iter().find(|group| group.name == "Jazz").unwrap();
        assert_eq!(rock.track_ids, vec!["1", "2"]);
        assert_eq!(jazz.track_ids, vec!["3", "1"]);
        let excluded = vec!["1".to_string()];
        let remaining = db.page_filtered_excluding(
            None, "title", false, 0, 10, Some("album"), Some("Album"), false, &excluded,
        ).unwrap();
        assert_eq!(remaining.total, 1);
        assert_eq!(remaining.items.iter().map(|track| track.id.as_str()).collect::<Vec<_>>(), vec!["2"]);
    }

    #[test]
    fn page_ranges_can_skip_recounting_after_the_view_total_is_known() {
        let db = database();
        db.upsert_batch(&[
            json!({"id":"1","title":"Track 1","artist":"A","album":"Album","duration":10.0}),
            json!({"id":"2","title":"Track 2","artist":"A","album":"Album","duration":20.0}),
        ]).unwrap();

        let first = db.page_filtered_excluding_with_total(
            None, "title", false, 0, 1, None, None, false, &[], true,
        ).unwrap();
        assert_eq!(first.total, 2);
        assert_eq!(first.items.len(), 1);

        let next = db.page_filtered_excluding_with_total(
            None, "title", false, 1, 1, None, None, false, &[], false,
        ).unwrap();
        assert_eq!(next.total, 0);
        assert_eq!(next.items[0].id, "2");
    }

    #[test]
    fn database_pages_keep_natural_text_and_numeric_sort_order() {
        let db = database();
        db.upsert_batch(&[
            json!({"id":"10","title":"Track 10","artist":"B","album":"Album","duration":10.0}),
            json!({"id":"2","title":"Track 2","artist":"A","album":"Album","duration":2.0}),
        ]).unwrap();
        let ascending = db.page(None, "title", false, 0, 10).unwrap();
        assert_eq!(ascending.items.iter().map(|item| item.id.as_str()).collect::<Vec<_>>(), vec!["2", "10"]);
        let descending = db.page(None, "title", true, 0, 10).unwrap();
        assert_eq!(descending.items.iter().map(|item| item.id.as_str()).collect::<Vec<_>>(), vec!["10", "2"]);
        let duration = db.page(None, "duration", false, 0, 10).unwrap();
        assert_eq!(duration.items[0].id, "2");
        assert_eq!(db.ordered_ids(None, "title", false, false).unwrap(), vec!["2", "10"]);
        assert_eq!(db.ordered_subset_ids(&["10".into(), "2".into(), "10".into()], None, "custom", false).unwrap(), vec!["10", "2", "10"]);
        assert_eq!(db.ordered_subset_ids(&["10".into(), "2".into()], None, "title", false).unwrap(), vec!["2", "10"]);
    }

    #[test]
    fn filtered_pages_support_exact_genre_tokens_and_favorites() {
        let db = database();
        db.upsert_batch(&[
            json!({"id":"1","title":"Rock track","artist":"A","album":"One","genre":"Classic Rock; Jazz","isFavorite":true}),
            json!({"id":"2","title":"Other","artist":"A","album":"One","genre":"Hard Rock","isFavorite":true}),
            json!({"id":"3","title":"Rock track","artist":"A","album":"Two","genre":"Classic Rock","isFavorite":false}),
        ]).unwrap();
        let page = db.page_filtered(Some("rock track"), "title", false, 0, 10, Some("genre"), Some("Classic Rock"), true).unwrap();
        assert_eq!(page.total, 1);
        assert_eq!(page.items[0].id, "1");
        assert_eq!(db.ordered_subset_ids(&["2".into(), "1".into()], Some("rock track"), "custom", false).unwrap(), vec!["1"]);
    }

    #[test]
    fn search_matches_only_the_fields_used_by_the_existing_ui_filter() {
        let db = database();
        db.upsert_batch(&[json!({"id":"1","title":"Песня","artist":"Ёж","album":"Альбом","genre":"Rock","path":"/private/needle.flac"})]).unwrap();
        assert_eq!(db.count(Some("песн")).unwrap(), 1);
        assert_eq!(db.count(Some("ёж")).unwrap(), 1);
        assert_eq!(db.count(Some("needle" )).unwrap(), 0);
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
    fn reimport_reuses_evicted_missing_track_id_by_title_and_artist() {
        let db = database();
        db.upsert_batch(&[json!({"id":"stable-id","title":"Ёж и песня","artist":"Группа","album":"Альбом","path":"/old/song.flac","isFavorite":true,"playCount":7,"dateAdded":123})]).unwrap();
        db.set_missing(&["stable-id".into()], true).unwrap();
        db.upsert_batch(&[json!({"id":"new-id","title":"ёж и песня","artist":"ГРУППА","album":"Альбом 2","path":"/new/song.flac"})]).unwrap();

        let replacements = db.reconcile_missing_imports(&["/new/song.flac".into()], &[]).unwrap();
        assert_eq!(replacements.len(), 1);
        assert_eq!(replacements[0].imported_id, "new-id");
        assert_eq!(replacements[0].retained_id, "stable-id");
        let page = db.page(None, "title", false, 0, 10).unwrap();
        assert_eq!(page.total, 1);
        assert_eq!(page.items[0].id, "stable-id");
        assert_eq!(page.items[0].path.as_deref(), Some("/new/song.flac"));
        assert!(!page.items[0].is_missing);
        assert!(page.items[0].is_favorite);
        assert_eq!(page.items[0].play_count, 7);
        assert_eq!(page.items[0].date_added, 123);
    }

    #[test]
    fn rescanning_an_existing_path_does_not_consume_another_missing_duplicate() {
        let db = database();
        db.upsert_batch(&[
            json!({"id":"missing-id","title":"Same title","artist":"Same artist","path":"/old/song.mp3","isMissing":true}),
            json!({"id":"active-id","title":"Same title","artist":"Same artist","path":"/new/song.mp3"}),
        ]).unwrap();

        let replacements = db.reconcile_missing_imports(&["/new/song.mp3".into()], &["active-id".into()]).unwrap();
        assert!(replacements.is_empty());
        let page = db.page(None, "title", false, 0, 10).unwrap();
        assert_eq!(page.total, 2);
        assert!(page.items.iter().any(|track| track.id == "missing-id" && track.is_missing));
        assert!(page.items.iter().any(|track| track.id == "active-id" && !track.is_missing));
    }

    #[test]
    fn summary_patch_updates_searchable_columns_without_losing_user_state() {
        let db = database();
        db.upsert_batch(&[json!({"id":"1","title":"Old","artist":"Artist","album":"Album","genre":"Rock","isFavorite":true,"playCount":3})]).unwrap();
        db.merge_summary(&["1".into()], &json!({"title":"New Title","genre":"Jazz"})).unwrap();
        assert_eq!(db.count(Some("old")).unwrap(), 0);
        assert_eq!(db.count(Some("new title")).unwrap(), 1);
        let track = db.page(Some("jazz"), "title", false, 0, 10).unwrap().items.remove(0);
        assert!(track.is_favorite);
        assert_eq!(track.play_count, 3);
        assert_eq!(track.genre.as_deref(), Some("Jazz"));
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
    fn rescan_without_cover_does_not_erase_existing_cover() {
        let db = database();
        db.upsert_batch(&[json!({
            "id":"1", "title":"Song", "artist":"Artist", "album":"Album",
            "coverArt":"config/covers/album.jpg"
        })]).unwrap();
        db.upsert_batch(&[json!({
            "id":"1", "title":"Song", "artist":"Artist", "album":"Album"
        })]).unwrap();
        assert_eq!(db.summaries_by_ids(&["1".into()]).unwrap()[0].cover_art.as_deref(), Some("config/covers/album.jpg"));
    }

    #[test]
    fn custom_tags_are_preserved_across_metadata_upsert() {
        let db = database();
        db.upsert_batch(&[json!({"id":"1","title":"Song","artist":"Artist","album":"Album","lyrics":"saved lyrics","customTags":{"MOOD":"calm"}})]).unwrap();
        db.upsert_batch(&[json!({"id":"1","title":"Updated","artist":"Artist","album":"Album","lyrics":null,"composer":null})]).unwrap();
        assert_eq!(db.page(None, "title", false, 0, 10).unwrap().items[0].title, "Updated");
        let details = db.details("1").unwrap().unwrap();
        assert_eq!(details.lyrics.as_deref(), Some("saved lyrics"));
        assert_eq!(details.custom_tags, Some(json!({"MOOD":"calm"})));
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
        assert_eq!(db.ids_by_paths(&["/MUSIC/a.mp3".into()]).unwrap(), vec!["same"]);
        db.set_favorites(&["same".to_string()], true).unwrap();
        assert!(db.page(None, "title", false, 0, 10).unwrap().items[0].is_favorite);
        db.delete_ids(&["same".to_string()]).unwrap();
        assert_eq!(db.count(None).unwrap(), 0);
    }

    #[test]
    fn missing_status_updates_rows_outside_the_visible_page() {
        let db = database();
        db.upsert_batch(&[
            json!({"id":"1","title":"Track 1","artist":"Artist","album":"Album","path":"/music/1.flac"}),
            json!({"id":"2","title":"Track 2","artist":"Artist","album":"Album","path":"/music/2.flac"}),
        ]).unwrap();
        assert_eq!(db.set_missing(&["2".into()], true).unwrap(), 1);
        let row = db.summaries_by_ids(&["2".into()]).unwrap().pop().unwrap();
        assert!(row.is_missing);
        assert_eq!(db.set_missing(&["2".into()], false).unwrap(), 1);
        assert!(!db.summaries_by_ids(&["2".into()]).unwrap()[0].is_missing);
    }
}
