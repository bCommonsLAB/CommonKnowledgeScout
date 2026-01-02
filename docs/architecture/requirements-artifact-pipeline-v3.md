## Ziel

Diese Anforderungen definieren die **artefakt‑zentrierte Pipeline (Variante 3)** in einer Weise, die:

- Implementierung mit minimalem Code ermöglicht (Strangler, additive Erweiterung),
- Regression-Risiken kontrolliert,
- neue Quellen/Formate (PDF, Audio, Video, DOCX, XLSX, …) über **dieselbe Orchestrierung** integrierbar macht.

## Ausgangslage / Annahmen

- **Alle operativen Extractionen und Transformationen laufen im Secretary Service** (kein lokales Extrahieren im Next.js Backend).
- Orchestrierung erfolgt über bestehende **External Jobs** (Worker + Start + Callback + Phasenmodule).
- **Deployment ist Single‑Node**, daher funktioniert der in-memory SSE EventBus zuverlässig.
- Template‑Identität ist **Name-only** (kein Version/Hash im Artefakt-Namen).

## Functional Requirements (FR)

### FR‑1: Einheitliches Artefaktmodell

- Für jede Quelle entstehen Artefakte im Shadow‑Twin:
  - **Extract/Transcript**: `{base}.{lang}.md`
  - **Transformation**: `{base}.{template}.{lang}.md`
- Assets (z.B. PDF pages/images ZIP) werden als **URLs/Refs** verwaltet; keine großen Base64 Payloads als Standard.

### FR‑2: Template = Ziel (quelle-agnostisch)

- Template definiert Ziel‑Markdown + Frontmatter (Felder/Facetten/Struktur).
- Quelle liefert nur Extract (Text/Markdown + Assets), ohne „Analyse‑Speziallogik“ pro Format im UI.

### FR‑3: Eine Orchestrierung (Strangler)

- **Kein paralleler Orchestrator**.
- Neue Formate werden additiv über neue Jobtypen/Adapter integriert.

### FR‑4: Gates/Policies (Idempotenz & Wiederaufnahme)

- Gates entscheiden pro Phase, ob bereits vorhandene Artefakte eine Phase skippen.
- Policies können Gates überschreiben (z.B. `force`).
- Reruns erzeugen keine doppelten Artefakte und keine doppelten Ingest‑Chunks.

### FR‑5: Ingest (RAG)

- Ingest verwendet bevorzugt das **transformierte Markdown** (Transformation‑Artefakt).
- Ergebnis wird in MongoDB Vector Search gespeichert (Meta + Chunks) und ist über UI nutzbar.

### FR‑6: UX/Entry‑Points

- Archiv‑Pro:
  - Single‑File Verarbeitung aus File‑Liste
  - Batch/Verzeichnis Jobs erzeugen und überwachen
- Wizard‑User:
  - Quelle wählen → Template wählen → Start → Ergebnis anzeigen/öffnen
- Automation:
  - API Jobs triggern, Status & Result refs abrufen

### FR‑7: Live Status / Async Ergebnis

- UI erhält Live Updates über SSE (job_update).
- UI kann nach `completed` das Ergebnisartefakt öffnen/selektieren.

## Non‑Functional Requirements (NFR)

### NFR‑1: Observability (minimal, aber ausreichend)

- Jobs haben nachvollziehbare Steps/Trace/Fehlercodes.
- Watchdog verhindert „hängende“ Jobs.
- Logs sind zielgerichtet (nicht spammy).

### NFR‑2: Performance

- Worker kann mehrere Jobs parallel verarbeiten (konfigurierbare Concurrency).
- Große Assets werden als URLs/ZIP gehandhabt, nicht als Base64.

### NFR‑3: Sicherheit

- Keine Secrets/Tokens an Client ausgeben.
- Secretary Auth via Server‑Routes; interne Tokens maskieren.

### NFR‑4: Kompatibilität (Regression Safety)

- Bestehende Flows bleiben funktionsfähig.
- Neue V3 Pfade sind additiv und abschaltbar (Entry‑Point Feature Gate).

## Risiken / Guardrails

### Risiko: Template Name-only ist nicht reproduzierbar

- Guardrail: optionales Frontmatter `template_revision` (z.B. timestamp/hash) wird beim Run gespeichert.

### Risiko: SSE EventBus ist in-memory

- Single‑Node ok.
- Multi‑Node/Serverless benötigt später Redis/DB PubSub; dokumentiert als zukünftige Erweiterung.

### Risiko: Secretary Endpoints für DOCX/XLSX evtl. nicht vorhanden

- Guardrail: Schnittstellen zuerst dokumentieren; fehlende Endpoints als separaten Task planen (Secretary Erweiterung oder Adapter).

## V0 Acceptance (PDF Mistral OCR + Pages/Images)

Die V0 Definition of Done wird im Design/Plan dokumentiert; V0 ist die harte Abnahmebasis, bevor V1 (weitere Formate/Entry‑Points) folgt.


