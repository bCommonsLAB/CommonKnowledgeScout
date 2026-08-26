---
name: contracts-pipeline
description: Harte Invarianten der Verarbeitungs-Pipeline (External Jobs, Extract → Template → Ingest, Frontmatter-Serializer, Fehlerbehandlung). Verwende diesen Skill, BEVOR du an src/lib/external-jobs/**, src/app/api/external/jobs/**, src/app/api/pipeline/**, src/lib/transform/** oder src/lib/markdown/** etwas änderst — also sobald von External Jobs, Pipeline-Phasen, Transform-by-Template, Ingest, Job-Status oder Frontmatter-Schreiben die Rede ist.
---

# Contracts: Verarbeitungs-Pipeline

Diese Regeln sind **nicht verhandelbar**. Details je Thema in `docs/contracts/`.

## Die fünf Invarianten auf einen Blick

1. **Determinismus (ArtifactKey)**: Gleiche Quelle + gleiches Template ⇒ gleicher
   Artefakt-Schlüssel. `templateName` ist bei Transformationen Pflicht.
2. **Kein Fehler-Text als Artefakt**: Strukturelle Akzeptanz reicht NICHT. Liefert
   der Extraktor eine Fehlermeldung oder leeres Markdown, muss der Job
   **fehlschlagen** — nicht speichern.
3. **Ingest ist MongoDB-only**: Alle ingestierten Artefakte müssen in MongoDB
   vorhanden sein. Kein Fallback auf das Dateisystem.
4. **Ein Frontmatter-Serializer**: Frontmatter wird ausschließlich über den
   zentralen, idempotenten Serializer geschrieben. Kein hand-rolled Escaping.
5. **Keine stillen Fallbacks**: Immer explizit oder Fehlermeldung
   (`docs/contracts/no-silent-fallbacks.md`, gilt immer).

## Zuständige Contract-Dateien

| Datei | Thema |
|---|---|
| [contracts-story-pipeline.md](../../../docs/contracts/contracts-story-pipeline.md) | Gesamtkette Datei → Shadow-Twin → Ingestion → Story/Chat, Vector-Index |
| [external-jobs-integration-tests.md](../../../docs/contracts/external-jobs-integration-tests.md) | Phasen (Extract/Template/Ingest), Status-Modell, Integrationstests |
| [ingest-mongo-only.md](../../../docs/contracts/ingest-mongo-only.md) | Kein Filesystem-Fallback beim Ingest |
| [no-error-as-artifact.md](../../../docs/contracts/no-error-as-artifact.md) | Validierung vor dem Persistieren, Code-Review-Checkliste |
| [frontmatter-single-serializer.md](../../../docs/contracts/frontmatter-single-serializer.md) | Serializer-Pflicht, verbotene Anti-Pattern |

## Zusätzlich beachten

- **ADR 0001**: `event-job` und `external-jobs` sind getrennte Domänen — keine
  Vermischung in einer PR (`docs/adr/0001-event-job-vs-external-jobs.md`).
- **Frontmatter-Format** (AGENTS.md): flach, `snake_case`, keine Dot-Notation,
  keine verschachtelten YAML-Objekte.
