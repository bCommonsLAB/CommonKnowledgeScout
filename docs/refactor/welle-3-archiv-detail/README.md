# Welle 3-II — Archiv-Detail

Refactor-Welle 3-II nach Methodik [`docs/refactor/playbook.md`](../playbook.md).
Zweite UX-Welle nach Welle 3-I (App-Schale + Library-Loader).

## Stand

| Datum | Datei | Status |
|---|---|---|
| 2026-04-29 | `README.md` | erstellt (Cloud-Agent, Pre-Flight + Lauf) |
| 2026-04-29 | `AGENT-BRIEF.md` | erstellt (Cloud-Agent, Pre-Flight) |
| 2026-04-29 | `01-inventory.md` | erstellt (Cloud-Agent) |
| 2026-04-29 | `00-audit.md` | erstellt (Cloud-Agent) |
| 2026-04-29 | `02-contracts.md` | erstellt (Cloud-Agent) |
| 2026-04-29 | `03-tests.md` | erstellt (Cloud-Agent) |
| 2026-04-29 | `04-altlast-pass.md` | erstellt (Cloud-Agent — Phase A: kleine Altlasten + Sub-Wellen-Backlog) |
| 2026-04-29 | `05-user-test-plan.md` | erstellt (Cloud-Agent) |
| 2026-04-29 | `06-acceptance.md` | erstellt (Cloud-Agent) |

## Scope (57 Files, **20.508 Zeilen verifiziert**)

Detail-Stats in [`01-inventory.md`](./01-inventory.md). Reproduzierbar via
`node scripts/ui-welle-3ii-stats.mjs`.

### Hot-Spots (Sub-Wellen-Kandidaten)

| Datei | Zeilen | Hooks | Sub-Welle |
|---|---:|---:|---|
| `src/components/library/file-preview.tsx` | **3.701** | **66** | **3-II-a** (eigene Mehr-Phasen-Welle, Preview-Switch) |
| `src/components/library/job-report-tab.tsx` | 2.284 | 30 | **3-II-c** (Tabs der Detail-View) |
| `src/components/library/markdown-preview.tsx` | 2.054 | 41 | **3-II-b** (Markdown-Preview-Split + 3 leere Catches) |
| `src/components/library/media-tab.tsx` | 1.147 | 13 | **3-II-c** (Tabs der Detail-View) |
| `src/components/library/session-detail.tsx` | 1.042 | 19 | **3-II-d** (`*-detail.tsx`-Familie + flow/) |
| `src/components/library/flow/pipeline-sheet.tsx` | 671 | 15 | **3-II-d** (flow/) |
| `src/components/library/cover-image-generator-dialog.tsx` | 458 | 3 | **3-II-d** (Helper) |

### Welle-Health-Kennzahlen (vor Refactor)

| Metrik | Wert | Bewertung |
|---|---:|---|
| Files | 57 | – |
| Gesamt-Zeilen | 20.508 | rot (4x Welle 3-I) |
| Files > 200 Zeilen | 26 | rot |
| Max-Zeilen | 3.701 (`file-preview.tsx`) | rot (Schwelle 200) |
| Hooks gesamt | 380 | – |
| Max-Hooks | 66 (`file-preview.tsx`) | rot (vergleichbar mit `creation-wizard.tsx`) |
| Leere Catches | **7** (in 5 Files) | rot (Schwelle 0) |
| Storage-Branches im UI | **1** (in `freshness-comparison-panel.tsx`) | rot (Schwelle 0, Verstoss gegen `storage-abstraction.mdc`) |
| `any` | 0 | gruen |
| `'use client'` | 54 von 57 | erwartet bei UI |
| Existierende Vitest-Tests fuer Welle 3-II | **0** | rot (0% Coverage) |

## Strategie

Wegen des Volumens (4x Welle 3-I) wird Welle 3-II in **4 Sub-Wellen** gespalten,
jede mit eigenem Cloud-Agent-Auftrag und eigener PR. Diese PR (3-II-Pre-Flight)
bringt:

- Pre-Flight-Doku komplett
- Schritt 0 (Audit) und Schritt 2 (Contracts) als globale Vorbereitung
- Schritt 3 Char-Tests fuer **kleinere Files** (testimonial-detail, image-preview,
  text-editor, transform-result-handler, story-status, use-story-status)
- Schritt 4a kleine Altlasten:
  - **alle 7 leeren Catches** eliminieren
  - **1 Storage-Branch** in `freshness-comparison-panel.tsx` an Helper migrieren
- Pre-Sub-Wellen-Backlog in `04-altlast-pass.md`

**Sub-Wellen kommen als getrennte Cloud-PRs** danach. Jede Sub-Welle bekommt im
AGENT-BRIEF eine eigene Sektion mit konkretem Cloud-Agent-Auftrag.

## Sub-Wellen-Plan

| Sub-Welle | Scope | Aufwand |
|---|---|---|
| **3-II-a** Preview-Switch | `file-preview.tsx` Modul-Split nach View-Typ (views/audio, views/image, views/video, views/markdown, views/pdf, views/office, views/presentation, views/website + extension-map + preview-reducer) | Mehr-Phasen-Welle |
| **3-II-b** Markdown-Preview | `markdown-preview.tsx` Modul-Split + 3 leere Catches dort fixen + `markdown-metadata.tsx`/`markdown-audio.tsx`/Accordions | mittel |
| **3-II-c** Detail-Tabs | `job-report-tab.tsx` + `media-tab.tsx` Modul-Split | mittel |
| **3-II-d** *-detail.tsx + flow/ + shared/ | `*-detail.tsx`-Familie + flow/* + shared/* (ohne perspective-*) | mittel |

## Kontext

- **Vorherige Welle**: [`../welle-3-schale-loader/`](../welle-3-schale-loader/) — Methodik-Vorbild
- **Pilot**: [`../external-jobs/`](../external-jobs/)
- **Plan-Bezug**: Welle 3-II in [.cursor/plans/refactor-strategie-drift-eliminieren_06fd8014.plan.md](../../../.cursor/plans/refactor-strategie-drift-eliminieren_06fd8014.plan.md) Sektion 5
- **Detail-View-Rule**: [`detail-view-type-checklist.mdc`](../../../.cursor/rules/detail-view-type-checklist.mdc) (relevant fuer 3-II-a)
