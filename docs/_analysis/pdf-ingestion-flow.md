---
title: PDF/Markdown Ingestion Flow – Analyse und Vereinheitlichung
updated: 2025-10-24
status: draft
---

## Ziel

Analyse des bestehenden PDF→Markdown→Ingestion Flows und Ableitung, wie wir ihn so erweitern, dass auch bereits vorhandene Markdown‑Dateien (mit Frontmatter) ohne PDF‑Schritt ingestiert werden können. Fokus: gemeinsame Bausteine, minimale Änderungen, Batch‑Tauglichkeit.

## High‑Level Pipeline (PDF)

```mermaid
flowchart TD
  A[PDF in Library] --> B[Extract + Template → Markdown+FM]
  B --> C[saveMarkdown in Quellordner]
  B --> D{images_archive_url?}
  D -->|ja| E[Entpacken nach .<basename>/ + Seiten‑Markdown]
  B --> F[Ingestion (Pinecone + Mongo DocMeta)]
  C --> F
  E --> F
  F --> G[Gallery/Facetten/Chat]
```

## Belegstellen (Code‑Referenzen)

### Ingestion (Pinecone + Mongo)

```1:26:src/lib/chat/ingestion-service.ts
export class IngestionService {
  static async enqueueLibraryIngestion(...)
```

```54:71:src/lib/chat/ingestion-service.ts
static async upsertMarkdown(userEmail, libraryId, fileId, fileName, markdown, meta, jobId) {
  const ctx = await loadLibraryChatContext(userEmail, libraryId)
  const idx = await describeIndex(ctx.vectorIndex, apiKey)
```

Frontmatter wird strikt geparst, Body gechunkt, Embeddings erzeugt und upserted. DocMeta wird nach Mongo upserted; ein minimales Doc‑Vektorobjekt wird ebenfalls in Pinecone angelegt:

```73:86:src/lib/chat/ingestion-service.ts
const { meta: metaFromMarkdown, body } = parseFrontmatter(markdown)
const metaEffective = { ...metaFromMarkdown, ...(meta||{}) }
```

```165:176:src/lib/chat/ingestion-service.ts
let spans = splitByPages(body) || [{ page:1, startIdx:0, endIdx: body.length }]
```

```316:425:src/lib/chat/ingestion-service.ts
await upsertVectorsChunked(idx.host, apiKey, vectors, 8)
// Mongo DocMeta upsert + Pinecone Doc‑Meta Vektor
```

### Speicher von Markdown und Bildern

```493:512:src/app/api/external/jobs/[jobId]/route.ts
const markdown = createMarkdownWithFrontmatter(bodyOnly, mergedMeta)
await saveMarkdown({ ctx, parentId: targetParentId, fileName: uniqueName, markdown })
```

```59:67:src/lib/transform/image-extraction-service.ts
const folderItem = await provider.createFolder(originalItem.parentId, this.generateImageFolderName(originalItem.metadata.name))
```

## Abgleich: Event‑Flow vs. PDF‑Flow

- Gemeinsame Bausteine:
  - Frontmatter‑Erzeugung/Parsing: `lib/markdown/compose.ts`, `lib/markdown/frontmatter.ts`
  - Speicherung in Library: `saveMarkdown` + Provider
  - Bilder‑Extraktion: `ImageExtractionService.saveZipArchive`
  - Ingestion: `IngestionService.upsertMarkdown`
  - Monitoring/Jobs: `ExternalJobsRepository`/Event‑Monitor

- Unterschiede:
  - Event‑Flow: Frontmatter primär aus Website/Template; Quelle ist eine Web‑Session, nicht unbedingt PDF.
  - PDF‑Flow: Extract+Template erzeugen die Markdown‑Grundlage.

## Ziel: Markdown‑Only Ingestion unterstützen

Anforderung: Wenn eine Datei bereits Markdown mit Frontmatter ist, Schritte Extract/Template überspringen und direkt Ingestion ausführen.

Vorschlag:
1) Erkennungslogik (Dateityp/Name): `.md` erkennen; optional `parseFrontmatter` → wenn valides Frontmatter vorhanden → Ingestion‑Pfad.
2) Job‑Parameter: Phasen steuern (bereits vorhanden) – `phases: { extract: false, template: false, ingest: true }`.
3) Orchestrator (`/api/external/jobs/[jobId]/start` + Callback‑Route):
   - Falls `runIngestOnly` (bereits implementiert für Shadow‑Twin‑Fälle) → Markdown laden, `IngestionService.upsertMarkdown` direkt aufrufen.
   - Für reine Markdown‑Dateien: Geschwistersuche entfällt; direkt das referenzierte Markdown‑Item laden.

Minimaler Code‑Eingriff (Skizze)

1) In `start`‑Route prüfen, ob Quelle Markdown ist, und `runIngestOnly` setzen:

```diff
@@ src/app/api/external/jobs/[jobId]/start/route.ts
- const src = job.correlation?.source
+ const src = job.correlation?.source
+ const isMarkdown = typeof src?.mimeType === 'string' && src.mimeType.includes('markdown') || (src?.name || '').toLowerCase().endsWith('.md')
  ...
  const runIngestOnly = ingestEnabled && !runExtract && !runTemplate
+ // zusätzlich: reine Markdown-Dateien
+ const runIngestForMarkdown = ingestEnabled && isMarkdown
+ if (runIngestForMarkdown) { /* ähnlich wie bestehendes runIngestOnly */ }
```

2) In Callback‑Route (falls Markdown) direkt Ingestion mit geladenem Markdown:

```diff
@@ src/app/api/external/jobs/[jobId]/route.ts
- // Lade gespeicherten Markdown-Inhalt erneut (vereinfachend: extractedText)
+ // Für Markdown-Quellen: Markdown direkt aus Provider laden
  const fileId = (job.correlation.source?.itemId as string | undefined) || savedItemId || `${jobId}-md`;
  const fileName = ...
  let markdownForIngestion = extractedText || ''
  if (!markdownForIngestion) {
    const provider = await getServerProvider(job.userEmail, job.libraryId)
    const bin = await provider.getBinary(fileId)
    markdownForIngestion = await bin.blob.text()
  }
  await runIngestion({ ctx, savedItemId: fileId, fileName, markdown: markdownForIngestion, meta: docMetaForIngestion })
```

3) Batch‑Finder: Verzeichnis scannen → für jedes Item Job anlegen
   - PDFs mit Shadow‑Twins: existierendes Verhalten
   - isolierte `.md`: neuer Job mit Phasen `{ extract:false, template:false, ingest:true }`

## Kompatibilitätscheck

- PDF‑Flow bleibt unangetastet: Default‑Phasen unverändert.
- Markdown‑Only ist additive Abzweigung via Phasen/Erkennung.
- Ingestion nutzt die bereits vorhandenen Validierungen (Facetten/DocMeta‑Upsert) und bricht nicht auf fehlende Kapitel ab (nur Warnungen).

## Offene Baustellen / To‑Dos

1) Start‑Route: „Markdown‑Only“ Kurzschluss analog `runIngestOnly` (code‑Pfad einfügen).
2) Callback‑Route: sicherer Pfad zum Laden des Markdown‑Inhalts (auch ohne `extractedText`).
3) Batch‑Scanner: Quelle für „Durchsuche Verzeichnis“ (UI/Server) und Job‑Erstellung je Datei (PDF/MD mixed).
4) Testfälle:
   - MD mit gültigem Frontmatter (chapters/pages vorhanden)
   - MD ohne Frontmatter → minimale Meta; Ingestion erlaubt, Facetten leer
   - Mixed Batch: PDFs mit Shadow‑Twin + isolierte MDs
5) Doku/UX: Erklären, dass MD‑Dateien mit Frontmatter direkt ingestiert werden können.

---

Kurzfazit: Der bestehende Ingestion‑Kern (`IngestionService.upsertMarkdown`) ist bereits dateitypunabhängig. Mit einer kleinen Erkennungslogik und Phasen‑Steuerung im Orchestrator können wir Markdown‑Only unterstützen, ohne den PDF‑Flow zu verändern. Batch‑weise Verarbeitung (PDF+MD gemischt) ist so mit minimalen Änderungen möglich.



