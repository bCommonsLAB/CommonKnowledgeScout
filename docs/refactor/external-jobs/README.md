# Refactor-Doku: Modul `external-jobs` (Pilot)

Dieses Verzeichnis enthaelt die Refactor-Dokumentation fuer das Pilot-Modul der Initiative gegen Strategie-Drift.

Quelle: [.cursor/plans/refactor-strategie-drift-eliminieren_06fd8014.plan.md](../../../.cursor/plans/refactor-strategie-drift-eliminieren_06fd8014.plan.md)
Methodik: [docs/refactor/playbook.md](../playbook.md)
Architektur-Grenze zu `event-job`: [docs/adr/0001-event-job-vs-external-jobs.md](../../adr/0001-event-job-vs-external-jobs.md)

## Lese-Reihenfolge

1. [00-audit.md](00-audit.md) — Bestands-Audit (Rules, Tests, Docs); Aktion pro Eintrag (`keep`/`update`/`migrate`/`delete`/`archive`)
2. [01-inventory.md](01-inventory.md) — Code-Health pro File, Hot-Spots fuer Folge-Schritte
3. (folgt) `02-contracts-update.md` — was an Contracts erweitert wurde (Plan-Schritt 2, von Cloud-Agent 3)
4. (folgt) `03-characterization-tests.md` — welche Char-Tests geschrieben wurden (Plan-Schritt 3, von Cloud-Agent 3)
5. (folgt) `04-altlast-pass.md` — Liste der Altlast-Fixes (Plan-Schritt 4, von Cloud-Agent 4)
6. (folgt) `05-deadcode.md` — knip-Findings und Loeschungen (Plan-Schritt 6, von Cloud-Agent 5)
7. (folgt) `06-acceptance.md` — Pilot-Abnahme-Bericht
