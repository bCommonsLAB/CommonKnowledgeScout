# Analyse: Dateiliste – Metadaten (Titel, Nummer), Story-Status, Cover-Bild

## Ausgangslage

In der Dateiliste (transformierte Medien) werden aktuell angezeigt:
- Dateiname, Größe, Geändert
- Ein Icon, ob eine **Transformation** vorhanden ist (✨)

Nicht angezeigt:
- **Titel** des Eintrags (aus transformiertem Frontmatter)
- **Nummer** (z.B. Maßnahmen-Nr.)
- **Story publiziert** (Ingestion-Status) – obwohl bereits abgefragt
- **Vorhandenes Cover-Bild** (generiert oder hochgeladen)

## Wie die Dateiliste heute befüllt wird

1. **Ordner-Inhalt**
   - `folderItems` = `provider.listItemsById(currentFolderId)` (Storage-API).
   - Liefert nur `StorageItem[]`: `id`, `metadata.name`, `size`, `metadata.modifiedAt`, `type`, `parentId`.
   - Kein MongoDB für die reine Auflistung; bei Mongo als Primary Store wird die Liste weiterhin über den Provider/API geladen, die Artefakt-Infos kommen aus der Batch-Resolve-API.

2. **Shadow-Twin-Infos (Transformation, Transcript, Ingestion)**
   - `useShadowTwinAnalysis` ruft **einmal pro Ordner** die Bulk-API auf:
     - `POST /api/library/[libraryId]/artifacts/batch-resolve`
     - mit `includeBoth: true` (Transcript + Transformation) und `includeIngestionStatus: true`.
   - Response: `artifacts`, `transcripts`, `ingestionStatus` (pro `sourceId`).
   - Ergebnis wird in `shadowTwinStateAtom` pro Datei gespeichert:
     - `baseItem`, `transformed`, `transcriptFiles`, `shadowTwinFolderId`
     - **ingestionStatus** (exists, chunkCount, chaptersCount) ist bereits im State, wird in der Zeile aber nicht genutzt.
   - **Titel/Nummer/Cover** kommen weder aus der Ordner-Liste noch aus der Batch-Resolve-Response; sie stecken im **Inhalt** der Transformationsdatei (Frontmatter).

3. **Woher Titel/Nummer/Cover kommen**
   - **Mongo-Pfad:** Shadow-Twin-Dokument enthält `artifacts.transformation.<template>.<lang]` mit `markdown` und optional `frontmatter`. Titel/Nummer/coverImageUrl können aus `frontmatter` gelesen werden.
   - **Filesystem-Pfad:** Nur über Lesen der Transformations-Markdown-Datei (Frontmatter parsen); kein leichtgewichtiges Batch wie in Mongo.

## Erweiterung: Was abgefragt und angezeigt werden soll

| Anzeige           | Quelle                    | Bereits vorhanden? | Erweiterung nötig |
|-------------------|---------------------------|--------------------|-------------------|
| Story publiziert  | `ingestionStatus.exists`  | Ja (im State)      | Nur in UI nutzen  |
| Titel             | Transformation-Frontmatter| Nein               | Batch-Resolve + State + UI |
| Nummer            | Transformation-Frontmatter| Nein               | wie Titel         |
| Cover-Bild        | Frontmatter `coverImageUrl` | Nein             | wie Titel + Thumbnail-Anzeige |

## Vorschlag Implementierung

### 1. Story-Status in der Zeile anzeigen

- `ingestionStatus` ist bereits in `FrontendShadowTwinState` und wird für jede Datei aus der Batch-Resolve-API gefüllt.
- In der Zeile: Zusätzlich zum Transformations-Icon ein klares „Story publiziert“-Indikator (Icon/Badge), wenn `ingestionStatus?.exists === true`.
- Dafür muss die Zeile Zugriff auf den Shadow-Twin-State pro Basis-Item haben (z.B. über `fileGroup` erweitern um `ingestionStatus` oder Lookup per `baseItem.id`).

### 2. Liste-Metadaten (Titel, Nummer, coverImageUrl) aus Batch-Resolve

- **Batch-Resolve-API** um optionalen Parameter `includeListMeta?: boolean` erweitern.
- **Mongo-Pfad:** Wenn `includeListMeta === true`, pro aufgelöstem Artefakt aus `selected.record.frontmatter` auslesen:
  - `title` oder `titel` → Liste-Titel
  - `number`, `massnahme_nr`, `nummer` o.ä. → Nummer (template-spezifisch, generisch z.B. `title` + erste numerische Felder)
  - `coverImageUrl` → für Thumbnail
  Diese Felder als `listMeta: { title?, number?, coverImageUrl? }` pro sourceId in der Response mitgeben.
- **Filesystem-Pfad:** Ohne weitere Ladevorgänge ist Frontmatter nicht verfügbar. Optionen:
  - Erstmal nur Mongo unterstützen; Filesystem-Liste zeigt weiterhin nur Dateiname (oder später separater Batch „Metadaten aus Dateien lesen“).
  - Oder: Bei Filesystem optional für jede Transformation `getBinary` + Frontmatter parsen (teurer, nur bei Bedarf aktivierbar).

### 3. Client und State

- **Artifact-Client:** Response-Typ um `listMeta?: Record<string, { title?: string; number?: string; coverImageUrl?: string }>` erweitern (Key = sourceId).
- **FrontendShadowTwinState:** Optional `listMeta?: { title?: string; number?: string; coverImageUrl?: string }` ergänzen.
- **useShadowTwinAnalysis:** Bei Response mit `listMeta` diesen in den State pro sourceId übernehmen.

### 4. FileGroup und Zeilen-Rendering

- **FileGroup** um optionale Felder erweitern: `ingestionStatus`, `listMeta` (aus Shadow-Twin-State für die jeweilige baseItem.id).
- **Zeile:**
  - Neben dem bestehenden Transformations-Icon: **Story publiziert** anzeigen, wenn `ingestionStatus?.exists`.
  - **Titel:** Unter dem Dateinamen oder als Tooltip, falls `listMeta?.title`.
  - **Nummer:** z.B. vor dem Namen oder in Klammern, falls `listMeta?.number`.
  - **Thumbnail:** Kleines Vorschaubild vor dem Icon, wenn `listMeta?.coverImageUrl` gesetzt. URL auflösen über bestehende API (`/api/library/.../shadow-twins/resolve-binary-url` oder vergleichbar), Bild lazy laden (z.B. mit `loading="lazy"` oder Intersection Observer).

### 5. Aufwand (grob)

- **Nur Story-Status anzeigen:** Gering (State vorhanden, nur FileGroup/Zeile anbinden und Icon/Badge rendern).
- **listMeta in Batch-Resolve (Mongo):** Mittel (Response erweitern, Frontmatter aus `selected.record.frontmatter` auslesen, einheitliche Feldnamen).
- **Thumbnail in der Zeile:** Mittel (URL-Auflösung, kleines Bild-Layout, Lazy-Load).
- **Filesystem listMeta:** Höher (pro Transformation Datei lesen und parsen oder separater Endpoint); sinnvoll als zweiter Schritt.

## Betroffene Dateien (Überblick)

- `src/app/api/library/[libraryId]/artifacts/batch-resolve/route.ts` – listMeta bei Mongo anreichern, Option `includeListMeta`.
- `src/lib/shadow-twin/artifact-client.ts` – Response-Typ und Aufruf mit `includeListMeta`.
- `src/lib/shadow-twin/shared.ts` bzw. `src/atoms/shadow-twin-atom.ts` – `listMeta` im State-Typ.
- `src/hooks/use-shadow-twin-analysis.ts` – listMeta aus Response in State schreiben.
- `src/components/library/file-list.tsx` – FileGroup um ingestionStatus/listMeta, Zeile um Titel, Nummer, Story-Icon, Thumbnail.

## Referenzen

- Batch-Resolve: `src/app/api/library/[libraryId]/artifacts/batch-resolve/route.ts`
- Shadow-Twin-State: `src/atoms/shadow-twin-atom.ts`, `src/lib/shadow-twin/shared.ts`
- Analyse-Hook: `src/hooks/use-shadow-twin-analysis.ts`
- FileGroup/Zeile: `src/components/library/file-list.tsx`
- Frontmatter: `src/lib/markdown/frontmatter.ts` (parseFrontmatter), Mongo-Artefakt: `ShadowTwinArtifactRecord.frontmatter` in `src/lib/repositories/shadow-twin-repo.ts`
