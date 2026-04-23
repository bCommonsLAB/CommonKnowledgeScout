# ADR 0001 — event-job und external-jobs sind getrennte Domänen

- **Status**: Akzeptiert
- **Datum**: 2026-04-23
- **Kontext**: Refactor-Initiative gegen Strategie-Drift (Plan `refactor-strategie-drift-eliminieren_06fd8014`)
- **Entscheider**: Repo-Owner

## Kontext

Das Repository enthält zwei parallele Job-Implementationen, die historisch nacheinander entstanden sind:

### `event-job` (ältere Welt)
- 18 API-Routen unter [src/app/api/event-job/](../../src/app/api/event-job/)
- Repo: [src/lib/event-job-repository.ts](../../src/lib/event-job-repository.ts) (29 KB, UPPERCASE-Enum, snake_case-Fields)
- Typen: [src/types/event-job.ts](../../src/types/event-job.ts)
- **Eigene UI**: [src/app/event-monitor/](../../src/app/event-monitor/) (`page.tsx`, `batches/[batchId]/page.tsx`, `jobs/[jobId]/page.tsx`)
- **Eigene Komponenten**: 4 Files in [src/components/event-monitor/](../../src/components/event-monitor/) (`batch-list`, `batch-process-dialog`, `batch-archive-dialog`, `job-details-panel`)
- Aufrufer: [src/lib/session/session-processor.ts](../../src/lib/session/session-processor.ts), [src/app/api/sessions/generate-jobs/route.ts](../../src/app/api/sessions/generate-jobs/route.ts)
- Kontext: an die "Sessions"-Domäne gekoppelt

### `external-jobs` (neuere Welt)
- ~6 API-Routen unter [src/app/api/external/jobs/](../../src/app/api/external/jobs/)
- Lib: 35 Files in [src/lib/external-jobs/](../../src/lib/external-jobs/)
- Repo: [src/lib/external-jobs-repository.ts](../../src/lib/external-jobs-repository.ts) (28 KB, lowercase-Union, camelCase-Fields)
- **Keine eigene Monitor-UI** — wird von Aufrufern getrieben
- Aufrufer: Secretary (PDF/Audio/Video), Chat (`docs/publish`), Templates, Pipeline, Shadow-Twin
- Kontext: an die "Pipeline-/Secretary-/Chat"-Domäne gekoppelt

## Bewertete Optionen

### Option A — `event-job` durch `external-jobs` ersetzen (Strangler-Fig)
- **Pro**: Eine Job-Welt im Code, weniger Wartung
- **Contra**:
  - Komplette UI von `event-monitor` müsste migriert oder neu gebaut werden (~6 Files in `app/event-monitor`, ~4 Komponenten)
  - `session-processor` und `sessions/generate-jobs` müssten auf `external-jobs`-API portiert werden
  - Risiko: Funktionalität in `event-job` (Archive-Logik, Restart-All-Batches, Change-Language-All) fehlt eventuell in `external-jobs` und müsste nachimplementiert werden
  - Großes, riskantes Refactor mit hoher Sichtbarkeit (UI ändert sich)

### Option B — Beide Welten parallel halten, separat refaktorieren ✅ **gewählt**
- **Pro**:
  - Beide Welten werden nach gleicher Methode (Refactor-Playbook) sauber gemacht — Strategie-Drift wird trotzdem eliminiert
  - Kein UI-Refactor erzwungen; `event-monitor` bleibt funktional
  - Zwei klare Domänen-Grenzen: `event-job` für Sessions, `external-jobs` für Pipeline/Secretary
  - Kleinerer Pilot-Scope, schnellere Lernschleife
  - Keine Migration von Aufrufern (`session-processor` etc.) nötig
- **Contra**:
  - Zwei Repository-Implementierungen werden weiter parallel gewartet
  - Code-Konventionen unterscheiden sich (UPPERCASE-Enum vs lowercase-Union, snake_case vs camelCase) — nicht angeglichen
  - Eventuelle echte Code-Duplikate (z.B. ähnliche Worker-Logik) werden nicht konsolidiert

### Option C — Hybrid: gemeinsame Abstraktion über beiden Welten
- **Pro**: Konvention angleichen, Duplikate auflösen, beide Welten bleiben funktional
- **Contra**: Hoher Aufwand für unklaren Nutzen; Abstraktionen in komplexem Domänencode sind teuer und brüchig

## Entscheidung

**Option B**. Beide Welten bleiben getrennt und werden separat refaktoriert.

Begründung:
1. Sie repräsentieren **unterschiedliche Use-Cases** (Sessions vs Pipeline/Secretary), nicht nur unterschiedliche Implementierungen desselben Use-Cases
2. Die UI-Welt `event-monitor` ist nicht migrierbar ohne signifikanten UI-Aufwand — der nicht zur Refactor-Initiative passt
3. Die Refactor-Initiative will **Strategie-Drift eliminieren** (gleiche Methode, gleiche Standards) — das geht für beide Welten getrennt; Welt-Konsolidierung ist eine separate Initiative

## Konsequenzen

### Für den Refactor-Plan
- Pilot enthält **nur** `external-jobs`
- Cloud-Agent 5 (Strangler-Fig) entfällt → Pilot-Welle hat 5 Cloud-Agents (1 Tooling, 2 Audit+Inventur, 3 Tests+Contracts, 4 Altlast, 5 Dead-Code)
- Audit (Agent 2) prüft **keine** `event-job`-Tests/Code — gehört zur anderen Domäne
- `knip` läuft **nur** über `external-jobs/`, nicht über `event-job/`

### Für die Modul-Reihenfolge
- `event-job` + `event-monitor` UI sind **niedrige Prioritaet** (Welle 4 nach dem Pilot, siehe Plan-Sektion 5)
- Begründung: Domäne ist isoliert (eigene UI, eigene API-Routen, eigene Aufrufer-Kette `session-processor` → `sessions/generate-jobs` → `event-job`); sie blockiert keine andere Welle und beeinflusst den UX-Hauptfluss (Library, Archive, Creation-Wizard) nicht
- Die Welle für event-job läuft erst, **nachdem** Backend (storage/ingestion/shadow-twin), Verarbeitung (secretary/templates/chat) und UI-Hauptfluss (Archive, file-preview, creation-wizard) saniert sind

### Für das Code-Verständnis
- Pull-Requests, die `event-job` und `external-jobs` mischen, werden in Zukunft nicht akzeptiert
- Neue Job-Funktionalität entscheidet sich für **eine** Welt: ist sie an Sessions gekoppelt → `event-job`; ist sie an Secretary/Pipeline/Chat gekoppelt → `external-jobs`

### Offene Punkte (für später)
- Sollte irgendwann doch konsolidiert werden, ist eine **eigene Initiative** mit eigenem ADR nötig (Nachfolger zu diesem)
- Ggf. später: gemeinsame Type-Konvention (camelCase vs snake_case angleichen) — nicht jetzt

## Referenzen

- Plan: [.cursor/plans/refactor-strategie-drift-eliminieren_06fd8014.plan.md](../../.cursor/plans/refactor-strategie-drift-eliminieren_06fd8014.plan.md)
- AGENTS-Konventionen: [AGENTS.md](../../AGENTS.md)
- Bestehende Contracts external-jobs: [.cursor/rules/external-jobs-integration-tests.mdc](../../.cursor/rules/external-jobs-integration-tests.mdc), [.cursor/rules/contracts-story-pipeline.mdc](../../.cursor/rules/contracts-story-pipeline.mdc)
