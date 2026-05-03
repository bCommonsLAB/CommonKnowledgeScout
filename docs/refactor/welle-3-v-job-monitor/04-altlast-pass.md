# Altlast-Pass: Welle 3-V — Job/Event-Monitor

Datum: 2026-05-03.

---

## Leere Catches — Prioritätsliste

### H1–H13: job-monitor-panel.tsx (13 Catches)

| ID | Zeile | Kategorie | Fix |
|---|---:|---|---|
| H1 | 392 | API-Fetch (loadBatches) | `console.error('[JobMonitorPanel] Batch-Namen laden:', err)` |
| H2 | 415 | API-Fetch (loadCounts) | `console.error('[JobMonitorPanel] Counter laden:', err)` |
| H3 | 433 | API-Fetch (loadWorker) | `console.error('[JobMonitorPanel] Worker-Status laden:', err)` |
| H4 | 470 | EventSource.close() | `console.warn('[JobMonitorPanel] EventSource schließen fehlgeschlagen:', err)` |
| H5 | 477 | EventSource.close() | `console.warn('[JobMonitorPanel] EventSource schließen fehlgeschlagen:', err)` |
| H6 | 567 | SSE-Event-Parsing | `console.warn('[JobMonitorPanel] library_refresh-Event fehlgeschlagen:', err)` |
| H7 | 615 | SSE-Event-Parsing | `console.warn('[JobMonitorPanel] job_update-Parsing fehlgeschlagen:', err)` |
| H8 | 623 | EventSource.close() | `console.warn('[JobMonitorPanel] EventSource schließen fehlgeschlagen:', err)` |
| H9 | 698 | EventSource.close() | `console.warn('[JobMonitorPanel] EventSource schließen fehlgeschlagen:', err)` |
| H10 | 717 | API-Fetch (retryJob) | `console.error('[JobMonitorPanel] Job neu starten fehlgeschlagen:', err)` |
| H11 | 911 | API-Fetch (start-batch) | `console.error('[JobMonitorPanel] Batch-Start fehlgeschlagen:', err)` |
| H12 | 1031 | Clipboard-Copy | `console.warn('[JobMonitorPanel] Clipboard-Copy fehlgeschlagen:', err)` |
| H13 | 1134 | Logs-Fetch | `console.error('[JobMonitorPanel] Logs laden fehlgeschlagen:', err)` |

### H14: batch-list.tsx (1 Catch)

| ID | Zeile | Kategorie | Fix |
|---|---:|---|---|
| H14 | 1231 | API-Fetch | `console.error('[BatchList] API-Fetch fehlgeschlagen:', err)` |

### H15: batch-process-dialog.tsx (1 Catch)

| ID | Zeile | Kategorie | Fix |
|---|---:|---|---|
| H15 | 207 | API-Fetch | `console.error('[BatchProcessDialog] Verarbeitung fehlgeschlagen:', err)` |

---

## `any`-Vorkommen

### A1: batch-process-dialog.tsx Zeile 113

```typescript
// Aktuell (VERBOTEN)
const e = entry as any;

// Fix: PerformanceEntry hat bekannte Properties, Type-Cast auf spezifischen Typ
interface PerformanceResourceEntry extends PerformanceEntry {
  initiatorType?: string;
}
const e = entry as PerformanceResourceEntry;
```

---

## Modul-Split-Pläne

### M1: job-monitor-panel.tsx (1.174z → ~300z Render + Hook)

1. `use-job-monitor.ts` extrahieren (~500z): SSE-Verbindung, alle useEffects, Handler
2. `job-log-panel.tsx` extrahieren (~100z): `JobLogs`-Komponente
3. `job-list-item.tsx` extrahieren (~200z): Job-Listenelement mit Buttons
4. Haupt-Panel nutzt Hook + Sub-Komponenten

### M2: batch-list.tsx (1.350z → ~400z Render + Hook)

1. `use-batch-list.ts` extrahieren (~500z): SSE, States, Handler
2. `batch-job-row.tsx` extrahieren (~150z): Tabellen-Zeile
3. Haupt-Liste nutzt Hook + Row

### M3: batch-archive-dialog.tsx (738z → ggf. ~400z)

- Kandidat für Tab-Aufteilung (Archiv-Tabelle vs. Aktionen)
- Priorität niedriger als M1/M2
