# Shadow-Twin MongoDB: Zielstruktur und Implementierungsstatus

## Einordnung
Dieses Dokument rekonstruiert das Zielbild für Shadow-Twin-Dokumente in MongoDB und zeigt, was bereits implementiert ist und was noch fehlt.

## Zielbild (aus shadow-twin-mongo-migration-plan.md)

### Datenmodell
Ein Dokument pro Quelle (`sourceId`). Einbettung der Fragmente in einem Dokument reduziert Query-Overhead.

```json
{
  "_id": "<ObjectId>",
  "libraryId": "ff73d3a2-...",
  "sourceId": "fileId-original",
  "sourceName": "document.pdf",
  "parentId": "folderId",
  "userEmail": "user@example.com",
  "artifacts": {
    "transcript": {
      "de": {
        "markdown": "<md>",
        "frontmatter": {},
        "createdAt": "2026-01-22T12:00:00Z",
        "updatedAt": "2026-01-22T12:05:00Z"
      }
    },
    "transformation": {
      "templateName": {
        "de": {
          "markdown": "<md>",
          "frontmatter": { "docType": "event", "title": "..." },
          "createdAt": "2026-01-22T12:10:00Z",
          "updatedAt": "2026-01-22T12:11:00Z"
        }
      }
    }
  },
  "binaryFragments": [
    {
      "name": "page-001.png",
      "kind": "image",
      "url": "https://<azure>/.../page-001.png",
      "hash": "abcdef123456",
      "mimeType": "image/png",
      "size": 123456,
      "createdAt": "2026-01-22T12:12:00Z"
    },
    {
      "name": "preview_001.jpg",
      "kind": "image",
      "url": "https://<azure>/.../preview_001.jpg",
      "hash": "fedcba654321",
      "mimeType": "image/jpeg",
      "size": 45678,
      "createdAt": "2026-01-22T12:12:00Z"
    }
  ],
  "filesystemSync": {
    "enabled": false,
    "shadowTwinFolderId": null,
    "lastSyncedAt": null
  },
  "createdAt": "2026-01-22T12:00:00Z",
  "updatedAt": "2026-01-22T12:11:00Z"
}
```

### Wichtige Punkte aus dem Konzept

1. **Binary Fragments enthalten Azure-URLs**: 
   - Jedes Fragment hat eine `url`-Eigenschaft mit der Azure Blob Storage URL
   - `hash` für Deduplizierung
   - `mimeType`, `size`, `createdAt` für Metadaten

2. **Ein Dokument pro sourceId**: 
   - Alle Artefakte (transcript + transformation) werden in einem Dokument gespeichert
   - Binary Fragments werden einmalig pro Quelle gespeichert (nicht pro Artefakt)

3. **Filesystem optional**: 
   - `filesystemSync.enabled: false` bedeutet, dass keine Filesystem-Kopien mehr existieren
   - Bilder werden direkt aus Azure geladen

## Aktueller Implementierungsstatus

### ✅ Was bereits implementiert ist

1. **Datenmodell-Struktur** (`src/lib/repositories/shadow-twin-repo.ts`):
   - `ShadowTwinDocument` Interface entspricht dem Zielbild
   - `artifacts` Struktur korrekt (transcript/transformation)
   - `binaryFragments` Array vorhanden

2. **Migration Writer** (`src/lib/shadow-twin/shadow-twin-migration-writer.ts`):
   - Sammelt alle Dateien aus Shadow-Twin-Ordner
   - Kategorisiert Dateien (markdown, image, audio, video, binary)
   - Erstellt `binaryFragments` Array

### ❌ Was fehlt

**Kritisch: Azure-URLs in binaryFragments**

Die aktuelle Implementierung speichert nur `fileId` statt Azure-URLs:

```typescript
// Aktuell (shadow-twin-migration-writer.ts, Zeile 163-170):
binaryFragments.push({
  name: fileName,
  kind: fileKind,
  mimeType,
  fileId: file.id,  // ← Nur fileId, keine URL!
  size: file.metadata.size,
  createdAt: file.metadata.createdAt || new Date().toISOString(),
})
```

**Erwartet (aus Konzept):**
```typescript
{
  name: "page-001.png",
  kind: "image",
  url: "https://<azure>/.../page-001.png",  // ← Azure-URL fehlt!
  hash: "abcdef123456",  // ← Hash fehlt!
  mimeType: "image/png",
  size: 123456,
  createdAt: "2026-01-22T12:12:00Z"
}
```

## Was implementiert werden muss

### 1. Bild-Upload während Migration

Die Migration sollte Bilder nach Azure hochladen, ähnlich wie `ImageProcessor.processMarkdownImages`:

**Referenz-Implementierung:**
- `src/lib/ingestion/image-processor.ts`: `uploadImageWithDeduplication()`
- `src/lib/services/azure-storage-service.ts`: `uploadImageToScope()`

**Benötigte Schritte:**

1. **Für jedes Bild im Shadow-Twin-Ordner:**
   - Datei aus Storage Provider laden (`provider.getBinary(fileId)`)
   - Hash berechnen (`calculateImageHash(buffer)`)
   - Nach Azure hochladen (`azureStorage.uploadImageToScope()`)
   - Azure-URL erhalten

2. **Scope bestimmen:**
   - `books` für normale Dokumente
   - `sessions` für Event-Dokumente mit Slides
   - Kann aus `artifactKey.templateName` oder Frontmatter abgeleitet werden

3. **Binary Fragments mit URLs speichern:**
   ```typescript
   binaryFragments.push({
     name: fileName,
     kind: fileKind,
     url: azureUrl,  // ← Azure-URL
     hash: hash,     // ← Hash für Deduplizierung
     mimeType,
     size: file.metadata.size,
     createdAt: file.metadata.createdAt || new Date().toISOString(),
   })
   ```

### 2. Deduplizierung

- Bilder mit gleichem Hash sollten nicht mehrfach hochgeladen werden
- `ImageProcessor` hat bereits Deduplizierungs-Logik (Hash-Check vor Upload)

### 3. Markdown-URL-Rewrite

- Nach Upload sollten relative Bild-Referenzen im Markdown durch Azure-URLs ersetzt werden
- Ähnlich wie `ImageProcessor.processMarkdownImages()` macht

## Vergleich: Aktuell vs. Ziel

### Aktuelles MongoDB-Dokument (IST)
```json
{
  "binaryFragments": [
    {
      "name": "img-0.jpeg",
      "kind": "image",
      "mimeType": "image/jpeg",
      "fileId": "cGRmLy4wMU9LVDIwMjRfTGl2aXF1ZV9Tw7hyZW5zZW4gQmVkZGluZ19Cb3hzcHJpbmdiZXR0X0VLX05ldHRvXzI1MDcwNF92MDAwMDNOZXcucGRmL2ltZy0wLmpwZWc=",
      "size": 635675,
      "createdAt": "2026-01-24T15:47:13.022Z"
    }
  ]
}
```

### Ziel-Dokument (SOLL)
```json
{
  "binaryFragments": [
    {
      "name": "img-0.jpeg",
      "kind": "image",
      "url": "https://<storage-account>.blob.core.windows.net/<container>/<libraryId>/books/<fileId>/<hash>.jpeg",
      "hash": "a1b2c3d4e5f6...",
      "mimeType": "image/jpeg",
      "size": 635675,
      "createdAt": "2026-01-24T15:47:13.022Z"
    }
  ]
}
```

## Nächste Schritte

1. **Migration Writer erweitern:**
   - Azure-Upload für alle Bilder während Migration
   - Hash-Berechnung
   - URL-Generierung

2. **Markdown-URL-Rewrite:**
   - Relative Pfade (`img-0.jpeg`) durch Azure-URLs ersetzen
   - Vor dem Speichern in MongoDB

3. **Deduplizierung:**
   - Hash-Check vor Upload
   - Wiederverwendung existierender Azure-URLs

4. **Scope-Bestimmung:**
   - Logik zur Bestimmung von `books` vs. `sessions`
   - Basierend auf Template oder Frontmatter

## Code-Referenzen

- **Azure Upload**: `src/lib/services/azure-storage-service.ts`
- **Image Processing**: `src/lib/ingestion/image-processor.ts`
- **Hash-Berechnung**: `src/lib/ingestion/image-processor.ts` (calculateImageHash)
- **Migration Writer**: `src/lib/shadow-twin/shadow-twin-migration-writer.ts`
