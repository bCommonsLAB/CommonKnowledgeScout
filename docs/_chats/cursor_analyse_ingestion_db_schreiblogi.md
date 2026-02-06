# Analyse Ingestion DB-Schreiblogik
_Exported on 2/6/2026 at 17:04:10 GMT+1 from Cursor (2.4.27)_

---

**Cursor**

Analysiere beide Dateien, um zu verstehen, wie Metadaten aus dem transformierten Markdown in MongoDB geschrieben werden.


Suche nach der Ingestion-Datei:


Lese die relevanten Dateien:


Lese die `ingest.ts` Datei:


Zusammenfassung der Metadaten-Verarbeitung:

## Zusammenfassung: Metadaten-Extraktion und MongoDB-Schreibung

### 1. Frontmatter-Extraktion

**In `phase-ingest.ts` (Zeilen 176-229):**
- Das transformierte Markdown wird aus dem Shadow-Twin geladen (enthält Frontmatter aus Template-Phase)
- `metaForIngestion` wird aus dem Shadow-Twin-Markdown extrahiert

**In `ingestion-service.ts` (Zeilen 84-93):**
```typescript
const { meta: metaFromMarkdown, body } = await parseFrontmatter(markdown)
const metaEffective: Record<string, unknown> = { ...(metaFromMarkdown || {}), ...(meta || {}) }
```
- Frontmatter wird geparst; `metaEffective` enthält alle Frontmatter-Felder

### 2. Aufbau von `docMetaJsonObj`

**In `ingestion-service.ts` (Zeilen 236-246):**
```typescript
const jsonClean = ((metaEffective as Record<string, unknown>)['__jsonClean'] as Record<string, unknown>) || {}
const docMetaJsonObj = { ...metaEffective, ...jsonClean } as Record<string, unknown>
delete (docMetaJsonObj as Record<string, unknown>)['__jsonClean']
delete (docMetaJsonObj as Record<string, unknown>)['__sanitized']
```

- Basis: `metaEffective` (alle Frontmatter-Felder)
- Merge: `__jsonClean` (validierte Facetten-Felder) hat Priorität
- Interne Felder (`__jsonClean`, `__sanitized`) werden entfernt
- Ergebnis: `docMetaJsonObj` enthält alle Frontmatter-Felder, inkl. `handlungsfeld`, `massnahme_nr`, `lv_bewertung`

### 3. Dynamische vs. explizite Felder

**Explizit extrahierte Felder** (Zeilen 703-734 in `ingestion-service.ts`):
- `authors`, `year`, `region`, `docType`, `source`, `tags`, `topics`
- `title`, `shortTitle`, `slug`, `summary`, `teaser`

**Dynamisch übernommene Felder** (z.B. `handlungsfeld`, `massnahme_nr`, `lv_bewertung`):
- Werden nicht explizit extrahiert
- Kommen automatisch über `docMetaJsonObj` ins MongoDB-Dokument
- Zwei Wege:
  1. Über `docMetaJson` (Zeile 732): Das komplette `docMetaJsonObj` wird als `docMetaJson` gespeichert
  2. Über dynamische Facetten (Zeilen 738-763): Wenn in der Library-Konfiguration als Facette definiert, werden sie zusätzlich als Top-Level-Felder gespeichert

**In `meta-document-builder.ts` (Zeile 92):**
```typescript
docMetaJson: docMetaJsonObj,  // Komplettes Frontmatter als JSON
```

### 4. Facetten-System

**In `ingestion-service.ts` (Zeilen 738-763):**
- Dynamische Facetten werden aus der Library-Konfiguration gelesen (`facetDefs`)
- Werte werden über `getTopLevelValue()` aus `metaEffective` extrahiert
- Diese werden zusätzlich als Top-Level-Felder im MongoDB-Dokument gespeichert (für Filterung/Suche)

### Fazit

- Alle Frontmatter-Felder (inkl. `handlungsfeld`, `massnahme_nr`, `lv_bewertung`) werden dynamisch übernommen
- Sie landen im Feld `docMetaJson` des MongoDB-Dokuments
- Wenn als Facetten konfiguriert, werden sie zusätzlich als Top-Level-Felder gespeichert
- Keine explizite Extraktion für diese Felder nötig; sie kommen automatisch aus dem Frontmatter

**Relevante Code-Stellen:**
- `src/lib/external-jobs/phase-ingest.ts`: Zeilen 176-229 (Markdown-Laden)
- `src/lib/chat/ingestion-service.ts`: Zeilen 84-93 (Frontmatter-Parsing), Zeilen 236-246 (`docMetaJsonObj` Aufbau), Zeilen 703-734 (Explizite Felder), Zeilen 738-763 (Dynamische Facetten)
- `src/lib/ingestion/meta-document-builder.ts`: Zeile 92 (`docMetaJson` wird gespeichert)

