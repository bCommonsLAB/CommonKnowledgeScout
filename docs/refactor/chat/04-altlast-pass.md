# Altlast-Pass: Modul `chat`

Stand: 2026-04-27. Welle 2.3, Schritt 4.

## Erledigte Punkte

### 1. Neun leere Catches eliminiert ✅

| # | Datei | Zeile | Kontext | Loesung |
|---|---|---:|---|---|
| 1 | `ingestion-service.ts` | 105 | `validateAndSanitizeFrontmatter` | `console.warn` mit Begruendung |
| 2 | `ingestion-service.ts` | 152 | Frontmatter-Vorab-Check | `console.warn` mit Begruendung |
| 3 | `ingestion-service.ts` | 1071 | `repo.traceAddEvent('pdf_uploaded')` | Helper `emitIngestTraceEvent` |
| 4 | `ingestion-service.ts` | 1137 | `repo.traceAddEvent('pdf_upload_failed')` | Helper `emitIngestTraceEvent` |
| 5 | `ingestion-service.ts` | 1217 | `ensureFacetIndexes` | `console.warn` |
| 6 | `ingestion-service.ts` | 1244 | Facet-Mirroring | `console.warn` |
| 7 | `ingestion-service.ts` | 1386 | `repo.traceAddEvent('meta_doc_upsert_done')` | Helper |
| 8 | `ingestion-service.ts` | 1400 | `repo.traceAddEvent('doc_meta_upsert_failed')` | Helper |
| 9 | `retrievers/chunks.ts` | 418 | Lexical-Boost-Berechnung | `console.warn` |

### 2. Helper `emitIngestTraceEvent` extrahiert ✅

In `ingestion-service.ts` Zeilen 27-43 — kapselt `repo.traceAddEvent`-
Aufrufe. Loggt Fehler explizit. Entfernt 4x duplizierten Code.

### 3. Char-Tests fuer pure Helper ✅

Siehe [`03-tests.md`](./03-tests.md): 32 neue Tests in 3 Files.

## Health-Stats: Vorher / Nachher

| Kennzahl | Vorher | Nachher | Status |
|---|---:|---:|---|
| Files | 30 | 30 | ✅ unveraendert |
| Max-Zeilen | 1.435 (`ingestion-service.ts`) | 1.474 | 🟡 +39 (durch Helper-Definition + ausfuehrlichere Catch-Bodies) |
| > 200 Zeilen | 14 | 14 | ✅ unveraendert |
| Leere `catch{}` | **9** | **0** | ✅ Pflicht erfuellt |
| `any` | 0 | 0 | ✅ |
| `'use client'` | 0 | 0 | ✅ |

## DoD-Honesty: Max-Zeilen

`ingestion-service.ts` ist um 39 Zeilen gewachsen, weil 9 leer-gefangene
Fehler durch ausfuehrliche `console.warn`-Aufrufe mit Begruendungen
ersetzt wurden — und ein Helper `emitIngestTraceEvent` (~17 Zeilen)
hinzukam. Die Reduktion durch Helper-Wiederverwendung (4 Trace-Aufrufe
mit je ~10 Zeilen → 4 Aufrufe mit je 5-6 Zeilen) gleicht die Zunahme
nicht aus.

**Bewusste Akzeptanz**: lieber +39 Zeilen mit explizitem Logging als
9 stillende `catch {}`. Voller Split von `ingestion-service.ts` (1.474 Z.)
ist nicht Welle-Scope (siehe AGENT-BRIEF-Stop-Bedingungen). Folge-PR.

## NICHT erledigte Watchpoints

1. **`ingestion-service.ts` (1.474 Z.) splitten** — Folge-PR. Sollte
   in `ingest-mongo-doc.ts` / `ingest-vectors.ts` / `ingest-pdf-upload.ts`
   aufgeteilt werden.
2. **`constants.ts` (888 Z.)** — Konstanten-Pool, sollte nach Domaene
   gegliedert werden. Folge-PR.
3. **`common/prompt.ts` (982 Z.)** — Prompt-Bibliothek, Folge-PR.
4. **`retrievers/chunks.ts` (560 Z.)** — RAG-Hauptpfad, char-Tests
   noetig vor Split.
5. **MongoDB-/HTTP-Mock-Setup**: fuer Service-Layer-Tests
   (`orchestrator`, `loader`, `ingestion-service`) waere ein
   gemeinsames Mock-Module sinnvoll. Folge-PR.

## Folge-PR-Empfehlung

| Was | Aufwand | Begruendung |
|---|---|---|
| `ingestion-service.ts` aufsplitten | gross | 1.474 Z. — Hauptlast |
| Char-Tests mit Mongo-Mocks fuer `retrievers/*.ts` | mittel | RAG-Hot-Path |
| `constants.ts` modularisieren | klein-mittel | reine Refactoring-Pflicht |
| `common/prompt.ts` modularisieren | mittel | grosse Datei, viele Prompt-Templates |
