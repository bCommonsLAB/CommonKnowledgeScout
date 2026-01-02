## Ziel

Dieses Dokument definiert die **formatspezifischen Schnittstellen** zwischen:

- **CommonKnowledgeScout (Next.js App)** als Orchestrator/Proxy/Artifact-Manager
- **Common Secretary Services** als einzigem System für **Extraction** und **Transformation**

Ziel ist ein **Implementationsvertrag** für die artefakt‑zentrierte Pipeline (Variante 3), insbesondere für V0 (PDF Mistral OCR + Pages/Images) und V1 (Audio/Video/YouTube/DOCX/XLSX).

Quellen:
- API Überblick: `docs/_analysis/SecretaryService API overview.md`
- Bestehende Next Routes: `src/app/api/secretary/*/route.ts`
- Bestehende Typen: `src/lib/secretary/client.ts`

## Gemeinsame Prinzipien (für alle Formate)

### Auth
- Next.js → Secretary: `Authorization: Bearer <SECRETARY_SERVICE_API_KEY>` oder `X-Secretary-Api-Key: <...>`
- Client → Next.js: Clerk Auth (wie in den bestehenden Routes)

### Standard-Response (Secretary)
- Responses folgen einem Standard-Schema mit `status`, optional `request`, optional `process`, `data`, `error`.

### Async Orchestrierung (Variante 3)
- Für lange Prozesse (PDF Mistral OCR, Video, große Dateien) gilt: **Next erstellt External Job**, Worker startet, Secretary liefert Ergebnis via Callback/Webhook (oder Next pollt).
- UI erhält Updates über SSE `/api/external/jobs/stream`.

### Artefakt-Outputs (Shadow Twin)
- Extract/Transcript: `{base}.{lang}.md`
- Transformation: `{base}.{template}.{lang}.md`
- Assets: per URL/Refs (ZIP/Files), keine großen Base64 als Standard.

## PDF – Mistral OCR (V0 Pflicht)

### Next Entry Point (bestehend)
- `POST /api/secretary/process-pdf`

#### Request (FormData)
- `file`: PDF Datei
- `targetLanguage`: string, default `de`
- `extractionMethod`: string, **für V0 = `mistral_ocr`**
- `includeOcrImages`: boolean string (`true|false`) – default bei `mistral_ocr` = `true`
- `includePageImages`: boolean string (`true|false`) – default bei `mistral_ocr` = `true`
- `useCache`: string (`true|false`)
- optional: `template`: string (für template‑Phase)
- optional: `policies`: JSON string (extract/metadata/ingest)
- optional (Batch): `batchId`, `batchName`
- optional: `originalItemId`, `parentId`

#### Response (JSON)
- `{ status: 'accepted', job: { id: string } }`

### Secretary Endpoint (extern)
- `POST /api/pdf/process-mistral-ocr` (laut API overview)

### Callback Payload (erwartete Felder)
Minimal benötigt:
- `data.extracted_text` (Markdown/Text)
- `data.pages_archive_url` (ZIP: Pages als Bilder) **oder äquivalent**
- `data.images_archive_url` oder `data.mistral_ocr_images_url` (ZIP: extrahierte Bilder) **oder äquivalent**
- optional: `data.mistral_ocr_raw_url` / `data.mistral_ocr_raw_metadata`

Guardrail:
- Keine großen Base64 Blobs im Job-Dokument persistieren; URLs/Refs bevorzugen.

## Audio

### Next Entry Point (bestehend)
- `POST /api/secretary/process-audio`

#### Request (FormData)
- `file`: Audio Datei
- optional: `source_language` oder `sourceLanguage`
- `target_language` oder `targetLanguage` (default `de`)
- optional: `template` (wenn Secretary direkt templatebasiert transformieren soll)
- `useCache` wird in der Route aktuell fest auf `false` gesetzt

#### Response
- passt zu `SecretaryAudioResponse` (siehe `src/lib/secretary/client.ts`)
- insbesondere: `data.transcription.text`, `data.transcription.source_language`

### Secretary Endpoint (extern)
- `POST /api/audio/process`

## Video

### Next Entry Point (bestehend)
- `POST /api/secretary/process-video`

#### Request (FormData)
- `file`: Video Datei (oder URL – abhängig von geplanter Erweiterung)
- `targetLanguage` → mapped auf `target_language`
- `sourceLanguage` → mapped auf `source_language` (default `auto`)
- optional: `template`
- optional: `useCache`

#### Response
- passt zu `SecretaryVideoResponse` (siehe `src/lib/secretary/client.ts`)
- insbesondere: `data.transcription.text`

### Secretary Endpoint (extern)
- `POST /api/video/process`
- Für YouTube (extern): `POST /api/video/youtube` (noch als dedizierter Next Proxy zu ergänzen/standardisieren)

## Text / Markdown / TXT

### Next Entry Point (bestehend)
- `POST /api/secretary/process-text`

#### Request (FormData)
- `text`: string (Korpus oder File‑Text)
- `target_language` oder `targetLanguage`
- `source_language` optional
- `template` (Name) **oder** `template_content`
- Header `X-Library-Id`: zur Template-Auflösung aus MongoDB (falls kein Standard-Template)

#### Response
- Route gibt aktuell `data.data` zurück (nicht die gesamte Secretary Response).
- Erwartet: `structured_data` + `markdown` (je nach Secretary Template Output).

### Secretary Endpoint (extern)
- `POST /api/transformer/template`

## URL / Website Extract

### Next Entry Point (bestehend)
- `POST /api/secretary/import-from-url`

#### Ziel
- Website/Text extrahieren und in einem Folge-Schritt via `process-text` template-basiert transformieren.

## DOCX (Word) – Contract (noch fehlend in Next/Secretary)

Status: **noch nicht als Next Route dokumentiert**. Für V1 definieren wir den erwarteten Contract.

### Erwarteter Secretary Endpoint (extern, zu ergänzen)
- Vorschlag: `POST /api/document/docx` oder `POST /api/transformer/file` (falls Secretary bereits ein generisches File‑Transform hat)

### Erwarteter Output
- `data.extracted_text` als Markdown/Text mit Struktur (Überschriften, Listen, Tabellen als Markdown).
- optional: Asset‑Refs (eingebettete Bilder).

## XLSX (Excel) – Contract (noch fehlend in Next/Secretary)

Status: **noch nicht als Next Route dokumentiert**. Für V1 definieren wir den erwarteten Contract.

### Erwarteter Secretary Endpoint (extern, zu ergänzen)
- Vorschlag: `POST /api/document/xlsx` oder `POST /api/transformer/html-table` (falls als Zwischenschritt)

### Erwarteter Output
- `data.extracted_text` als Markdown mit Tabellen/Summary pro Sheet.
- optional: strukturierte Daten für Facetten.

## Image OCR (später)

### Next Entry Point (bestehend)
- `POST /api/secretary/process-image`

### Secretary Endpoint (extern)
- `POST /api/imageocr/process`


