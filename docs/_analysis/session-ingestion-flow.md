# Session/Event Ingestion Flow - Analyse

**Datum**: 2025-10-29  
**Status**: Dokumentation des aktuellen Flows

## Überblick

Der Ingestion-Flow für Session/Event-Dokumente (z.B. SFSCON-Präsentationen) verarbeitet Markdown-Dateien mit Frontmatter und lädt sie in MongoDB + Pinecone hoch.

## 1. Datenquellen

### Markdown-Datei-Struktur
```markdown
---
title: "Open Source Businesses as..."
shortTitle: "Open Source Businesses Funding"
speakers: ["Omier, Emily"]
affiliations: ["Emily Omier Consulting"]
event: "2024 - SFSCON"
track: "Main Track"
session: "Open Source Businesses..."
year: "2024"
date: "2024-11-08"
starttime: "09:30"
endtime: "10:00"
location: "NOI Techpark, Bolzano/Italy"
duration: "30"
tags: ["open source", "business models", ...]
topics: ["open-source", "business", ...]
summary: |
  ## Introduction
  Emily Omier discusses...
  
  ## The Need for More Open Source Companies
  ...
teaser: "Open source software is free to use..."
video_url: "https://player.vimeo.com/video/..."
attachments_url: "https://www.sfscon.it/..."
url: "https://www.sfscon.it/talks/..."
slides:
  - page_num: 1
    title: "The Open Source Ecosystem Needs More Companies"
    summary: "Emily Omier introduces..."
    image_url: "2024 SFSCON/assets/.../preview_001.jpg"
  - page_num: 2
    title: "About Me"
    summary: "..."
    image_url: ".../preview_002.jpg"
---

# Content (Body zum Chunken)
...
```

## 2. Ingestion-Ablauf

### API-Endpunkt
`POST /api/chat/${libraryId}/ingest-markdown`
- Request: `{ fileId, fileName, docMeta? }`
- Ruft `IngestionService.upsertMarkdown()` auf

### IngestionService.upsertMarkdown() Schritte

#### Schritt 1: Frontmatter parsen
```typescript
const { meta: metaFromMarkdown, body } = parseFrontmatter(markdown)
const metaEffective = { ...metaFromMarkdown, ...meta }
```
- **meta**: Alle Frontmatter-Felder (title, speakers, event, slides, etc.)
- **body**: Markdown-Content zum Chunken

#### Schritt 2: Facetten-Validierung
- Liest Facetten-Definitionen aus Library-Config
- Validiert Typen (string, number, string[], etc.)
- Erstellt `__sanitized` und `__jsonClean` Versionen

#### Schritt 3: Text-Chunking
```typescript
// Nach Seiten aufteilen (--- Seite N --- Marker)
const spans = splitByPages(body)

// Pro Kapitel chunken (1500 Zeichen, 100 Overlap)
const chunkTexts = chunkText(chapterText, 1500, 100)
```

#### Schritt 4: Embeddings erstellen
```typescript
const embeds = await embedTexts(chunkTexts)
```

#### Schritt 5: Vektoren nach Pinecone
```typescript
// Alte Vektoren löschen (Idempotenz)
await deleteByFilter(idx.host, apiKey, { 
  user: { $eq: userEmail }, 
  libraryId: { $eq: libraryId }, 
  fileId: { $eq: fileId } 
})

// Neue Vektoren hochladen
const vectors = [
  // 1) Chunk-Vektoren (pro Text-Chunk)
  {
    id: `${fileId}-${chunkIndex}`,
    values: embedding,
    metadata: {
      kind: 'chunk',
      user, libraryId, fileId, fileName,
      chunkIndex,
      text: chunk.slice(0, 1200),  // Gekürzt für Metadaten
      chapterId, chapterOrder, chapterTitle,
      startPage, endPage,
      keywords, summaryShort,
      upsertedAt
    }
  },
  
  // 2) Chapter-Summary-Vektoren (pro Kapitel-Summary)
  {
    id: `${fileId}-chap-${chapterId}`,
    values: summaryEmbedding,
    metadata: {
      kind: 'chapterSummary',
      user, libraryId, fileId, fileName,
      chapterId, chapterTitle, order,
      startPage, endPage,
      text: summary.slice(0, 1200),
      keywords,
      upsertedAt
    }
  },
  
  // 3) Doc-Vektor (Dokument-Level Metadaten)
  {
    id: `${fileId}-meta`,
    values: docEmbedding,  // Aus summary-Text generiert
    metadata: {
      kind: 'doc',
      user, libraryId, fileId, fileName,
      chunkCount, chaptersCount,
      ingest_status: 'completed',
      upsertedAt
      // KEINE docMetaJson mehr in Pinecone!
      // Nur minimal-Set für schnelle Filterung
    }
  }
]

await upsertVectorsChunked(idx.host, apiKey, vectors, 8)
```

#### Schritt 6: MongoDB Upsert
```typescript
const mongoDoc: DocMeta = {
  user: userEmail,
  libraryId,
  fileId,
  fileName,
  // Top-Level Felder für Facetten-Filterung
  authors, year, region, docType, source, tags,
  event, track, speakers, topics,  // Session-spezifisch
  // Technische Felder
  chunkCount, chaptersCount, upsertedAt,
  // KOMPLETTES docMetaJson (alle Daten!)
  docMetaJson: {
    title, shortTitle, summary, teaser,
    speakers, affiliations, tags, topics,
    year, date, starttime, endtime, duration, location,
    event, track, session, language,
    video_url, attachments_url, url,
    slides: [
      { page_num, title, summary, image_url },
      ...
    ]
  },
  // Chapters (falls vorhanden)
  chapters: [...]
}

await upsertDocMeta(libraryKey, mongoDoc)
```

## 3. Was wird wohin gespeichert?

### MongoDB (`docmeta` Collection)
✅ **ALLE Daten** werden hier gespeichert:
- Top-Level: Facetten-Felder für schnelle Filterung (event, speakers, year, tags, topics, etc.)
- `docMetaJson`: **Komplettes** Dokument-Metadaten-Objekt mit allen Session-Feldern
- `chapters` oder `slides` (je nach Dokumenttyp)

### Pinecone (Vector Database)
✅ **Nur Vektoren** für semantische Suche:

**kind:chunk** - Text-Chunks zum Retrieval
- Chunk-Text (≤1200 chars)
- Kapitel-Kontext (chapterId, chapterTitle, startPage, endPage)
- Keywords

**kind:chapterSummary** - Kapitel-Summaries zum Retrieval
- Summary-Text (≤1200 chars)
- Kapitel-Info (order, pages)

**kind:doc** - Dokument-Level Metadaten
- ❌ **KEIN docMetaJson** mehr (zu groß für Pinecone Metadata!)
- Nur: chunkCount, chaptersCount, ingest_status

## 4. Warum ist kein Index in Pinecone sichtbar?

### Mögliche Ursachen:

1. **Index wurde noch nicht erstellt**
   - Prüfen in Settings → "Index Status prüfen"
   - Index anlegen mit "Index anlegen" Button

2. **Noch keine Dokumente ingested**
   - Session-Dokumente sind in MongoDB, aber **nicht in Pinecone**
   - Ingestion muss manuell gestartet werden

3. **Index-Name stimmt nicht**
   - Default: `slugified(libraryName)`
   - Für "SFSCON (local)" → `sfscon-local`?
   - Prüfen in Library-Config: `vectorStore.indexOverride`

## 5. Session-Dokumente ingesten

### Manuelle Ingestion starten:

**Variante A: Über Settings**
1. `/settings` → Chat-Konfiguration
2. Button: "Index neu aufbauen"
3. Wartet bis alle .md Dateien verarbeitet sind

**Variante B: Über API (einzelnes Dokument)**
```typescript
POST /api/chat/${libraryId}/ingest-markdown
{
  "fileId": "MjAyNCBTRlNDT04v...",
  "fileName": "open source businesses.md"
}
```

### Was passiert beim Ingest?

1. ✅ Markdown-Datei wird gelesen
2. ✅ Frontmatter wird geparst → `docMetaJson`
3. ✅ Body wird gechuned (1500/100)
4. ✅ Embeddings werden erstellt
5. ✅ **Pinecone**: kind:chunk Vektoren hochgeladen
6. ✅ **MongoDB**: Komplettes Dokument mit docMetaJson gespeichert

## 6. Aktueller Status - SFSCON Library

### MongoDB ✅
- Dokumente vorhanden
- docMetaJson komplett mit allen Session-Feldern
- Facetten-Felder auf Top-Level (event, speakers, tags, topics)

### Pinecone ❓
- Vermutlich **leer** oder Index existiert nicht
- Dokumente wurden möglicherweise nie ingested
- Chat-Funktion würde **nicht funktionieren** ohne Pinecone-Vektoren

## 7. Nächste Schritte

### Sofort:
1. **Index-Status prüfen**: `/settings` → "Index Status prüfen"
2. **Index anlegen** (falls nicht vorhanden)
3. **Ingestion starten**: "Index neu aufbauen" Button

### Später optimieren:
- Batch-Ingestion für alle Session-Dokumente
- Progress-Monitoring
- Fehlerbehandlung verbessern

## Zusammenfassung

**MongoDB** = Single Source of Truth für alle Dokument-Daten  
**Pinecone** = Nur für semantische Vector-Suche (Embeddings + minimale Metadaten)

Die **Gallery-Detailansicht** lädt jetzt direkt aus MongoDB (schnell!), der **Chat** würde aus Pinecone retrievieren (semantische Suche).





