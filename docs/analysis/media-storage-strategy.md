# Media Storage Strategie für Shadow-Twin Bilder

## Zweck

Dieses Dokument hält fest, wie Bilder/bildliche Binärfragmente in Shadow-Twins gespeichert
und gelesen werden sollen. Es ist die Single-Source-of-Truth für die Implementation des
Plans `media-storage-determinismus`.

Audio/Video-Fragmente sind in dieser Iteration ausgeklammert und werden später nach demselben
Schema migriert.

## Status-Quo (vor der Umsetzung)

### Schreib-Pfade

Heute existiert die Bildspeicher-Logik an mehreren Stellen, ohne zentralen Eintrittspunkt:

1. `src/lib/shadow-twin/shadow-twin-mongo-writer.ts` Zeilen 175‑244:
   - Pfad A (`uploadImagesFromZipDirectly`) wird genutzt, **nur wenn `zipArchives` mitgeliefert wird**.
   - Pfad B (`ImageProcessor.processMarkdownImages`) wird im `else`-Zweig genutzt und liest Bilder
     vom Filesystem-Provider.
   - Direkt danach folgt **bedingungslos** ein zweiter `ImageProcessor.processMarkdownImages`-Aufruf
     (Zeilen 234‑244), der unabhängig vom Erfolg von Pfad A noch einmal über den FS-Provider
     läuft.
2. `src/lib/chat/ingestion-service.ts` Zeile 791: eigenständiger `processMarkdownImages`-Aufruf
   für Chat-Ingestion.
3. Aufrufer von `persistShadowTwinToMongo`:
   - `src/lib/external-jobs/extract-only.ts` (OCR/PDF)
   - `src/lib/external-jobs/storage.ts` (Storage-Phase)
   - `src/app/api/library/[libraryId]/shadow-twins/upsert/route.ts` (manuelle Upserts)

### Lese-Pfade

1. `src/components/library/markdown-preview.tsx`:
   - Relative `![]()`-Bildpfade werden in Zeile 1271 zu `/api/storage/streaming-url?...` umgeschrieben.
   - Absolute `http(s)://`-URLs werden durch `(?!http)` korrekt durchgelassen.
2. `src/app/api/storage/streaming-url/route.ts`:
   - Löst die `fileId` ausschließlich über den Server-Provider (FS) auf.
   - Kein Mongo-Lookup. Wenn das Bild nur in Azure liegt (z.B. nach OCR mit `persistToFilesystem:false`),
     liefert der FS-Provider nichts und es entstehen 404 oder Provider-spezifische Fehler.

### Konfig

In `src/types/library.ts` Zeilen 266‑277 existiert nur:

```ts
shadowTwin?: {
  mode?: 'legacy' | 'v2';
  primaryStore?: 'filesystem' | 'mongo';
  persistToFilesystem?: boolean;
  cleanupFilesystemOnMigrate?: boolean;
  allowFilesystemFallback?: boolean;
};
```

**Kein eigenes Feld für Bilder-Speicherort.** Die heutige Logik leitet das implizit ab.

## Symptome im Produktivbetrieb

- Massiver Log-Spam beim OCR-Job: hunderte `GET /api/storage/filesystem?action=get`-Aufrufe für
  die Original-PDF-Datei während des Mongo-Write-Schritts. Ursache: zweiter unconditional
  `ImageProcessor.processMarkdownImages`-Aufruf mit `shadowTwinFolderId === undefined`.
- `imageErrorsCount: 260` obwohl OCR sauber lief.
- Bilder erscheinen nicht in der UI, obwohl sie im Azure-Container liegen.
- `streaming-url`-Route gibt für Azure-only-Bilder 404 zurück.

## Strategie-Matrix (neu)

Die Strategie wird **abgeleitet**, nicht neu konfiguriert. Eingaben:

- `library.config.shadowTwin.primaryStore` (Default: `filesystem`)
- `library.config.shadowTwin.persistToFilesystem` (Default: aus `primaryStore`)
- `library.config.shadowTwin.allowFilesystemFallback` (Default: `true`)
- `azureConfigured` (zur Laufzeit aus `resolveAzureStorageConfig`)

| primaryStore | persistToFilesystem | azureConfigured | Mode                   | Schreibziele       | Lese-Quelle | FS-Fallback beim Lesen |
|--------------|---------------------|-----------------|------------------------|--------------------|-------------|------------------------|
| `mongo`      | `false`             | true            | `azure-only`           | Azure              | Azure       | nein                   |
| `mongo`      | `true`              | true            | `azure-with-fs-backup` | Azure + Filesystem | Azure       | ja, falls erlaubt      |
| `filesystem` | (egal)              | true            | `filesystem-only`      | Filesystem (+ optional Azure-Spiegel für Anzeige) | Filesystem | ja |
| `filesystem` | (egal)              | false           | `filesystem-only`      | Filesystem         | Filesystem  | ja                     |
| `mongo`      | `false`             | false           | `unavailable`          | -                  | -           | -                      |
| `mongo`      | `true`              | false           | `filesystem-only`      | Filesystem         | Filesystem  | ja                     |

`unavailable` heißt: harter Fehler beim Persist-Versuch. Kein Silent-Drop wie heute.

## Liese-Vertrag (deterministisch)

Nach dem Speichern in Mongo gilt:

- Bei `azure-only` und `azure-with-fs-backup`: das gespeicherte Markdown enthält **ausschließlich
  absolute Azure-URLs** für Bilder. Keine relativen `img-0.jpeg`-Referenzen mehr.
- Bei `filesystem-only`: relative Pfade bleiben, werden über `streaming-url` aufgelöst.

Der Render-Pfad in `MarkdownPreview` braucht in den ersten beiden Modi keine Server-Round-Trips
mehr — der Browser lädt direkt aus Azure.

Falls ein Markdown im Bestand noch relative Pfade enthält (Legacy), greift in der `streaming-url`-
Route ein neuer **Mongo-Lookup-First**-Pfad: zuerst `binaryFragments` befragen, erst danach FS.

## Lösungsansatz: Variante C (gewählt)

Kein neues Schema-Feld. Stattdessen eine zentrale Funktion `getMediaStorageStrategy(library, azureConfigured)`
in `src/lib/shadow-twin/media-storage-strategy.ts`, die das Ergebnis als typisiertes Objekt liefert.
Alle Schreib- und Lese-Pfade konsumieren ausschließlich dieses Objekt.

In den Library-Settings wird die abgeleitete Strategie als read-only Info-Block angezeigt — damit
ist sie für den Benutzer transparent, ohne dass die Konfig-Felder vermehrt werden.

## Vollständige Liste betroffener Code-Stellen

### Schreib-Pfade

- `src/lib/shadow-twin/shadow-twin-mongo-writer.ts`
- `src/lib/shadow-twin/shadow-twin-direct-upload.ts`
- `src/lib/external-jobs/extract-only.ts`
- `src/lib/external-jobs/storage.ts`
- `src/app/api/library/[libraryId]/shadow-twins/upsert/route.ts`
- `src/lib/chat/ingestion-service.ts`
- `src/lib/ingestion/image-processor.ts` (bleibt für Legacy-Pfad)

### Lese-/Render-Pfade

- `src/components/library/markdown-preview.tsx`
- `src/app/api/storage/streaming-url/route.ts`
- `src/app/api/library/[libraryId]/artifacts/resolve/route.ts`
- `src/app/api/library/[libraryId]/artifacts/batch-resolve/route.ts`
- `src/app/api/library/[libraryId]/shadow-twins/binary-fragments/route.ts`
- `src/app/api/library/[libraryId]/shadow-twins/resolve-binary-url/route.ts`

### Konfig & UI

- `src/lib/shadow-twin/shadow-twin-config.ts` (Konsument)
- `src/components/settings/library-form.tsx` (Anzeige)

## Migrations-Risiken

- Bestehende Mongo-Shadow-Twins können noch relative Bildpfade enthalten. Lösung:
  - `streaming-url` mit Mongo-Lookup-First abfangen (Phase 4) → kein User-Impact.
  - Manueller Migrations-Job (Phase 6, Dry-Run + Apply) räumt sie sauber auf.
- Aufrufer in `chat/ingestion-service.ts` läuft heute parallel zum Shadow-Twin-Pfad. Vor Phase 2
  prüfen, ob er auf den neuen Service umgestellt werden soll oder bewusst Legacy bleibt.

## Rollback-Strategie

Jede Phase ist isoliert revertierbar:
- Phase 1 fügt nur eine Funktion + Tests hinzu, keine Verhaltensänderung.
- Phase 2 lässt den alten Pfad bestehen, falls der Service einen Fehler wirft (Defensive-Aufruf).
- Phase 4 kann via Feature-Flag deaktiviert werden, falls UI-Komponenten unerwartet brechen.

## Akzeptanzkriterien

1. Nach OCR-Job mit `azure-only`: `imageErrorsCount === 0`, Markdown in Mongo enthält nur absolute Azure-URLs.
2. Beim Rendern eines azure-only Shadow-Twins entstehen keine `streaming-url`-Aufrufe für Bilder.
3. Library-Settings zeigen den abgeleiteten Modus mit Begründung an.
4. Bei `mongo`+`persistToFilesystem:false`+kein Azure: Job schlägt sofort mit klarem Trace fehl
   statt Bilder still zu verlieren.
