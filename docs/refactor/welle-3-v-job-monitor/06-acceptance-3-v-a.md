# Acceptance: Sub-Welle 3-V-a — Vorbereitung Job/Event-Monitor

Datum: 2026-05-03. Branch: cursor/refactor-welle-3-v-a-vorbereitung-affa.

---

## Erledigte Aufgaben

### Doku (Vorbereitungs-PR, Pflicht)

- [x] `00-audit.md` — Bestands-Audit (15 Catches, 1 any, 5 übergroße Dateien)
- [x] `01-inventory.md` — Datei-Inventur mit Hook-Zählen + Extraktions-Zielen
- [x] `04-altlast-pass.md` — Hot-Spot-Liste (H1-H15, A1, M1-M3)
- [x] `AGENT-BRIEF.md` — Sub-Wellen-Plan mit Start-Prompts für 3-V-b und 3-V-c

### Code: Altlast-Pass job-monitor-panel.tsx

- [x] **H1–H13**: 13 leere `catch {}` Blöcke in `job-monitor-panel.tsx` gefixed
  - API-Fetch-Fehler: `console.error` mit Kontext-Präfix
  - EventSource.close()-Fehler: `console.warn` (Browser-API-Fallback)
  - SSE-Event-Parsing-Fehler: `console.warn`
  - Clipboard-Copy: `console.warn` mit erklärendem Kommentar
  - Logs-Fetch: `console.error` + `setLoaded(true)` damit UI nicht hängt

### Tests

- [x] 18 Char-Tests für Helper-Funktionen aus `job-monitor-panel.tsx`
  (`formatRelative`, `formatClock`, `formatDuration`, `truncateMiddle`)

---

## Offene Punkte (für Sub-Wellen 3-V-b / 3-V-c)

| ID | Datei | Problem | Sub-Welle |
|---|---|---|---|
| H14 | batch-list.tsx | 1 leerer Catch | 3-V-c |
| H15 | batch-process-dialog.tsx | 1 leerer Catch | 3-V-c |
| A1 | batch-process-dialog.tsx | `as any` | 3-V-c |
| M1 | job-monitor-panel.tsx | Modul-Split (1.174z) | 3-V-b |
| M2 | batch-list.tsx | Modul-Split (1.350z) | 3-V-c |
| M3 | batch-archive-dialog.tsx | Modul-Split (738z) | 3-V-c |

---

## Verifikation

```bash
# Tests: 75 grün (57 bestehend + 18 neue Char-Tests)
npx vitest run tests/unit/job-monitor/ tests/unit/settings/

# Lint: keine neuen Errors in job-monitor-panel.tsx
pnpm lint

# Build (lokal, vor Merge)
bash scripts/welle-pre-merge-check.sh
```

---

## Smoke-Test-Plan (für User)

1. **App starten** → Job-Monitor-Panel in der App-Leiste sichtbar (keine JS-Errors)
2. **Job-Monitor öffnen** → Panel klappt auf, Jobs werden geladen (oder leer)
3. **Live-Updates ein** → SSE-Verbindung wird hergestellt (Network-Tab: EventStream)
4. **Live-Updates aus** → SSE-Verbindung wird geschlossen (kein Reconnect)
5. **Event-Monitor** (`/event-monitor`) → Batch-Liste lädt (keine JS-Errors)