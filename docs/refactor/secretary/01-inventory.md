# Inventur: Modul `secretary`

Stand: 2026-04-27. Erstellt vom IDE-Agent als Pre-Flight fuer Welle 2.1
(siehe [`AGENT-BRIEF.md`](./AGENT-BRIEF.md)).

Quelle: `pnpm health -- --module secretary` plus manuelle Test- und
Cross-Modul-Zuordnung.

## 1. Modul-Health-Zusammenfassung

| Modul | Files | Max-Zeilen (Datei) | > 200 Zeilen | hat Tests | any | leere catch{} | use client |
|---|---:|---|---:|---|---:|---:|---:|
| `secretary` | 7 | 1223 (`client.ts`) | 3 | **ja** | 0 | **1** | 0 |

Vergleich zu Welle-1-Modulen:

| Modul | Files | Max-Zeilen | > 200 Zeilen | leere catch{} |
|---|---:|---:|---:|---:|
| `storage` | 15 | (gross) | mehrere | 0 (nach Welle 1) |
| `shadow-twin` | 30 | (gross) | mehrere | 0 (nach Welle 1) |
| `ingestion` | 7 → 8 | 832 | 1 | 0 |
| **`secretary`** | **7** | **1223** | **3** | **1** |

`secretary` ist strukturell etwas aufwendiger als `ingestion` (3 Files
> 200 Zeilen statt 1) und enthaelt **einen leeren Catch** in `client.ts`
— erster Pflicht-Fix der Welle.

## 2. Files in `src/lib/secretary/`

Sortiert nach Zeilen, absteigend.

| Datei | Zeilen | hat direkten Test | Anmerkung |
|---|---:|---|---|
| `client.ts` | 1.222 | nein | HTTP-Client zum Secretary-Service. 14 oeffentliche Funktionen + 5 Interfaces + 1 Error-Klasse. **Hauptlast** der Welle. |
| `adapter.ts` | 440 | nein | Lower-Level Adapter (`callPdfProcess`, `callTemplateTransform`, `callTextTranslate`, `callTransformerChat`, `callTemplateExtractFromUrl`). |
| `image-analyzer.ts` | 216 | ja (`image-analyzer-multi.test.ts`, neu via PR #294) | `callImageAnalyzerTemplate` — multi-image OCR-Wrapper. |
| `types.ts` | 175 | nein | 7 Interfaces (Audio/Pdf/Video/Session-DTOs). Pure Types — kein Test-Bedarf. |
| `response-parser.ts` | 159 | ja (`response-parser.test.ts`) | `parseSecretaryMarkdownStrict` — Frontmatter-Parser. |
| `constants.ts` | 45 | nein | `LANGUAGE_MAP`, `SUPPORTED_LANGUAGES`, `TEMPLATE_MAP`. Pure Konstanten. |
| `extract-audio-text.ts` | 41 | ja (`extract-audio-text.test.ts`) | `extractSecretaryAudioText` — pure Funktion. |

**Test-Coverage**: 3 von 7 Files mit direktem Test (~43 %). `client.ts`,
`adapter.ts`, `types.ts`, `constants.ts` ohne direkten Test.

### 2.1 Bestehende Tests

| Test-Datei | Zeilen | Testet |
|---|---:|---|
| `tests/unit/secretary/extract-audio-text.test.ts` | 61 | `extract-audio-text.ts` (pure Funktion) |
| `tests/unit/secretary/image-analyzer-multi.test.ts` | 272 | `image-analyzer.ts` (multi-image, **neu via PR #294**) |
| `tests/unit/secretary/response-parser.test.ts` | 36 | `response-parser.ts` |
| `tests/unit/secretary/process-video-job-defaults.test.ts` | 61 | NICHT `secretary/`, sondern API-Route `app/api/secretary/process-video/job/route.ts` (Cross-Modul-Test, **Audit-Frage** ob `keep` oder verschoben in `tests/unit/api/secretary/`) |

## 3. Aufrufer (Cross-Modul-Bezug)

`src/lib/secretary/` wird genutzt von:

| Aufrufer | Datei(en) | Anmerkung |
|---|---|---|
| `external-jobs` | `phase-template.ts`, `template-run.ts`, `extract-only.ts`, `phase-shadow-twin-loader.ts`, `mistral-ocr-download.ts`, `images.ts`, `run-composite-multi-image.ts` | Hauptkonsument (Pipeline) |
| `chat` | `chat/rag-embeddings.ts`, `chat/common/llm.ts`, `chat/common/document-translation.ts` | Embeddings + Translation via Secretary |
| `transform` | `transform/transform-service.ts` | Direkte Transform-Aufrufe |
| `shadow-twin` | `shadow-twin/store/shadow-twin-service.ts` | Cross-Modul-Datenfluss |
| `app/api/secretary` | API-Routen unter `src/app/api/secretary/**` | Externe HTTP-Endpunkte |
| `creation-wizard` | `creation-wizard/steps/collect-source-step.tsx` | Direkter UI-Aufruf (Audit-Watchpoint!) |
| `event-monitor` | `event-monitor/batch-list.tsx`, `batch-process-dialog.tsx` | UI-Komponenten (Audit-Watchpoint!) |
| `session-manager`, `event-monitor/page.tsx`, `settings/secretary-service/page.tsx` | Pages | Aufrufe von Secretary-API |

**Watchpoint UI ↔ Secretary**: einige UI-Komponenten importieren direkt
aus `src/lib/secretary/`. Ist das Architektur-konform oder Drift? Wird
in Schritt 0 (Audit) bewertet.

## 4. Zentrale Architektur-Rule(s)

Keine modul-spezifische Rule existiert. Verwandte Rules:

- [`shadow-twin-contracts.mdc`](../../../.cursor/rules/shadow-twin-contracts.mdc)
  — erwaehnt `secretary` am Rande als Vertragspartner.
- [`contracts-story-pipeline.mdc`](../../../.cursor/rules/contracts-story-pipeline.mdc)
  — Pipeline-Contract (deckt Secretary indirekt ab).
- [`no-silent-fallbacks.mdc`](../../../.cursor/rules/no-silent-fallbacks.mdc)
  — global; relevant fuer den `catch {}` in `client.ts:731`.

**Status fuer Audit**: keine bestehende secretary-spezifische Rule. Eine
neue `.cursor/rules/secretary-contracts.mdc` wird in Schritt 2 angelegt.

## 5. Hot-Spots fuer Welle 2.1

### 5.1 Pflicht-Char-Tests (Schritt 3)

| Datei | Begruendung | geschaetzte Tests |
|---|---|---:|
| `client.ts` (1.222 Z.) | 14 oeffentliche Funktionen, 0 Tests, **Hauptlast** | 8-12 (1 Happy-Path je grosser Funktion) |
| `adapter.ts` (440 Z.) | 5 Adapter-Funktionen mit FormData/Headers-Aufbau | 5-7 |
| `constants.ts` | Pure Konstanten — Test optional, nicht Pflicht | 0-1 (Smoke) |
| `types.ts` | Pure Types — kein Test-Bedarf | 0 |

Bestehende Tests bleiben (Audit-Status `keep`):

- `extract-audio-text.test.ts` (1 Test-File)
- `image-analyzer-multi.test.ts` (PR #294, neu)
- `response-parser.test.ts` (1 Test-File)

### 5.2 Pflicht-Splits (Schritt 4)

| Datei | Zeilen | Vorschlag |
|---|---:|---|
| `client.ts` | 1.222 | Pragmatisch wie `image-processor.ts` in Welle 1: erst Char-Tests, dann pure Helper extrahieren (Token-Refresh, FormData-Builder, Streaming-Reader). Voller Split nach Endpunkt-Typ (audio/pdf/video/image/session) ist Folge-PR. |
| `adapter.ts` | 440 | Optional: pure Helper extrahieren (Header-Builder, FormData-Helpers). Nicht Pflicht in dieser Welle. |
| `image-analyzer.ts` | 216 | Knapp ueber 200 — niedrige Prio, eventuell Helper-Extract der Multi-Bild-Logik. |

### 5.3 Pflicht-Fix Silent Catch

`src/lib/secretary/client.ts:731` enthaelt `} catch {}` (in `transformPdf`).
Schritt 4 Pflicht-Fix per `no-silent-fallbacks.mdc`: throw oder
bewusstes Default mit Logging + Begruendung.

### 5.4 Cross-Modul-Beobachtung

- UI-Komponenten (`event-monitor/`, `creation-wizard/`) importieren direkt
  aus `src/lib/secretary/` — Audit-Frage Schritt 0.
- `client.ts` ruft direkt `localStorage.setItem` auf (Zeile 720-721) —
  Browser-API in einer Server-Lib? Audit-Frage.

## 6. Bekannte Risiken / Watchpoints

- **`client.ts` ist 1.222 Zeilen** — Hauptarbeit. Voller Split ohne
  Char-Tests ist riskant; Reihenfolge: erst Char-Tests, dann Split,
  dann ggf. weitere Tests pro Sub-Modul.
- **Mocks-Pflicht**: `fetch`-Aufrufe sind ueberall. Saubere Mocks
  (`vi.fn()` fuer `globalThis.fetch` oder `fetch-with-timeout`),
  keine Live-Calls zum Secretary-Service.
- **Cross-Modul-Bezug zu `shadow-twin`** und `external-jobs` (Pilot
  abgeschlossen) — Tests sollen auf bestehenden Mocks aufbauen.
- **PR #294 (composite-multi-image)** hat `client.ts` und
  `image-analyzer.ts` erweitert. **Frischer Code** — Char-Tests sind
  hier besonders wertvoll, weil noch nicht abgedeckt.
- **`secretary`-Service ist EXTERN** — Welle wird **NICHT** den
  externen Service oder seine Vertraege aendern. Nur den Wrapper.
- **`process-video-job-defaults.test.ts`** liegt in
  `tests/unit/secretary/`, testet aber eine API-Route. Audit-Frage:
  verschieben oder lassen?
