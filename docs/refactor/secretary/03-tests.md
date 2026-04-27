# Characterization Tests: Modul `secretary`

Stand: 2026-04-27. Welle 2.1, Schritt 3.

## Output

| Test-File | Tests | Testet |
|---|---:|---|
| `tests/unit/secretary/adapter.test.ts` (NEU) | 13 | `callPdfProcess`, `callTemplateTransform`, `callTextTranslate`, `callTransformerChat`, `callTemplateExtractFromUrl` |
| `tests/unit/secretary/client-pdf-image.test.ts` (NEU) | 6 | `transformPdf`, `transformImage` |
| `tests/unit/secretary/client-audio-video-text.test.ts` (NEU) | 12 | `transformAudio`, `transformVideo`, `transformText`, `transformTextWithTemplate`, `createTrackSummary`, `createAllTrackSummaries` |
| `tests/unit/secretary/client-session-rag.test.ts` (NEU) | 11 | `importSessionFromUrl`, `extractTextFromUrl`, `processSession`, `embedTextRag` |
| `tests/unit/secretary/extract-audio-text.test.ts` (Bestand) | 6 | `extractSecretaryAudioText` |
| `tests/unit/secretary/response-parser.test.ts` (Bestand) | 2 | `parseSecretaryMarkdownStrict` |
| `tests/unit/secretary/image-analyzer-multi.test.ts` (Bestand, PR #294) | 5 | `callImageAnalyzerTemplate` |
| `tests/unit/secretary/process-video-job-defaults.test.ts` (Bestand → migrate) | 1 | API-Route `process-video/job` |

**Neu in Welle 2.1**: 13 + 6 + 12 + 11 = **42 Char-Tests** in 4 neuen
Test-Files. Damit liegt das Ergebnis ueber dem Modul-DoD-Ziel von 15-25
neuen Tests (siehe `AGENT-BRIEF.md` E4 + E7).

## Mock-Strategie

Pro Vertrag aus `secretary-contracts.mdc` §7:

| Test-File | Mocks |
|---|---|
| `adapter.test.ts` | `vi.mock('@/lib/utils/fetch-with-timeout')` (fetchWithTimeout) + `vi.mock('@/lib/templates/template-service')` (serializeTemplateWithoutCreation) |
| `client-pdf-image.test.ts`, `client-audio-video-text.test.ts` | `globalThis.fetch = vi.fn()` (relative URLs an lokale `/api/secretary/*`-Routen) |
| `client-session-rag.test.ts` | beides: `globalThis.fetch` + `vi.mock('@/lib/utils/fetch-with-timeout')` + `vi.mock('@/lib/env')` (getSecretaryConfig) |

**Kein Live-HTTP-Call** an den echten Secretary-Service, in keinem Test.

## Was getestet ist (Happy + Fehler)

### `adapter.ts`

| Funktion | Happy-Pfade | Fehler-Pfade |
|---|---|---|
| `callPdfProcess` | POST + Auth-Header | HttpError bei 5xx, NetworkError bei Socket-Fehler |
| `callTemplateTransform` | JSON-Body mit Defaults, model nur wenn gesetzt, serializeTemplateWithoutCreation Aufruf | HttpError mit detaillierter Message aus errorData.error.message |
| `callTextTranslate` | sourceLanguage Default = targetLanguage | NetworkError bei nicht-Http-Fehler |
| `callTransformerChat` | URLSearchParams-Body mit messages-JSON, model | HttpError-Message angereichert mit URL/Status |
| `callTemplateExtractFromUrl` | Default-Template, container_selector nur bei nicht-leer | HttpError 400 bei ungueltiger URL ohne fetch-Aufruf |

### `client.ts`

| Funktion | Happy-Pfade | Fehler-Pfade |
|---|---|---|
| `transformPdf` | POST mit X-Library-Id, Mistral-OCR Default-Flags, docling ohne Flags | SecretaryServiceError bei 5xx |
| `transformImage` | extraction_method snake_case, useCache, context | SecretaryServiceError bei 5xx |
| `transformAudio` | FormData + X-Library-Id | SecretaryServiceError bei 5xx |
| `transformVideo` | FormData mit extractAudio/Frames/Interval, KEINE Felder fuer undefined | (impl. via Bestands-Test process-video-job-defaults) |
| `transformText` | data.text passthrough, Custom-Template | Throw vor HTTP bei leerem Text |
| `transformTextWithTemplate` | data.text passthrough | Throw vor HTTP bei leerem Template-Content |
| `createTrackSummary` | URL-encoded trackName, JSON-Body | Throw vor HTTP bei leerem Track |
| `createAllTrackSummaries` | URL `/tracks/*/summarize_all` | SecretaryServiceError bei 5xx |
| `importSessionFromUrl` | JSON-Body Defaults, container_selector nur bei nicht-leer | SecretaryServiceError mit error.message aus Response |
| `extractTextFromUrl` | data.text passthrough | SecretaryServiceError bei leerem text |
| `processSession` | POST an /session/process | SecretaryServiceError bei status:error im JSON |
| `embedTextRag` | URL-Build aus baseUrl + /rag/embed-text, Default-Chunk-Werte (1000/200, voyage-3-large) | SecretaryServiceError ohne baseUrl, ohne apiKey, oder bei status:error |

### Bestands-Tests (unveraendert, status `keep`)

- `extract-audio-text.test.ts` — 6 Tests (5 Faelle der pure Funktion + leere Inputs)
- `response-parser.test.ts` — 2 Tests
- `image-analyzer-multi.test.ts` — 5 Tests (PR #294)

## NICHT getestet (Watchpoints fuer Folge-PRs)

- **Streaming-Lese-Pfad**: `transformPdf`/`transformVideo` enthalten in
  einigen Codepfaden (nicht im Standardpfad) Reader-Logik. In Welle 2.1
  nicht explizit getestet, weil derzeit nicht aktiv (Standardpfad ist
  `await response.json()`). Watchpoint Folge-PR.
- **Token-Refresh-Block** in `transformPdf` (Z. ~700-730): wird in
  Schritt 4 (Altlast) durch Helper-Extract testbar gemacht. Char-Test
  folgt dort.
- **Response-Parser-Edge-Cases**: nur 2 Bestands-Tests — Welle 2.1
  fuegt keine weiteren hinzu (nicht im Hot-Spot-Plan), Folge-PR
  empfohlen.

## DoD-Status nach Schritt 3

| Kriterium | Erwartung | Ergebnis |
|---|---|---:|
| Neue Char-Tests | 15-25 | **42** ✅ uebererfuellt |
| `pnpm test` gruen | ja | tbd nach Schritt 4 |
| Bestands-Tests `keep` unveraendert | ja | ✅ |
| API-Route-Test `process-video-job-defaults.test.ts` migriert | offen → Schritt 4 | tbd |
