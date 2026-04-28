# Welle 3-I — App-Schale + Library-Loader

Refactor-Welle 3-I nach Methodik [`docs/refactor/playbook.md`](../playbook.md).

Erste UX-Welle nach Abschluss von Welle 0-2 (Backend). Reihenfolge der UX-Wellen wurde am 2026-04-28 vom User fachlich nach **UX-Welten** statt nach Datei-Groesse priorisiert (siehe [Plan-Sektion 5](../../../.cursor/plans/refactor-strategie-drift-eliminieren_06fd8014.plan.md)).

## Stand

| Datum | Datei | Status |
|---|---|---|
| 2026-04-28 | `README.md` | erstellt (IDE-Agent, Pre-Flight) |
| 2026-04-28 | `AGENT-BRIEF.md` | erstellt (IDE-Agent, Pre-Flight) |
| 2026-04-28 | `01-inventory.md` | erstellt (IDE-Agent, Pre-Flight) |
| TBD | `00-audit.md` | offen — Cloud-Agent Schritt 0 |
| TBD | `02-contracts.md` | offen — Cloud-Agent Schritt 2 |
| TBD | `03-tests.md` | offen — Cloud-Agent Schritt 3 |
| TBD | `04-altlast-pass.md` | offen — Cloud-Agent Schritt 4 |
| TBD | `05-user-test-plan.md` | offen — Cloud-Agent vor Abnahme |
| TBD | `06-acceptance.md` | offen — Cloud-Agent Schritt 7 |

## Scope (16 Files, **5.427 Zeilen verifiziert**)

Detail-Stats in [`01-inventory.md`](./01-inventory.md). Reproduzierbar via `node scripts/ui-welle-3i-stats.mjs`.

### App-Schale (11 Files, 1.836 Zeilen)

| Datei | Zeilen | Hooks | Risiko |
|---|---:|---:|---|
| `src/components/library/library.tsx` | 785 | 28 | mittel |
| `src/components/library/library-header.tsx` | 217 | 12 | klein |
| `src/components/library/library-switcher.tsx` | 187 | 10 | klein, **1 leerer Catch (Z. 109)** |
| `src/app/library/page.tsx` | 149 | 10 | klein, **1 leerer Catch (Z. 41)** |
| `src/app/library/create/page.tsx` | 207 | 5 | klein |
| `src/app/library/create/[typeId]/page.tsx` | 136 | 4 | klein |
| `src/app/library/gallery/perspective/page.tsx` | 94 | 5 | klein |
| `src/app/library/gallery/ensure-library.tsx` | 26 | 4 | klein |
| `src/app/library/gallery/page.tsx` | 17 | 0 | klein |
| `src/app/library/gallery/client.tsx` | 10 | 0 | klein |
| `src/app/library/gallery/page-client.tsx` | 8 | 0 | klein |

### Library-Loader (5 Files, 3.591 Zeilen)

| Datei | Zeilen | Hooks | Risiko |
|---|---:|---:|---|
| `src/components/library/file-list.tsx` | **2.217** | **89** | **hoch** — eigene Sub-Welle (Altlast-Pass 4b im AGENT-BRIEF), **1 leerer Catch (Z. 1391)** |
| `src/components/library/file-tree.tsx` | 619 | 30 | mittel |
| `src/components/library/create-library-dialog.tsx` | 435 | 13 | mittel |
| `src/components/library/upload-area.tsx` | 226 | 3 | klein |
| `src/components/library/upload-dialog.tsx` | 94 | 2 | klein |

## Strategie

Siehe [`AGENT-BRIEF.md`](./AGENT-BRIEF.md) — der Cloud-Agent arbeitet seriell die 8 Methodik-Schritte durch (R1, R2).

**Wichtig**: `file-list.tsx` mit 89 Hooks ist der einzige Hot-Spot, der einen eigenen Modul-Split braucht (analog `phase-template.ts` im Pilot oder `onedrive-provider.ts` in Welle 1). Der Brief unterteilt deshalb den Altlast-Pass in zwei Phasen.

## Kontext

- **Pilot-Vorlage**: [`../external-jobs/`](../external-jobs/)
- **Backend-Welle 1 als UX-Vorlage gibt es nicht** — diese Welle ist die **erste UI-Welle**, also gilt erhöhte Aufmerksamkeit fuer:
  - `'use client'`-Direktiven (sind UI-Code, dürfen Client sein, aber begründen falls Server-Komponente möglich)
  - Storage-Branches (Verstoss gegen [`storage-abstraction.mdc`](../../../.cursor/rules/storage-abstraction.mdc))
  - Pflicht: Sichtbare Smoke-Tests im Browser durch User vor Merge
- **Plan-Bezug**: Welle 3-I in [.cursor/plans/refactor-strategie-drift-eliminieren_06fd8014.plan.md](../../../.cursor/plans/refactor-strategie-drift-eliminieren_06fd8014.plan.md)
- **Backend-Drift-Befund**: Plan-Sektion 5 dokumentiert offene Drift in Wellen 0-2 (78 leere Catches in external-jobs etc.). Welle 3-I startet trotzdem (User-Entscheidung 2026-04-28).
