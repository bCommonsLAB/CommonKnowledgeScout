# Inventur: Welle 3-V — Job/Event-Monitor

Datum: 2026-05-03.

---

## Datei-Inventur

| Datei | Zeilen | Hooks | Leere Catches | any | Status |
|---|---:|---:|---:|---:|---|
| `shared/job-monitor-panel.tsx` | 1.174 | 36 | 13 | 0 | 🔴 Haupt-Kandidat Sub-Welle 3-V-b |
| `event-monitor/batch-list.tsx` | 1.350 | 29 | 1 | 0 | 🔴 Haupt-Kandidat Sub-Welle 3-V-c |
| `event-monitor/batch-archive-dialog.tsx` | 738 | 10 | 0 | 0 | 🟡 Sub-Welle 3-V-c |
| `event-monitor/batch-process-dialog.tsx` | 395 | 10 | 1 | 1 | 🟡 Sub-Welle 3-V-c |
| `event-monitor/job-details-panel.tsx` | 415 | 7 | 0 | 0 | 🟡 Sub-Welle 3-V-c |
| `event-monitor/event-filter-dropdown.tsx` | 132 | 8 | 0 | 0 | ✓ |
| `event-monitor/job-archive-test.tsx` | 115 | — | 0 | 0 | ✓ |

## Strukturelle Analyse

### job-monitor-panel.tsx (external-jobs-Domäne)

Sub-Komponenten (in-file, für Extraktion geeignet):
- `StatusBadge` (~30z) — Status-Badge-Mapping
- `JobTypeIcon` (~40z) — File-Typ-Icons
- `JobLogs` (~80z) — Logs-Rendering mit SSE-Fetch
- Haupt-Komponente `JobMonitorPanel` (~1.000z) — SSE + State + Handler + Render

Extraktions-Ziele für Sub-Welle 3-V-b:
1. `use-job-monitor.ts` — States + useEffects (SSE, Batch/Counter/Worker-Fetch) + Handler
2. `job-log-panel.tsx` — JobLogs Sub-Komponente auslagern
3. `job-list-item.tsx` — Job-List-Item Render (mit Buttons, Progress, HoverCard)

### batch-list.tsx (event-job-Domäne)

Haupt-Inhalte:
- State + useEffects (Jobs laden, SSE, Polling)
- Tabelle mit Job-Rows + Dialog-Trigger
- Dialog-Rendering inline

Extraktions-Ziele für Sub-Welle 3-V-c:
1. `use-batch-list.ts` — States + Handler
2. `batch-job-row.tsx` — Einzelne Tabellenzeile

### batch-archive-dialog.tsx (event-job-Domäne)

- 738z, kein offensichtlicher Hook-Extract nötig (10 Hooks aber gut integriert)
- Kandidat für Split: Archiv-Tabelle vs. Dialog-Frame

## Health-Ziele (DoD für Welle 3-V)

| Metrik | Ist | Ziel |
|---|---:|---:|
| Files > 200z | 5 | ≤ 2 (dokumentierte Ausnahmen) |
| Leere Catches | 15 | 0 |
| `any`-Count | 1 | 0 |
| Unit-Tests | 0 | ≥ 8 |
| `pnpm lint` Errors | 0 | 0 |
