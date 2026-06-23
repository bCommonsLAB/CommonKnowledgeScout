# Phase 1 — Audit: alle Shadow-Twin-Auflöse- & Schreibpfade

Status: BEFUND (2026-06-23, aus Code + Live-Trace 0a/0b + Daten-Snapshot 0c)
Belege als `Datei:Zeile`.

> Entscheidungsspalte: **Behalten** / **Ersetzen** (durch kanonischen Resolver) / **Entfernen** /
> **Explizit** (nur noch per Button/Skript, nie als Lese-Nebenwirkung).

---

## A. Lese-Pfade

| # | Pfad / Endpoint | Methode | Quelle | Resolver-Kette | Fallback | Schreibt beim Lesen? | Konsument | Entscheidung |
|---|---|---|---|---|---|---|---|---|
| L1 | `shadow-twins/content` | GET | **Mongo (pur)** | `getShadowTwinArtifact`→`pickArtifact` | keiner (400 wenn ≠mongo) | **nein** | Transkript-/Transformation-Tab (`file-preview.tsx:595`), Übersicht (`artifact-info-panel.tsx:113`) | **Behalten → Basis des Resolvers** |
| L2 | `shadow-twins/[sourceId]` | GET | **Mongo (pur)** | `getAllArtifacts`→`readTranscriptRecord` | keiner | **nein** | Übersicht (`artifact-info-panel.tsx:73`), Transkript-Dropdown | **Behalten** (über Resolver bündeln; Doppel-Calls weg) |
| L3 | `artifacts/resolve` | GET | Service→Provider | `getMarkdown`→`resolveArtifact`/`pickBest*` + **`reconstructFromFolder`** | Service→Provider→Self-Ref | **JA** (`route:107/161/173`, `getMarkdown→lazyReconstruct shadow-twin-service.ts:246`) | **Transkript-Tab** via `useResolvedTranscriptItem.ts:44` | **Ersetzen** (Write-on-Read raus, durch L1) |
| L4 | `artifacts/batch-resolve` | POST | Mongo + (opt.) FS-Scan | `selectShadowTwinArtifact`; FS: `resolveArtifact`/`pickBest*`+`resolveFromStorageFallback` | `allowFilesystemFallback`/`persistToFilesystem` → FS-Scan (`:332`) | nein (Client schreibt danach via reconstruct) | `use-shadow-twin-analysis.ts:300` (file-list, Bulk) | **Ersetzen** (FS-Scan raus; pur Mongo-Batch) |
| L5 | `shadow-twins/resolve-binary-url` | POST | Mongo→Storage **live** | `getBinaryFragments`→`matchBinaryFragmentByLookupName`→Storage-Suche | Mongo-Fragment→Twin-Ordner→Sibling | nein | Bild-Renderer (Galerie/Preview), 23×/Verzeichnis | **Behalten + reparieren** (Fragment-URLs in Mongo persistieren; batchen) |
| L6 | `shadow-twins/binary-fragments` | POST | Mongo + URL **live** | `getShadowTwinsBySourceIds`+`readTranscriptRecord`; `getStreamingUrl` **pro Fragment seriell** | Azure-URL→`getStreamingUrl` | nein | `BinaryFragmentsSection` (Übersicht) | **Behalten + reparieren** (parallelisieren; ~14,7 s → s. 0b) |
| L7 | `shadow-twins/freshness` | POST | Mongo vs. Storage | `getShadowTwinsBySourceIds`+`findArtifactInStorage`+`computeStatus` | 3-stufige Storage-Suche; 5 s-Toleranz | nein | `useShadowTwinFreshnessApi`→`file-preview.tsx:1036` | **Behalten** (read-only); pro-Öffnen drosseln |
| L8 | `loadShadowTwinMarkdown` (Loader) | lib | Service | 5-stufige Prioritäten; Mongo-Mode überspringt FS (`:643`) | template-agnostisch (`:561`), Transkript-als-Ingest (`:610`) | nein (delegiert an Service) | Pipeline (external-jobs) | **Ersetzen** (auf Resolver reduzieren) |

## B. „Welches Artefakt?"-Funktionen (die 2 Wahrheiten)

| # | Funktion | Quelle | Tie-Breaker / Toleranz | Beleg | Entscheidung |
|---|---|---|---|---|---|
| F1 | `selectShadowTwinArtifact` | Mongo-Doc | Transkript sprach-neutral; Transformation: Sprache, sonst erste, neuester `updatedAt` | `shadow-twin-select.ts:28` | **Behalten → in Resolver** |
| F2 | `readTranscriptRecord` | Mongo-Doc | Single ODER Legacy-Map („neuester gewinnt", `:112`) | `shadow-twin-repo.ts:95` | **Ersetzen** (exakter Single-Record nach Reparatur) |
| F3 | `pickArtifact` | Mongo-Doc | Pfad-Lookup | `shadow-twin-repo.ts:116` | **Behalten → in Resolver** |
| F4 | `resolveArtifact`/V2 | **Storage** | Twin-Ordner→Sibling | `artifact-resolver.ts:63` | **Entfernen** aus Lese-Pfad |
| F5 | `pickBestTranscript` | **Storage** | neutraler Name, sonst neueste `modifiedAt` | `artifact-resolver.ts:154` | **Entfernen** aus Lese-Pfad |
| F6 | `pickBestTransformation` | **Storage** | Sprach-Match, neueste `modifiedAt` | `artifact-resolver.ts:187` | **Entfernen** aus Lese-Pfad |

→ **Kern des Problems:** F1–F3 (Mongo) und F4–F6 (Storage-Dateinamen) sind zwei parallele Wahrheiten mit
unterschiedlichen Tie-Breakern, nirgends zentral zusammengeführt. Der kanonische Resolver vereint sie zu **einer** (nur Mongo).

## C. Schreib-Pfade

| # | Pfad | Methode | Schreibt | Trigger | Entscheidung |
|---|---|---|---|---|---|
| W1 | `getMarkdown`→`lazyReconstructToMongo` | lib | Mongo-Upsert | **Lese-Nebenwirkung** (FS-Fallback-Hit) | **Entfernen** |
| W2 | `artifacts/resolve` → `reconstructFromFolder` | GET | Mongo + Azure | **Lese-Nebenwirkung** (`route:107/161/173`) | **Entfernen** (Write aus GET) |
| W3 | `importStorageArtifacts`→`reconstruct` | Client | Mongo + Azure | **Auto beim Öffnen** (`use-shadow-twin-analysis.ts:51`, `foundFromStorage`) | **Explizit** (nur Button) |
| W4 | `shadow-twins/reconstruct` | POST | Mongo + Azure | manuell ODER von W3 | **Behalten als Explizit** |
| W5 | `shadow-twins/content` | POST | Mongo (+opt. Storage) | User-Edit | **Behalten** (deklarierter Write) |
| W6 | `shadow-twins/upsert` | POST | Mongo | Creation/Wizard | **Behalten** |
| W7 | `sync-from-storage` / `sync-to-storage` | POST | Storage↔Mongo | manuell (Freshness-Banner) | **Behalten als Explizit** |
| W8 | `shadow-twins/[sourceId]` | DELETE | Mongo + Storage | manuell | **Behalten** |

## D. Client-Quellen für den Transkript-Tab (3 → 1)

| Quelle | Endpoint | Entscheidung |
|---|---|---|
| `allTranscriptFiles` | `GET /shadow-twins/<id>` (nur wenn >1) | **Entfernen** |
| `shadowTwinState.transcriptFiles` | `POST /artifacts/batch-resolve` (Atom) | **Ersetzen** (1 Atom aus Resolver) |
| `transcript.transcriptItem` | `GET /artifacts/resolve` (**Write!**) → `useResolvedTranscriptItem` | **Ersetzen** (durch L1/Resolver) |
| Übersicht | `GET /shadow-twins/<id>` + `GET /content` | **Ersetzen** (gleicher Resolver) |

---

## E. Performance-Findings (aus 0a/0b — teils unabhängig vom Overwrite-Bug)

| P | Finding | Beleg | Fix-Richtung |
|---|---|---|---|
| P1 | **Bild-URLs nie in Mongo** (`fragmentCount:0`) → jedes Thumbnail live aus WebDAV | L5/L6; 0a | Fragment-URLs bei Write persistieren; Lesen rein aus Mongo |
| P2 | **23 serielle `resolve-binary-url`/Verzeichnis** (~33 s) | 0a | batchen + parallelisieren (vgl. L6) |
| P3 | **`binary-fragments` seriell** `getStreamingUrl` (~14,7 s) | `binary-fragments/route.ts:186`; 0b | parallelisieren |
| P4 | **44 Provider-Cache-Evictions/Verzeichnis** (Cache-Key mismatch) | 0a | StorageFactory-Cache-Key fixen |
| P5 | **24 Clerk-Auth-Calls `cache skip`** | 0a/0b | serverseitig cachen |
| P6 | **Tab-Wechsel re-triggert Verzeichnis-Batch** (`batch-resolve` 11,5 s erneut) | 0b | Tab-State von Verzeichnis-Analyse entkoppeln |
| P7 | **Redundante Reads/Datei**: getAllArtifacts 4×, resolve 2×, freshness 2× | 0b | ein Resolver-Call, Ergebnis cachen |
| P8 | **Sprach-Inkonsistenz** `resolve`=de vs `content`=en | 0b | eine Sprach-Quelle im Resolver |

## F. Aufräumen

- **`page_NNN.md`** (per-Seite-Markdown): kein Leser (0b bestätigt) → **nicht mehr erzeugen / nur Arbeitsdatei**.
- **`page_NNN.jpeg`** (Seiten-Renders): nötig, aber als Mongo-Fragment registrieren (P1).
