# Phase 0a — Trace: Articles-Verzeichnis öffnen

Status: BEFUND (Live-Trace 2026-06-23, Preview-Server + echtes Chrome, eingeloggt)
Reproduktion: Library „Tamera" → Verzeichnis „Articles" öffnen.

> Roh-Server-Log (1154 Zeilen für EIN Öffnen): `…/tool-results/mcp-Claude_Preview-preview_logs-1782166831490.txt`.

---

## Setup beim Lauf

- Library-Id (Tamera): `bf29edda-fdc3-4ac0-ae54-90133c2e1517`, Storage = **nextcloud/WebDAV**
- Articles parentId (folderId): `QXJ0aWNsZXM=` (= base64 `Articles`)
- Articles-Inhalt: **110 Dateien**, davon **53** mit Shadow-Twin-Analyse
- Messpunkt: Klick auf „Articles" → Bulk-Analyse + Bild-Auflösung

---

## Feuernde Pfade (Server) — beim Verzeichnis-Öffnen

| # | Endpoint / Funktion | Component-String (Log) | Lesen/Schreiben | Anzahl Calls | Auffälligkeit |
|---|---|---|---|---|---|
| 1 | `GET /api/storage/nextcloud?action=path` | StorageFactory | Lesen | 1 | WebDAV |
| 2 | `GET /api/library/.../item-annotations` | — | Lesen | 1 | — |
| 3 | `GET /api/storage/nextcloud?action=list` | StorageFactory | Lesen | 1 | WebDAV-Listing |
| 4 | `POST /api/library/.../artifacts/batch-resolve` | `artifacts/batch-resolve` | Lesen | 1 | **5009 ms** |
| 5 | `POST /api/library/.../shadow-twins/resolve-binary-url` | `shadow-twins/resolve-binary-url` | Lesen | **23** | **je 743–4319 ms, seriell**, jeweils WebDAV-Fallback |
| — | StorageFactory Provider-Cache-Eviction | StorageFactory | — | **44** | Cache-Key mismatch (stale Pfad) |
| — | `GET https://api.clerk.com/v1/users/...` | Clerk | Lesen | **24** | `cache skip`, 160 ms–3,5 s |

## Feuernde Pfade (Client)

| # | Hook / Aufruf | Component-String | Anzahl Calls | Auffälligkeit |
|---|---|---|---|---|
| 1 | Ordnerwechsel → State-Reset | `useShadowTwinAnalysis` | 1 | „Ordnerwechsel erkannt" |
| 2 | Bulk-Analyse-Start (110 Dateien) | `file-list.tsx` / `useShadowTwinAnalysis` | 1 | „Analyse gestartet für 110 Dateien" |
| 3 | `batchResolveArtifactsClient` (1 Batch) | `batchResolveArtifactsClient` | 1 | 22:20:08→14 (~5 s) |
| 4 | Analyse abgeschlossen | `file-list.tsx` | 1 | **6458 ms für 53 Dateien** |
| — | **Auto-Import/Reconstruct** | `importStorageArtifacts` | **0** | feuerte NICHT (Steady-State) |

---

## Performance-Baseline

- **Wall-Clock bis Verzeichnis nutzbar:** Shadow-Twin-Analyse **6458 ms** (53 Dateien); Bild-Auflösung läuft danach noch ~30 s seriell nach.
- **HTTP-Calls gesamt (Chrome):** **27** — 1 path, 1 annotations, 1 list, 1 batch-resolve, **24 resolve-binary-url** · davon redundant: praktisch alle Binär-Calls (live statt gecacht).
- **Calls pro Datei:** ~1 `resolve-binary-url` pro Datei mit Cover → **skaliert linear** mit der Dateianzahl (110 Dateien → entsprechend viele Calls).
- **Langsamste Calls:** batch-resolve 5009 ms; resolve-binary-url-Ausreißer 4319 ms & 4041 ms; Clerk-Spitze 3519 ms.
- **Serielle WebDAV-Arbeit summiert:** ~37 s (5 s batch + ~32,6 s Binär).

## Befund

- **Redundanz (Hauptkostentreiber, unabhängig vom Overwrite-Bug):**
  1. **`resolve-binary-url` pro Datei, seriell, jeweils WebDAV-Roundtrip** (23×).
  2. **`fragmentCount: 0` überall** → Mongo speichert keine Fragment-URLs → jedes Thumbnail wird live aus dem Storage geholt (kein Caching-Nutzen der Mongo-Schicht).
  3. **44 Provider-Cache-Evictions** — StorageFactory-Cache-Key passt nie (`cachedLibraryPath: 'nicht verfügbar'` vs. realer Pfad) → Nextcloud-Provider wird ständig neu gebaut.
  4. **24 Clerk-Auth-Calls ohne Cache** (`cache skip`).
- **Reconstruct/Import beim bloßen Listen?** **Nein** in diesem Lauf (Steady-State: Mongo hat die Artefakte schon). Der Overwrite passiert nur bei Mongo-Miss → siehe 02.
- **Mehrere Quellen parallel analysiert?** Ja — Bulk über alle 53 Shadow-Twin-Dateien; die Bild-Auflösung danach seriell.
- **Schreib-Nebenwirkungen** (`lazyReconstruct`, `reconstruct`, Storage-Import): **0** (Whole-File-Suche, keine Treffer).

## Konsequenz für Plan (Performance)

- Der kanonische Resolver muss **Fragment-URLs in Mongo persistieren** (kein Live-WebDAV pro Thumbnail).
- **StorageFactory-Provider-Cache** reparieren (Cache-Key korrekt, kein Rebuild pro Datei).
- **Binär-Auflösung batchen** statt N serielle POSTs; Clerk-Auth serverseitig cachen.
- Diese Punkte als eigene Performance-Findings in Phase 1/§7 aufnehmen.

## Roh-Log-Auszüge (relevante Zeilen)

```
POST /api/library/bf29edda.../artifacts/batch-resolve 200 in 5009ms
[22:20:15.219Z][FILE:77][shadow-twins/resolve-binary-url] Debug: Fragmente geladen { fragmentCount: 0, fragmentsWithUrl: 0 }
[22:20:15.247Z][FILE:78][shadow-twins/resolve-binary-url] Storage-Fallback Vorbedingungen { willAttemptFallback: true }
StorageFactory: Lösche Provider für Bibliothek bf29edda-... aus dem Cache (×44)
GET https://api.clerk.com/v1/users/user_2rJr6UCn5.. 200 in 3519ms (cache skip)
[FileList Performance] Shadow-Twin-Analyse abgeschlossen: 6458.20ms für 53 analysierte Dateien
```
