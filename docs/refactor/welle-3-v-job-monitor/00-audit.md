# Audit: Welle 3-V — Job/Event-Monitor

Datum: 2026-05-03. Erstellt im Rahmen der Vorbereitungs-PR (Sub-Welle 3-V-a).

---

## Scope-Definition (aus Plan + ADR 0001)

Welle 3-V betrifft die **Monitor-UI** für zwei getrennte Job-Domänen:

| Domäne | Scope | ADR-Constraint |
|---|---|---|
| `external-jobs` | `src/components/shared/job-monitor-panel.tsx` | Nur `external-jobs`-API, keine `event-job`-API |
| `event-job` | `src/components/event-monitor/` | Nur `event-job`-API, keine `external-jobs`-API |

**ADR 0001**: Beide Domänen werden **separat** refaktoriert. Kein Mixing in einer PR.

---

## Bestands-Audit

### Leere Catches (15 insgesamt)

| Datei | Anzahl | Kontext |
|---|---:|---|
| `shared/job-monitor-panel.tsx` | 13 | 5× API-Fetch, 5× EventSource.close(), 2× SSE-Parsing, 1× Clipboard |
| `event-monitor/batch-list.tsx` | 1 | API-Fetch |
| `event-monitor/batch-process-dialog.tsx` | 1 | API-Fetch |

**Kategorisierung job-monitor-panel.tsx:**
- **EventSource.close()-Aufrufe (5×)**: Zeilen 470, 477, 623, 698 — Browser-API-Fallback, `console.warn` sinnvoll
- **API-Fetch-Fehler (5×)**: Zeilen 392, 415, 433, 717, 911 — `console.error` erforderlich
- **SSE-Event-Parsing (2×)**: Zeilen 567, 615 — `console.warn` für Debug
- **Clipboard-Copy (1×)**: Zeile 1031 — Browser-API, akzeptabler stiller Fallback mit Kommentar
- **Logs-Fetch (1×)**: Zeile 1134 — hat `// ignore`-Kommentar aber kein Logging

### `any`-Vorkommen (1)

| Datei | Zeile | Kontext |
|---|---:|---|
| `event-monitor/batch-process-dialog.tsx` | 113 | `entry as any` — Performance-Observer-Entry-Typ |

### Dateigröße (Health-Check)

| Datei | Zeilen | Hooks | Status |
|---|---:|---:|---|
| `shared/job-monitor-panel.tsx` | 1.174 | 36 | 🔴 >200z, viele Hooks |
| `event-monitor/batch-list.tsx` | 1.350 | 29 | 🔴 >200z, viele Hooks |
| `event-monitor/batch-archive-dialog.tsx` | 738 | 10 | 🔴 >200z |
| `event-monitor/batch-process-dialog.tsx` | 395 | 10 | 🔴 >200z |
| `event-monitor/job-details-panel.tsx` | 415 | 7 | 🔴 >200z |
| `event-monitor/event-filter-dropdown.tsx` | 132 | 8 | ✓ |
| `event-monitor/job-archive-test.tsx` | 115 | — | ✓ |

### Unit-Tests

Keine vorhandenen Unit-Tests für event-monitor oder job-monitor-panel.

### Konsumenten

| Datei | Konsumiert |
|---|---|
| `src/components/layouts/app-layout.tsx` | `JobMonitorPanel` |
| `src/app/event-monitor/page.tsx` | `BatchList` |

---

## Architektur-Hinweis

`job-monitor-panel.tsx` und `event-monitor/` nutzen **unterschiedliche APIs**:
- `job-monitor-panel.tsx` → `/api/external/jobs/...` (external-jobs-Domäne)
- `batch-list.tsx` + Event-Monitor → `/api/event-job/...` (event-job-Domäne)

Diese Trennung **muss** beim Refactor erhalten bleiben (ADR 0001).
