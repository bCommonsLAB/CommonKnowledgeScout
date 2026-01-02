---
title: Wizard-Umstellung auf External Jobs (Artefakt-Pipeline v3)
date: 2026-01-02
status: draft
---

## Kontext / Problem

Aktuell existieren im Wizard mehrere **synchrone** „Mini-Pipelines“ parallel zur artefakt-zentrierten External‑Jobs‑Pipeline:

- Textauswertung über `POST /api/secretary/process-text` (Template-Transformation synchron)
- Webseitenimport über `POST /api/secretary/import-from-url` (extrahiert Text + Structured Data synchron)
- Audio-Transkription über `POST /api/secretary/process-audio` (Transkription synchron)

Diese Pfade umgehen die External‑Jobs‑Orchestrierung (Gates/Policies/Artefakte/Shadow‑Twin, SSE‑Events, idempotente Wiederholung).
Damit steigt Redundanz und Risiko (unterschiedliche Fehlerbehandlung, unterschiedliche Ergebnis-Pfade, unterschiedliche Limits/Timeouts).

Wichtig: Es gibt **zwei Template-Systeme**:

1) **Secretary-Template** (z.B. `template-samples/pdfanalyse.md` als Repo-Snapshot; in der App ist das Template als MongoDB `TemplateDocument` unter dem Namen `pdfanalyse` gespeichert): definiert extraktive Metadaten + Kapitel + Ausgabeformat für die Ingestion-Pipeline.
2) **Wizard-Template (TemplateDocument)** in MongoDB: definiert den Wizard-UI-Flow (Steps/Felder/Preview/Save).

Für die Wizard-Umstellung auf Jobs ist (1) optional/kontextabhängig; das UI-Template (2) bleibt weiter notwendig.

## Zielbild

Der Wizard soll „nur noch orchestrieren“:

- Quellen aufnehmen (Text/URL/Datei/Audio …)
- Für langsame Quellen (insb. Audio/Video/PDF) **Jobs starten**
- Live-Status über SSE anzeigen
- Ergebnisse als Artefakte/Dateien übernehmen (mindestens Transcript als Quelle)
- Danach ggf. weiterhin Wizard-spezifisch aus dem kombinierten Korpus Felder generieren (kann zunächst synchron bleiben)

## Varianten (3)

### Variante A1 (empfohlen): Hybrid – Heavy Sources via Jobs, Feld-Extraktion bleibt synchron

- Audio/Video/PDF: Upload in Storage → Job enqueue → Ergebnis (Transcript/Markdown) als Quelle hinzufügen
- Finales „Felder füllen“ (Wizard spezifisch) bleibt vorerst `process-text` (schnell, kleine Payload)

**Vorteile**
- Minimaler Code, geringes Risiko
- Nutzen der External‑Jobs‑Pipeline dort, wo Timeouts/Größe kritisch sind
- Wizard-UX verbessert (SSE Fortschritt, robustes Retry über Jobs)

**Nachteile**
- Es bleibt ein synchroner Pfad für die „Feld-Extraktion“ bestehen

### Variante A2: Full Jobs – Wizard-Extraktion und Feldgenerierung komplett asynchron

- Auch die `process-text` Auswertung wird als Job modelliert (neuer Job-Typ z.B. `text`/`wizard`).

**Vorteile**
- Maximale Vereinheitlichung

**Nachteile**
- Höheres Implementationsrisiko (Job-Payload/Text-Persistenz, zusätzliche Artefakte, API-Design)

### Variante A3: Keine Pipeline-Umstellung – nur UI/SSE drum herum

- Wizard bleibt synchron, man verbessert nur Progress/Retry.

**Vorteile**
- Schnell, aber…

**Nachteile**
- Kernproblem (Parallelität/Redundanz) bleibt bestehen

## Entscheidung (v0)

Wir implementieren zuerst **Variante A1** (Hybrid), konkret:

- **Audio im Wizard** wird auf External Jobs umgestellt:
  - Audio-Datei wird im Storage abgelegt (eigener Wizard-Quellen-Ordner)
  - Job via `/api/secretary/process-audio/job` enqueued (Phasen: extract=do, metadata=ignore, ingest=ignore)
  - Wizard wartet via SSE auf `completed` und lädt dann `result.savedItemId` (Transcript) als neue Quelle.

Danach kann schrittweise Video/PDF analog folgen.


