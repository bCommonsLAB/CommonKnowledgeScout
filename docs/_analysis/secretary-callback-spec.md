---
title: Secretary Callback – Konsolidierte Spezifikation (Jobs-Endpoint)
status: final
updated: 2025-08-22
---

### Ziel

Sekretär-Service (externer Worker) sendet alle Zwischenstände und das Finale eines Jobs an eine einheitliche Callback-URL, die die `jobId` im Pfad trägt. Unser Server speichert Progress-Events in der Datenbank und finalisiert bei Abschluss (inkl. Shadow‑Twin‑Speicherung lokal/OneDrive).

### Callback-URL (von uns bereitgestellt)

- Beispiel: `https://<APP_URL>/api/external/jobs/{jobId}`
- Wir liefern diese URL dem Secretary beim Start des Jobs im Feld `callback_url` (multipart Form‑Data in der Startanfrage).
- Die `jobId` steht im Pfad; sie muss NICHT zusätzlich im Body gesendet werden.

### Authentifizierung

- Wir liefern dem Secretary zusätzlich ein `callback_token` (per‑Job‑Secret).
- Secretary MUSS das Token bei jedem Callback mitsenden:
  - Bevorzugt Header: `Authorization: Bearer <callback_token>`
  - Alternativ Header: `X-Callback-Token: <callback_token>`
- Keine Token in Query‑Parametern.

### HTTP-Anforderungen an den Callback

- Methode: `POST`
- Headers: `Content-Type: application/json`, `Accept: application/json`, plus Auth-Header (s.o.)
- Body: JSON (siehe Schemata)
- Optionaler Identifikator: `X-Worker: secretary` (nur zu Diagnosezwecken)

### Schemata der Callback-Payloads

- Progress‑Event (Zwischenstand):
```json
{
  "phase": "extract_text",
  "progress": 42,
  "message": "Seite 12/28 verarbeitet",
  "process": { "id": "sec-1234" }
}
```
  - Felder:
    - `phase` (string): z. B. "queued", "uploading", "extract_text", "build_markdown", "images", "finalizing".
    - `progress` (number 0–100)
    - `message` (string, optional, kurz)
    - `process.id` (string, optional, stabil für den Lauf)

- Finales Event (Abschluss):
```json
{
  "phase": "completed",
  "message": "Extraktion abgeschlossen",
  "data": {
    "extracted_text": "<vollständiger Markdown-/Textinhalt>",
    "images_archive_data": "UEsDB... (base64)",
    "images_archive_filename": "pdf_images.zip",
    "metadata": {
      "text_contents": [
        { "page": 1, "content": "..." }
      ]
    }
  }
}
```
  - Mindestens eines von `data.extracted_text` oder `data.images_archive_data` MUSS vorhanden sein.
  - `images_archive_data` ist Base64‑kodiertes ZIP (optional).
  - `metadata.text_contents` optional (ermöglicht seitenweise Markdown bei Bildern).

- Fehler‑Event:
```json
{
  "phase": "failed",
  "error": {
    "code": "OCR_TIMEOUT",
    "message": "Timeout beim OCR-Dienst",
    "details": { "service": "tesseract", "timeoutMs": 30000 }
  }
}
```

### Serverantworten (was der Secretary erwarten darf)

- 200 OK – JSON:
  - Progress: `{ "status": "ok", "kind": "progress", "jobId": "..." }`
  - Final: `{ "status": "ok", "kind": "final", "jobId": "..." }`
  - Failed: `{ "status": "ok", "kind": "failed", "jobId": "..." }`
- 400 Bad Request: Payload fehlerhaft → korrigieren und erneut senden.
- 401 Unauthorized: Token prüfen (nicht weiter senden, bis geklärt).
- 404 Not Found: Falsche `jobId`/URL → Senden einstellen, Konfiguration prüfen.
- 5xx: Serverfehler → mit Exponential Backoff erneut versuchen.

### WICHTIG: Was NICHT mehr gesendet wird

- Keine `correlation` mehr (wird nur serverseitig genutzt).
- `jobId` nicht im Body (steht im Pfad).

### Beispiel‑Requests

- Progress:
```http
POST /api/external/jobs/4e2f4a09-... HTTP/1.1
Content-Type: application/json
Accept: application/json
Authorization: Bearer <callback_token>

{
  "phase": "extract_text",
  "progress": 55,
  "message": "Seite 14/26 verarbeitet",
  "process": { "id": "sec-98765" }
}
```

- Final:
```http
POST /api/external/jobs/4e2f4a09-... HTTP/1.1
Content-Type: application/json
Accept: application/json
Authorization: Bearer <callback_token>

{
  "phase": "completed",
  "data": {
    "extracted_text": "...",
    "images_archive_data": "UEsDB...",
    "images_archive_filename": "pdf_images.zip",
    "metadata": {
      "text_contents": [{ "page": 1, "content": "..." }]
    }
  }
}
```

- Fehler:
```http
POST /api/external/jobs/4e2f4a09-... HTTP/1.1
Content-Type: application/json
Accept: application/json
Authorization: Bearer <callback_token>

{
  "phase": "failed",
  "error": {
    "code": "LLM_RATE_LIMIT",
    "message": "Rate limit exceeded",
    "details": { "retryAfterSec": 30 }
  }
}
```

### Polling (für unser Frontend/Monitoring)

- `GET /api/external/jobs/{jobId}` → liefert `status`, `logs`, `result`, `processId`.
- Optional: `?limit=N` begrenzt die Anzahl zurückgegebener Logs.

### Migrations‑Checkliste (für Secretary)

1) Callback-URL dynamisch übernehmen (inkl. `jobId` im Pfad), nicht hart kodieren.
2) Bei jedem Callback `Authorization: Bearer <callback_token>` mitsenden.
3) Progress‑Payload gemäß Schema senden (phase/progress/message/process.id).
4) Final‑Payload mit `data.extracted_text` und/oder `data.images_archive_data` senden.
5) Keine `correlation` und keine `jobId` im Body senden.
6) Auf 401/404 nicht weiter retryn; 5xx mit Backoff retryn.

### Hinweise zur Frequenz/Größe

- Progress‑Events: sinnvoll dosieren (z. B. max. 1–2/s), kurze Nachrichten.
- Final‑Payload: große Felder (Text, ZIP) sind erlaubt; Komprimierung bereits durch Base64‑ZIP abgedeckt.

### Kontaktpunkte

- Bei Auth‑Fehlern oder 404: Konfiguration (Token/URL) prüfen.
- Bei 5xx: Backoff einbauen und Logs bereitstellen (Request‑ID/Process‑ID).


