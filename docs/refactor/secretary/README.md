# Welle 2.1 — Modul `secretary`

Refactor-Welle nach Methodik [`docs/refactor/playbook.md`](../playbook.md).

## Stand

| Datum | Datei | Status |
|---|---|---|
| 2026-04-27 | `01-inventory.md` | erstellt (IDE-Agent, Pre-Flight) |
| 2026-04-27 | `AGENT-BRIEF.md` | erstellt (IDE-Agent, Pre-Flight) |
| TBD | `00-audit.md` | offen — Welle-Agent Schritt 0 |
| TBD | `02-contracts.md` | offen — Welle-Agent Schritt 2 |
| TBD | `03-tests.md` | offen — Welle-Agent Schritt 3 |
| TBD | `04-altlast-pass.md` | offen — Welle-Agent Schritt 4 |
| TBD | `05-user-test-plan.md` | offen — Welle-Agent vor Abnahme |
| TBD | `06-acceptance.md` | offen — Welle-Agent Schritt 7 |

## Reihenfolge zum Lesen

1. [`README.md`](./README.md) — diese Datei (Wegweiser)
2. [`AGENT-BRIEF.md`](./AGENT-BRIEF.md) — Auftrag und Vorab-Entscheidungen
3. [`01-inventory.md`](./01-inventory.md) — Code-Stats, Aufrufer, Hot-Spots
4. Spaeter: `00-audit.md`, `02-contracts.md`, ...

## Strategie

Welle 2.1 ist die erste Welle der Verarbeitungs-Schicht (Plan §5 Welle 2).
`secretary` ist ein **externer Service-Wrapper** — duennster der drei
Welle-2-Module, deshalb als Einstieg gewaehlt.

Der Welle-Agent (Default: 1 Cloud-Agent, R2) arbeitet seriell durch die
8 Methodik-Schritte. Push auf `master` erst nach User-OK (R1, R3).

## Kontext

- **Vorbild-Wellen**:
  - [`../external-jobs/`](../external-jobs/) (Pilot)
  - [`../storage/`](../storage/), [`../shadow-twin/`](../shadow-twin/),
    [`../ingestion/`](../ingestion/) (Welle 1)
  - **Direktestes Vorbild**: `ingestion` — gleiche Modul-Groesse-Klasse
    (7 Files), gleicher Helper-Extract-Stil.
- **Architektur-Bezug**: `secretary` ist Adapter zu einem externen
  Service. Eingebettet in die Story-Pipeline via `external-jobs`.
- **Plan-Bezug**: Welle 2 in
  [.cursor/plans/refactor-strategie-drift-eliminieren_06fd8014.plan.md](../../../.cursor/plans/refactor-strategie-drift-eliminieren_06fd8014.plan.md)
