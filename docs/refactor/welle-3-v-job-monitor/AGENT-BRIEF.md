# Cloud-Agent-Brief: Welle 3-V — Job/Event-Monitor

Stand: 2026-05-03. Erstellt in Sub-Welle 3-V-a (Vorbereitungs-PR).

---

## Kontext (lies das ZUERST)

1. **ADR 0001** (PFLICHT): [`docs/adr/0001-event-job-vs-external-jobs.md`](../../adr/0001-event-job-vs-external-jobs.md)
   — `event-job` und `external-jobs` sind GETRENNTE Domänen. KEINE Vermischung!
2. **Methodik**: [`docs/refactor/playbook.md`](../playbook.md)
3. **Plan-Bezug**: `.cursor/plans/refactor-strategie-drift-eliminieren_06fd8014.plan.md` Sektion "Welle 3-V"
4. **Vorbild-Welle**: Welle 3-IV-Settings (Hook-Extraktion, Section-Split)
5. **Audit + Inventur**: `00-audit.md`, `01-inventory.md`
6. **Hot-Spots**: `04-altlast-pass.md` — 15 Catches H1-H15, 1 any A1, 3 Modul-Split-Pläne M1-M3

---

## Domänen-Trennung (KRITISCH)

| Komponente | Domäne | API-Pfad |
|---|---|---|
| `shared/job-monitor-panel.tsx` | **external-jobs** | `/api/external/jobs/...` |
| `event-monitor/batch-list.tsx` | **event-job** | `/api/event-job/...` |
| `event-monitor/batch-archive-dialog.tsx` | **event-job** | `/api/event-job/...` |
| `event-monitor/batch-process-dialog.tsx` | **event-job** | `/api/event-job/...` |
| `event-monitor/job-details-panel.tsx` | **event-job** | `/api/event-job/...` |

**VERBOTEN**: Einen PR mit Änderungen in BEIDEN Domänen.

---

## Welle-Struktur

| Sub-Welle | Branch | Inhalt | Status |
|---|---|---|---|
| **3-V-a** | `cursor/refactor-welle-3-v-a-vorbereitung-affa` | Audit + Inventur + AGENT-BRIEF + Catches H1-H13 + Char-Tests | **DIESE PR** |
| **3-V-b** | `cursor/refactor-welle-3-v-b-job-monitor-...` | `job-monitor-panel.tsx` Modul-Split (external-jobs) | Nächster Lauf |
| **3-V-c** | `cursor/refactor-welle-3-v-c-event-monitor-...` | `batch-list.tsx` + `batch-archive-dialog.tsx` Splits (event-job) | Nach 3-V-b |

---

## Sub-Welle 3-V-a — Vorbereitung (DIESE PR)

### Erledigte Aufgaben

- [x] `00-audit.md` — Bestands-Audit
- [x] `01-inventory.md` — Datei-Inventur mit Health-Zahlen
- [x] `04-altlast-pass.md` — Hot-Spot-Liste (15 Catches, 1 any, 3 Modul-Split-Pläne)
- [x] `AGENT-BRIEF.md` — dieser Brief
- [x] Char-Tests für `job-monitor-panel.tsx` Helper-Funktionen
- [x] H1–H13: 13 leere Catches in `job-monitor-panel.tsx` gefixed

### Offene Punkte für Sub-Wellen 3-V-b / 3-V-c

- H14 (batch-list.tsx) + H15 (batch-process-dialog.tsx) — in Sub-Welle 3-V-c
- A1 (batch-process-dialog.tsx, `any`) — in Sub-Welle 3-V-c
- Modul-Splits M1-M3 — in Sub-Wellen 3-V-b und 3-V-c

---

## Sub-Welle 3-V-b — job-monitor-panel.tsx Split (Start-Prompt)

### Aufgabe

`job-monitor-panel.tsx` (1.174z, external-jobs-Domäne) aufteilen in:
1. `use-job-monitor.ts` — SSE + States + useEffects + Handler
2. `job-log-panel.tsx` — JobLogs-Komponente
3. `job-list-item.tsx` — Job-Listenelement
4. `job-monitor-panel.tsx` (verkürzt ~300z) — Render + Orchestrierung

### Commit-Reihenfolge

1. Char-Tests für `use-job-monitor`-Interface
2. `job-log-panel.tsx` extrahieren
3. `job-list-item.tsx` extrahieren
4. `use-job-monitor.ts` Hook extrahieren (groß → Commits aufteilen)
5. `job-monitor-panel.tsx` auf Hook + Sub-Komponenten umstellen
6. Cleanup + Acceptance-Doc

```
Lies VOR dem Start (in dieser Reihenfolge):
1. AGENTS.md
2. .cursor/rules/cloud-agent-cost-strategy.mdc
3. .cursor/rules/refactor-batch-strategy.mdc
4. docs/adr/0001-event-job-vs-external-jobs.md (ADR PFLICHT!)
5. docs/refactor/welle-3-v-job-monitor/AGENT-BRIEF.md (Sektion "3-V-b")
6. docs/refactor/welle-3-v-job-monitor/04-altlast-pass.md (M1-Plan)

Aufgabe: Sub-Welle 3-V-b — job-monitor-panel.tsx (1.174z) Modul-Split.
NUR external-jobs-Domäne. KEINE event-job-Änderungen.

Branch: cursor/refactor-welle-3-v-b-job-monitor-<suffix>

Vor dem Start: pnpm install --frozen-lockfile
Vor jedem Push: npx vitest run && pnpm lint
Build/Test-Verifikation: User macht das LOKAL via
bash scripts/welle-pre-merge-check.sh

PR als Draft. Smoke-Test-Plan im PR-Body. Antworte auf Deutsch.
```

---

## Sub-Welle 3-V-c — event-monitor Split (Start-Prompt)

### Aufgabe

`batch-list.tsx` (1.350z) + `batch-archive-dialog.tsx` (738z) + H14/H15/A1 fixen.
NUR event-job-Domäne. KEINE external-jobs-Änderungen.

```
Lies VOR dem Start (in dieser Reihenfolge):
1. AGENTS.md
2. .cursor/rules/cloud-agent-cost-strategy.mdc
3. .cursor/rules/refactor-batch-strategy.mdc
4. docs/adr/0001-event-job-vs-external-jobs.md (ADR PFLICHT!)
5. docs/refactor/welle-3-v-job-monitor/AGENT-BRIEF.md (Sektion "3-V-c")
6. docs/refactor/welle-3-v-job-monitor/04-altlast-pass.md (H14, H15, A1, M2, M3)

Aufgabe: Sub-Welle 3-V-c — batch-list.tsx + batch-archive-dialog.tsx Split
+ H14/H15 Catches + A1 any-Fix.
NUR event-job-Domäne. KEINE external-jobs-Änderungen.

Branch: cursor/refactor-welle-3-v-c-event-monitor-<suffix>

Vor dem Start: pnpm install --frozen-lockfile
Vor jedem Push: npx vitest run && pnpm lint
Build/Test-Verifikation: User lokal via bash scripts/welle-pre-merge-check.sh

PR als Draft. Antworte auf Deutsch.
```

---

## Kosten-Schätzung

| Szenario | Geschätzte Kosten pro Sub-Welle |
|---|---|
| Mit Empfehlungen (Sonnet, neuer Agent, lokal bauen) | ~5–8 USD |
| Status-quo (Opus + Cloud-Build + Resume) | ~25–40 USD |
| Spar-Faktor | ~4–5x |

Empfehlung: **claude-sonnet, thinking-medium** für 3-V-b und 3-V-c
(Modul-Splits mit klarem Vorbild aus Welle 3-IV).
