# Regel: Ingest nur aus MongoDB

**Status:** Verbindlich  
**Erstellt:** 2026-02-17

---

## Schwur / Prinzip

**Alle ingestierten Artefakte MÜSSEN in MongoDB vorhanden sein.**

Es gibt keinen Fallback auf Filesystem oder Provider. Wenn ein Artefakt für die Ingestion nicht in MongoDB gefunden wird, schlägt die Ingestion fehl.

## Begründung

- **Deterministische Programmierung**: Kein Zufall, keine Heuristiken, keine „versuche es halt aus dem Dateisystem“-Logik
- **Single Source of Truth**: MongoDB ist die autoritative Quelle für Shadow-Twin-Artefakte
- **Nachvollziehbarkeit**: Wenn etwas ingestiert wird, existiert es garantiert in der Shadow-Twin-Sammlung

## Konsequenzen

1. **Creation Wizard**: Muss vor dem Ingest-Trigger den Shadow-Twin via `shadow-twins/upsert` in MongoDB persistieren. Nur bei `primaryStore === 'mongo'`. Bei Filesystem-Libraries: Ingest über Job-Pipeline ist nicht möglich, solange kein Shadow-Twin in MongoDB existiert.

2. **loadShadowTwinMarkdown**: Kein Fallback auf Provider/Dateisystem. Priorität 1–3 (MongoDB, ShadowTwinService, resolveArtifact mit Mongo-Backend) – wenn nichts gefunden wird, Fehler.

3. **Job-Pipeline**: Ingest-Phase lädt ausschließlich aus MongoDB (via ShadowTwinService oder mongo-shadow-twin-id).

## Betroffener Code

- `src/lib/external-jobs/phase-shadow-twin-loader.ts` – `loadShadowTwinMarkdown` (forIngestOrPassthrough)
- `src/app/api/external/jobs/[jobId]/start/route.ts` – runIngestOnly-Branch
- `src/components/creation-wizard/creation-wizard.tsx` – Shadow-Twin-Upsert vor Ingest
