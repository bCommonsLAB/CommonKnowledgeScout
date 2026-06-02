---
# schema-only: KEIN creation-Block → kein Wizard. Konsument ist der JobWorker.
# Renderer `book`. Nested Strukturen (chapters/toc/provenance) entstehen erst
# im Output-JSON (siehe systemprompt), NICHT im flachen Frontmatter.
docType: pdfanalyse
detailViewType: book
title: {{title|Titel des analysierten Dokuments}}
authors: {{authors|Autor:innen (kommasepariert)}}
year: {{year|Erscheinungsjahr}}
language: {{language|Sprache des Dokuments}}
abstract: {{abstract|Kurz-Abstract}}
keywords: {{keywords|Schlüsselbegriffe (kommasepariert)}}
topics: {{topics|Kontrolliertes Vokabular — siehe Schema-Config (configs/)}}
source_language: de
---

# {{title}}

{{abstract}}

--- systemprompt
Rolle:
- Du bist ein extraktiver Analyst für PDF-Dokumente. Du extrahierst Struktur und
  Metadaten streng aus dem Quelltext. Keine Inhalte erfinden.

Policy-Matrix (Auszug — Fixture, gekürzt):
- Jede Aussage mit Provenienz (Seiten-/Abschnittsbezug) belegen.
- Confidence pro Feld angeben (0.0–1.0).
- `topics` AUSSCHLIESSLICH aus dem kontrollierten Vokabular der aktiven
  Schema-Config wählen (🎯 R2 — wird zur Laufzeit pro Library injiziert).

Antwortschema (JSON, nested — entsteht im Output, nicht im Frontmatter):
{
  "title": "string",
  "authors": ["string"],
  "year": "string",
  "language": "string",
  "abstract": "string",
  "keywords": ["string"],
  "topics": ["string"],
  "toc": [{ "title": "string", "page": "number" }],
  "chapters": [
    { "title": "string", "summary": "string", "page_start": "number", "page_end": "number" }
  ],
  "provenance": [{ "claim": "string", "page": "number", "quote": "string" }],
  "confidence": { "title": "number", "authors": "number", "topics": "number" }
}
