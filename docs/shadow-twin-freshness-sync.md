# Shadow-Twin Freshness & Sync System

## Übersicht

Das Freshness-System vergleicht **Markdown-Artefakte** (Transcripts, Transformationen) zwischen zwei Speicherorten:

- **MongoDB** – Primary Store (Shadow-Twin-Dokumente)
- **Storage** – Dateisystem / OneDrive / Nextcloud (`.md`-Dateien im Shadow-Twin-Ordner)

**Wichtig:** Es werden ausschließlich Markdown-Artefakte verglichen. Binary Fragments (JPEGs, Thumbnails, PDFs) sind **nicht** Teil des Freshness-Checks.

---

## Architektur-Diagramm

```
┌─────────────────────────────────────────────────────┐
│                   FilePreview                        │
│  ┌─────────────────────────────────────────────┐    │
│  │  useShadowTwinFreshnessApi (Hook)           │    │
│  │  ├── useShadowTwinFreshness (Atom-Check)    │    │
│  │  └── Freshness API Call (vollständig)        │    │
│  └──────────────┬──────────────────────────────┘    │
│                 │                                    │
│  ┌──────────────▼──────────────────────────────┐    │
│  │  ShadowTwinSyncBanner                       │    │
│  │  Zeigt Status + Aktions-Button              │    │
│  └──────────────┬──────────────────────────────┘    │
│                 │ onClick                            │
│  ┌──────────────▼──────────────────────────────┐    │
│  │  handleRequestUpdate()                      │    │
│  │  ├── storage-newer  → sync-from-storage API │    │
│  │  ├── storage-missing → sync-to-storage API  │    │
│  │  └── source-newer   → Pipeline-Dialog       │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

---

## Verglichene Artefakte

| Artefakt-Typ       | Verglichen? | Format     | Beispiel-Dateiname                                      |
|--------------------|-------------|------------|--------------------------------------------------------|
| Transcript         | Ja          | Markdown   | `dateiname.de.md`                                       |
| Transformation     | Ja          | Markdown   | `dateiname.Besprechung strukturieren.de.md`             |
| Binary Fragments   | **Nein**    | JPEG/PNG   | (extrahierte Bilder, Thumbnails)                        |

### Warum nur Markdown?

- Binary Fragments haben in MongoDB keine eigene `updatedAt`-Semantik pro Fragment
- Sie werden beim Erstellen einmalig generiert und danach nicht extern editiert
- Die Sync-Logik liest/schreibt Text (`blob.text()` / `new File([markdown])`)

---

## Freshness-Status (pro Artefakt)

| Status           | Bedeutung                                            | Aktion                        |
|------------------|------------------------------------------------------|-------------------------------|
| `synced`         | MongoDB und Storage sind identisch (±5s Toleranz)    | Keine Aktion nötig            |
| `source-newer`   | Quelldatei wurde nach dem Artefakt geändert          | Pipeline → Neu generieren     |
| `storage-newer`  | Artefakt-Datei im Storage wurde extern editiert      | Storage → MongoDB sync        |
| `storage-missing`| Artefakt in MongoDB vorhanden, fehlt im Storage      | MongoDB → Storage schreiben   |
| `mongo-newer`    | MongoDB neuer als Storage-Datei                      | (nur im Debug-Panel sichtbar) |
| `mongo-missing`  | Kein Eintrag in MongoDB                              | (nur im Debug-Panel sichtbar) |
| `no-twin`        | Kein Shadow-Twin-Dokument vorhanden                  | Pipeline → Erstellen          |

### Toleranz

Beim Vergleich MongoDB vs. Storage gilt eine **Toleranz von 5 Sekunden** (`diffMs > 5000`), da Schreibvorgänge leicht asynchron sein können (z.B. bei `persistToFilesystem` wird zuerst MongoDB, dann Storage geschrieben).

---

## Wann greift die Freshness-Prüfung?

Die Prüfung wird **automatisch ausgelöst**, wenn:

1. **Eine Datei im FilePreview ausgewählt wird** – der `useShadowTwinFreshnessApi`-Hook feuert einen API-Call
2. **Der Debug-Footer geöffnet wird** – gleicher Hook, gleicher API-Call
3. **Der Refresh-Button (↻) im Freshness-Vergleich geklickt wird** – manueller Re-Fetch

Es gibt **keinen automatischen Hintergrund-Watcher**. Das System ist bewusst als "Lazy Sync" konzipiert.

---

## Konfiguration (Library-Level)

Die Freshness-Prüfung berücksichtigt die Library-Konfiguration:

```typescript
// src/lib/shadow-twin/shadow-twin-config.ts
interface ShadowTwinConfigDefaults {
  primaryStore: 'filesystem' | 'mongo'   // Wo Artefakte primär gespeichert werden
  persistToFilesystem: boolean           // Zusätzlich ins Storage schreiben
  allowFilesystemFallback: boolean       // Aus Storage lesen wenn MongoDB fehlt
  cleanupFilesystemOnMigrate: boolean    // Storage-Dateien bei Migration löschen
}
```

**Storage-Vergleich findet nur statt, wenn:**
- `primaryStore === 'filesystem'` ODER
- `persistToFilesystem === true`

Ist beides `false`, wird kein Storage-Lookup durchgeführt und die Freshness-API meldet nur MongoDB-basierte Daten.

---

## Dateien und Komponenten

### 1. API-Routen (Server-seitig)

#### `src/app/api/library/[libraryId]/shadow-twins/freshness/route.ts`

**Zweck:** Liefert pro Artefakt einen Timestamp-Vergleich.

**Ablauf:**
1. Quelldatei-Metadaten aus Storage laden (`provider.getItemById`)
2. Shadow-Twin-Dokument aus MongoDB laden (`getShadowTwinsBySourceIds`)
3. Für jedes Artefakt in `doc.artifacts.transcript` und `doc.artifacts.transformation`:
   - MongoDB-`updatedAt` lesen
   - Storage-Datei suchen via `findArtifactInStorage()`:
     - Erst in `shadowTwinFolderId` (aus MongoDB)
     - Dann in Unterstrich-Ordner (`_dateiname/`) via `findShadowTwinFolder()`
     - Zuletzt als Sibling-Datei neben der Quelle
   - Status berechnen via `computeStatus()`
4. Response mit Array von `ArtifactFreshness`-Objekten

**Input:** `{ sourceId, parentId? }`
**Output:** `{ sourceFile, documentUpdatedAt, artifacts[], config }`

---

#### `src/app/api/library/[libraryId]/shadow-twins/sync-from-storage/route.ts`

**Zweck:** Liest Artefakt-Dateien aus dem Storage und aktualisiert MongoDB.

**Wann:** Status `storage-newer` – Datei wurde extern im Storage editiert.

**Ablauf:**
1. Shadow-Twin-Dokument aus MongoDB laden
2. Für jedes Artefakt mit `isStorageNewer()`:
   - `provider.getBinary(fileId)` → Blob
   - `blob.text()` → Markdown-String
   - `updateShadowTwinArtifactMarkdown()` → MongoDB aktualisieren
3. Response mit `{ synced, skipped, failed, results[] }`

---

#### `src/app/api/library/[libraryId]/shadow-twins/sync-to-storage/route.ts`

**Zweck:** Schreibt Artefakt-Markdown aus MongoDB als Datei in den Storage.

**Wann:** Status `storage-missing` – Datei fehlt im Storage.

**Ablauf:**
1. Shadow-Twin-Dokument aus MongoDB laden
2. Shadow-Twin-Ordner finden oder erstellen (`ensureShadowTwinFolder`)
3. Für jedes Artefakt ohne Storage-Datei:
   - `record.markdown` lesen
   - `provider.uploadFile(folderId, new File([markdown], fileName))` → Storage
4. Response mit `{ written, skipped, failed, folderId, results[] }`

---

### 2. Hooks (Client-seitig)

#### `src/hooks/use-shadow-twin-freshness.ts`

Enthält **zwei Hooks**:

##### `useShadowTwinFreshness` (Atom-only, schnell)

- **Input:** `file: StorageItem`, `shadowTwinState: FrontendShadowTwinState`
- **Vergleicht:** `file.metadata.modifiedAt` vs. `twin.metadata.modifiedAt` (aus Jotai-Atom)
- **Erkennt:** `source-newer`, `no-twin`, `synced`
- **Erkennt NICHT:** `storage-newer`, `storage-missing` (kein API-Call)
- **Verwendung:** Intern als Basis für den API-Hook

##### `useShadowTwinFreshnessApi` (vollständig, mit API-Call)

- **Input:** `libraryId`, `file`, `shadowTwinState`
- **Ablauf:**
  1. Atom-Check als Basis (`useShadowTwinFreshness`)
  2. API-Call an `/api/.../shadow-twins/freshness` bei Datei-Wechsel
  3. Kombinierter Status: API-Daten haben Vorrang
- **Erkennt:** Alle Status inkl. `storage-newer`, `storage-missing`
- **Status-Priorität:** `source-newer` > `storage-newer` > `storage-missing`
- **Verwendung:** FilePreview (Banner), Debug-Footer

---

### 3. UI-Komponenten

#### `src/components/library/shared/shadow-twin-sync-banner.tsx`

**Zweck:** Kompaktes Banner im FilePreview mit Status-Anzeige und Aktions-Button.

| Status           | Farbe  | Icon             | Button-Text             |
|------------------|--------|------------------|-------------------------|
| `source-newer`   | Amber  | ⚠ AlertTriangle  | "Shadow-Twin aktualisieren" |
| `storage-newer`  | Blau   | ↑ ArrowUpFromLine| "MongoDB aktualisieren" |
| `storage-missing`| Rot    | ↓ Download       | "In Storage schreiben"  |
| `no-twin`        | Grau   | ? FileQuestion   | "Jetzt erstellen"       |

**Features:**
- Per-Artefakt-Auflistung (Transcript ✓, Transformation ↑)
- Spinner während Sync (`isUpdating`)
- Wird bei `synced` oder `loading` ausgeblendet

---

#### `src/components/library/shared/freshness-comparison-panel.tsx`

**Zweck:** Detaillierte Vergleichstabelle im Debug-Panel.

**Zeigt pro Artefakt:**
- Art (Transcript/Transformation) + Sprache
- MongoDB `updatedAt`
- Storage `modifiedAt` (oder "nicht gefunden")
- Status-Badge (Synchron / Storage neuer / Storage fehlt / ...)

**Zeigt global:**
- Source `modifiedAt`, Dokument `updatedAt`
- Shadow-Twin-Konfiguration (primaryStore, persist, fallback)

---

#### `src/components/library/file-preview.tsx` (relevante Ausschnitte)

**Hook-Aufruf:**
```typescript
const freshness = useShadowTwinFreshnessApi(activeLibraryId, displayFile, shadowTwinState)
```

**Sync-Handler (`handleSync`):**
- Generischer Handler für beide Sync-Richtungen
- Ruft `/shadow-twins/sync-from-storage` oder `/shadow-twins/sync-to-storage` auf
- Zeigt Toast-Feedback (Erfolg/Fehler/Teilweise)

**Request-Update (`handleRequestUpdate`):**
```
storage-newer   → handleSync('from-storage')
storage-missing → handleSync('to-storage')
source-newer    → Pipeline-Dialog öffnen
no-twin         → Pipeline-Dialog öffnen
```

---

#### `src/components/debug/debug-footer.tsx` (Shadow-Twin Tab)

**Zeigt:**
- Freshness-Status mit Label und Farbe
- Anzahl abweichender Artefakte (`apiIssueCount/total`)
- `FreshnessComparisonPanel` für detaillierten Vergleich

---

### 4. Datenmodell (MongoDB)

#### `src/lib/repositories/shadow-twin-repo.ts`

```typescript
interface ShadowTwinDocument {
  libraryId: string
  sourceId: string           // ID der Quelldatei
  sourceName: string         // Name der Quelldatei
  parentId: string           // Ordner der Quelldatei
  artifacts: {
    transcript?: Record<string, ShadowTwinArtifactRecord>        // z.B. { "de": {...} }
    transformation?: Record<string, Record<string, ShadowTwinArtifactRecord>>  // z.B. { "template": { "de": {...} } }
  }
  binaryFragments?: Array<Record<string, unknown>>  // JPEGs etc. – NICHT verglichen
  filesystemSync?: {
    enabled: boolean
    shadowTwinFolderId?: string | null  // Expliziter Ordner im Storage
    lastSyncedAt?: string | null
  }
  createdAt: string
  updatedAt: string          // Dokument-Level Timestamp
}

interface ShadowTwinArtifactRecord {
  markdown: string           // Artefakt-Inhalt
  frontmatter?: Record<string, unknown>
  createdAt: string          // Artefakt-Level Timestamp
  updatedAt: string          // ← Wird mit Storage-modifiedAt verglichen
}
```

---

### 5. Storage-Helpers

#### `src/lib/storage/shadow-twin.ts`

- `generateShadowTwinFolderName(name)` → `_dateiname.pdf` (Unterstrich-Prefix)
- `generateShadowTwinFolderNameVariants(name)` → `[_dateiname.pdf, .dateiname.pdf]` (Legacy-Support)
- `findShadowTwinFolder(parentId, name, provider)` → Sucht den Ordner mit allen Varianten

---

## Sync-Strategien

### 1. Zentraler Sync (Config-Bereich)

Über den Button "Sync starten" in den Library-Einstellungen (neben "Migration starten").
Synchronisiert die gesamte Bibliothek bidirektional:

- **API:** `POST /api/library/{id}/shadow-twins/sync-all`
- **Input:** `{ folderId: 'root', recursive: true }`
- **Scannt** alle Dateien rekursiv, lädt MongoDB-Dokumente batch-weise
- **storage-newer** → Datei lesen, MongoDB aktualisieren
- **storage-missing** → Markdown aus MongoDB in Storage schreiben
- **source-newer** → Nur melden (braucht Pipeline)
- **Report:** `{ scanned, synced, written, sourceNewer, errors }`

### 2. Stiller Auto-Sync (FilePreview)

Beim Öffnen einer Datei im FilePreview automatisch und unsichtbar:

```
Benutzer wählt Datei
       │
       ▼
useShadowTwinFreshnessApi() → 1 API-Call
       │
       ├── storage-newer   → useEffect: Auto-Sync (still, kein Banner)
       │                      POST /shadow-twins/sync-from-storage
       │
       ├── storage-missing → useEffect: Auto-Sync (still, kein Banner)
       │                      POST /shadow-twins/sync-to-storage
       │
       ├── source-newer    → Banner anzeigen → Pipeline-Dialog
       │
       └── synced          → Nichts tun
```

### 3. Debug-Panel (manuell)

Das `FreshnessComparisonPanel` im Debug-Footer bleibt für detaillierte
Analyse erhalten (eigener API-Call, manuelle Aktualisierung).

---

## Datenfluss-Zusammenfassung

```
┌─ Config-Bereich (einmalig) ──────────────────────────┐
│  "Sync starten" → POST /shadow-twins/sync-all        │
│  Scannt alle Dateien, synct bidirektional             │
└──────────────────────────────────────────────────────┘

┌─ FilePreview (pro Datei) ────────────────────────────┐
│  Datei öffnen → useShadowTwinFreshnessApi()          │
│       │                                               │
│       ├── storage-newer/missing → Auto-Sync (still)  │
│       │   (useEffect → sync-from/to-storage API)     │
│       │                                               │
│       └── source-newer → Banner + Pipeline-Button    │
└──────────────────────────────────────────────────────┘

┌─ Debug-Panel (manuell) ─────────────────────────────┐
│  FreshnessComparisonPanel → POST /freshness          │
│  Detaillierte Timestamp-Tabelle pro Artefakt         │
└──────────────────────────────────────────────────────┘
```
