# Library storage and data virtualization

## Decision

Replace the desktop library's monolithic `library.json` track array with a local SQLite database and make the native library repository the source of truth. Keep the browser-only fallback independent. The database is portable and lives under the same portable data root as the current desktop data.

SQLite and M3U8 are the current desktop data model. The application does not read, write, or migrate `library.json` or the former monolithic `arachnid_data.json`; startup removes the retired `config/library.json`. Track metadata is stored only in SQLite, while playlist IDs and paths are stored in M3U8. On scan, SQLite reconciles moved tracks against current M3U8 references and retains playlist IDs where a match is established. Keep settings and playlist metadata separate from the catalog.

## Runtime model

- SQLite stores indexed track fields and detail fields separately. Searchable/sortable columns stay queryable in SQL; lyrics and less frequently used metadata are fetched only for the active track or details view.
- Native commands expose count, filtered page/range, grouped collection, lookup-by-ID, and batched upsert/delete operations. The UI never asks for an unbounded track query during normal browsing.
- A scan parses files incrementally and writes bounded batches to SQLite. It must not return one `Vec<TrackMetadata>` containing the whole library to JavaScript.
- React keeps only the current viewport window plus a small bounded neighbor cache. Queue and playlist membership remain IDs; playback resolves the active ID to a detail record.
- Existing table virtualization is retained, but its virtual height comes from the database count and visible index ranges are fetched on demand.

## Compatibility requirements

- Preserve substring search behavior and numeric-aware ordering currently supplied by the JavaScript search and `Intl.Collator`; SQL filtering and ordering must be tested against representative Russian/English titles and numeric track names.
- Preserve playlist ordering, favorites, playback counters, and track selection semantics when records are refreshed or paged.
- Browser mode retains its existing local-storage behavior unless it is separately migrated to IndexedDB.
- Never claim a memory reduction based only on SQLite adoption: acceptance requires proving that the frontend no longer retains a catalog-sized `Track[]` and that scan results are batched.

## Validation gates

1. Unit tests for schema initialization, batched scan upserts, page/count consistency, search, sort, details lookup, duplicate paths, and path-based playlist reconciliation.
2. Frontend tests for page changes, stable selection, playback/queue resolution, and empty/loading/error states.
3. TypeScript build and Rust tests; Windows Tauri build and startup/scan smoke test in GitHub Actions (local Rust toolchain is unavailable in this environment).
4. Inspect the diff and memory-related code paths before publishing. Do not release while either the full catalog state or full scan result still crosses into the WebView.
