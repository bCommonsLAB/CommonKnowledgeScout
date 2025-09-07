---
title: Analyse – Neuer PDF → Markdown → RAG Workflow
status: draft
lastUpdated: 2025-09-06
---

## Kurzfassung
Der neue Workflow trennt klar drei Phasen: (1) reine PDF→Markdown‑Extraktion, (2) LLM‑basierte Frontmatter‑Generierung und Dokumentanalyse, (3) Ingestion in Vektor‑ und optional Graph‑Datenbank. Zwischen jeder Phase sind Prüfansichten vorgesehen (Human‑in‑the‑Loop). Idempotenz wird über eine stabile `fileId` gewährleistet; Pinecone erhält pro Dokument einen `kind:"doc"`‑Eintrag (Facetten) sowie `kind:"chunk"`‑Einträge (Retrieval).

## Prozessphasen (Sollbild)
- Phase 1: PDF→Markdown (Shadow‑Twin)
  - Input: PDF
  - Output: Markdown (.md) mit minimalem Frontmatter (technische Felder)
  - Owner: Secretary (Extraktion/OCR)
- Phase 2: LLM‑Metadaten & Analyse
  - Input: Markdown + Pfad/Dateiname + Akronym‑Legende
  - Output: Vollständiges YAML‑Frontmatter (flach, typisiert), Kapitel/TOC/Geo‑Signale in `cumulativeMeta`
  - Owner: Secretary (Template/LLM) + Review in Knowledge Scout
- Phase 3: Ingestion (RAG/Graph)
  - Input: Angereicherter Shadow‑Twin
  - Output: Pinecone‑Upserts (`chunk` + `doc`), optional Graph‑Knoten/Kanten
  - Owner: Knowledge Scout (Ingestion Service) + optional Graph Service

## Systemgrenzen & Verantwortlichkeiten
- Secretary Service: Extraktion, Template‑Transformation, LLM‑Frontmatter, optionale Geo‑Anreicherung, Callback mit `ExternalJob`‑Updates.
- Knowledge Scout: Job‑Tracking (steps, parameters, cumulativeMeta, metaHistory), Shadow‑Twin‑Persistenz, RAG‑Ingestion (Pinecone), Galerie & Chat.
- RAG‑Infrastruktur: Pinecone Index (Namespace/Dimension wie konfiguriert), optional Graph‑DB (z. B. Neo4j) für reichere Facetten.

## Datenverträge (Kern)
- Frontmatter (minimal Phase 1): `source_file`, `source_file_id`, `source_file_type`, `pages`, `process_id`, `extraction_method`.
- Frontmatter (erweitert Phase 2): `title`, `authors`, `year`, `short_title`, `region`, `doc_type`/`resource_type`, `source`, `journal`, `issue`, `status`, `project`, `tags`, `municipalities`, `valleys`, `confidence`, `provenance`.
- Job‑Tracking: `steps[]`, `parameters` (inkl. `useIngestionPipeline`, `template`), `metaHistory[]`, `cumulativeMeta`, `ingestion` (Zähler/Index/Fehler).
- Pinecone
  - Chunk‑Vektor: `id = ${fileId}-${i}`, `metadata = { kind:'chunk', user, libraryId, fileId, fileName, chunkIndex, text, upsertedAt, …geo? }`
  - Doc‑Vektor: `id = ${fileId}-doc`, `metadata = { kind:'doc', user, libraryId, fileId, fileName, upsertedAt, docMetaJson }`
  - `docMetaJson`: kompakter JSON‑String (≤ ~8KB) mit Facetten: `title`, `shortTitle`, `authors[]`, `year`, `region`, `docType`/`resource_type`, `source`, `tags[]`, optional `geo` (municipalities/valleys/mentions).

## Idempotenz & Versionierung
- Stabile `fileId` aus dem Ursprungs‑PDF (`correlation.source.itemId`).
- Re‑Runs überschreiben `doc` und `chunk` deterministisch (gleiche IDs). Optional vorheriges `deleteByFilter` für „replace all“.
- Shadow‑Twin bleibt Single‑Source‑of‑Truth; Frontmatter‑Felder nur ersetzen, wenn Confidence/Provenienz „besser“ ist.

## Fehlerszenarien & Recovery
- Extraktion/OCR fehlgeschlagen → Step `extract_pdf` auf `failed`, klare Logmeldung, keine Folge‑Steps.
- Template/LLM Fehler → Step `transform_template` auf `failed`, `metaHistory` mit Fehlerdetails.
- Pinecone 400 (Metadata) → harte Validierung: nur primitive Typen/Listen von Strings; `docMetaJson` immer JSON‑stringify + truncate.
- Teil‑Erfolg (Chunks ok, Doc fehlt) → Wiederholbarer `doc`‑Upsert über `fileId-doc`.
- Watchdog: Jobs mit „stale“ Status erkennen und markieren.

## Sicherheit & Datenschutz
- Auth per Clerk (Server‑Side). Sekundär: Service‑Token für Secretary.
- Keine Secrets an den Client; Logs maskieren Tokens.
- Content‑Security: keine Rückgabe von Roh‑Dokumentinhalten über Chat‑APIs.

## Qualitätssicherung & Metriken
- Metriken: OCR‑Dauer, Tokens/LLM‑Kosten, Chunk‑Anzahl, Upsert‑Counts, Fehlerraten, Zeit je Phase.
- Log‑Disziplin: `FileLogger`/`UILogger` mit Phasen‑Tags und Job‑IDs.

## Teststrategie (minimal lauffähig)
- Unit: Normalisierer (authors/tags/region), Frontmatter‑Validator, Pinecone‑Payload‑Builder.
- Integration: `/api/secretary/process-pdf`, `/api/external/jobs/[jobId]`, Ingestion‑Service (Mock Pinecone), Gallery‑APIs (Docs/Facets) mit Filterkombinationen.
- E2E: Batch Phase‑1 → Review → Phase‑2 → Review → Phase‑3; anschließend Galerie‑Filter + Chat‑Retriever (chunk/doc) verifizieren.

## Migration & Backfill
- Schrittweise: Bestehende PDFs zuerst Phase‑1 (Batch), dann Phase‑2 (LLM), zuletzt Phase‑3 (Ingestion). Idempotent wiederholbar.
- Backfill‑Priorität: Dokumente mit hoher Nutzung/Strategierelevanz zuerst.

## Abgleich mit RAG‑Zielarchitektur
- Konsistent mit „Summaries vs. Chunks“: `kind:'doc'` für Facetten/Galerie, `kind:'chunk'` für semantisches Retrieval.
- Retriever‑Umschalter (chunk|doc) deckt beide Modi ab.
- Galerie‑Facetten aus `docMetaJson`; konfigurierbar per Library.

## Offene Entscheidungen
- Endgültige Prioritätenmatrix (Feld→Quellenhierarchie, Provenienz/Confidence).
- Gazetteer‑Quelle und Geo‑Normalisierung (Gemeinde↔Tal, Flurnamen); Qualitätsgrenzen/Review.
- Graph‑DB Auswahl/Schema (wenn Phase‑3‑Graph gewünscht) und Synchronisation mit Pinecone IDs.
- Delete/Replace‑Strategie bei Re‑Ingestion großflächiger Bestände.

## Empfehlungen / Nächste Schritte
1) Matrix & Output‑Schema finalisieren (LLM‑Step). 2) Validator/Normalizer implementieren. 3) Galerie‑Facetten um Geo erweitern (falls benötigt). 4) Optionale Graph‑Ingestion spezifizieren und als separaten Step hinterlegen. 5) Tests (Unit/IT/E2E) aufsetzen, insbesondere für Idempotenz und Facettenfilter.




