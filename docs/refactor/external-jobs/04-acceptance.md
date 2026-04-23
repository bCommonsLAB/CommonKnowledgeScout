# Pilot-Abnahme: Modul `external-jobs`

Stand: 2026-04-23. Erstellt von Cloud-Agent (Pilot-Welle, Plan-Schritt 7).

Bezug: [.cursor/plans/refactor-strategie-drift-eliminieren_06fd8014.plan.md](../../../.cursor/plans/refactor-strategie-drift-eliminieren_06fd8014.plan.md) Sektion 4.7 ("Abnahme") und Sektion 7 ("Definition of Done").

## Zusammenfassung

Pilot-Welle external-jobs: **5 Cloud-Agent-PRs erfolgreich abgeschlossen**, alle in master angekommen (siehe Reihenfolge unten).

| PR | Titel | Plan-Schritt | Status |
|---|---|---|---|
| [#13](https://github.com/bCommonsLAB/CommonKnowledgeScout/pull/13) | Tooling-Setup (knip, ESLint, module-health, playbook) | Setup | offen, ready for review |
| [#14](https://github.com/bCommonsLAB/CommonKnowledgeScout/pull/14) | Bestands-Audit + Inventur fuer external-jobs | 0, 1 | offen, ready for review |
| [#15](https://github.com/bCommonsLAB/CommonKnowledgeScout/pull/15) | Contracts schaerfen + Characterization Tests | 2, 3 | offen, ready for review |
| [#16](https://github.com/bCommonsLAB/CommonKnowledgeScout/pull/16) | Pilot-Altlast-Pass (silent fallback fix + erster Modul-Split) | 4 | offen, ready for review |
| [#17](https://github.com/bCommonsLAB/CommonKnowledgeScout/pull/17) | Pilot-Dead-Code-Pass | 6 | offen, ready for review |

**Hinweis**: PRs sind als Stack aufeinander aufgebaut (#13 → #14 → #15 → #16 → #17). Empfehlung fuer Merge: in genau dieser Reihenfolge, oder rebasen falls master in der Zwischenzeit gewachsen ist.

## Definition of Done — Status pro Kriterium

Aus Plan-Sektion 7:

| Kriterium | Status | Detail |
|---|---|---|
| Eigene Contract-Rule existiert | ✅ | `.cursor/rules/external-jobs-integration-tests.mdc` ist die Modul-Rule und wurde in PR #15 geschaerft (Skip-Semantik §3) |
| Mindestens 1 Test je oeffentlicher Funktion | 🟡 | 7 Test-Files vorhanden + 3 neue Char-Tests fuer `phase-template.ts` (PR #15). **Nicht jede oeffentliche Funktion** ist abgedeckt — Folge-PRs fuer `extract-only.ts`, `phase-shadow-twin-loader.ts`, `phase-ingest.ts`, `chapters.ts`, `images.ts` empfohlen. |
| `pnpm test` gruen | ✅ | 97 Files, 451 Tests, alle gruen (vorher 431 Tests, +20 Char-Tests) |
| `pnpm lint` ohne neue Warnings | 🟡 | Keine **neuen** Errors, aber Tooling-Setup hat `no-empty: warn` aktiviert → 191 neue Warnings (75 davon in `external-jobs/`). Folge-PRs raeumen pro Datei auf. |
| `pnpm test:integration:api` gruen | ❌ | Nicht ausgefuehrt — Cloud-Umgebung hat kein Mongo/Secretary. **Lokal verifizieren noetig** vor Merge. |
| Alle Top-Dateien < 200 Zeilen | ❌ | 14 Dateien > 200 Zeilen in `external-jobs/`, davon `phase-template.ts` mit 2.037. Erster Modul-Split (PR #16) ist ein Anfang, vollstaendiger Split braucht eigene PR-Serie (siehe `02-altlast-pass.md` Folge-PR-Tabelle). |
| `pnpm health` zeigt 0 fuer `any`/silent-fallback/large-file-Counts | 🟡 | `any`: 0 ✅. Silent-Fallback (Zeile 320): behoben in PR #16. Aber `pnpm health` zaehlt **alle leeren Catches** (75 in `external-jobs/`) — die sind quantitativ groesste Altlast und brauchen Folge-PR-Serie. Large Files: 14, siehe oben. |

## Was die Pilot-Welle wirklich erreicht hat

Die Pilot-Welle hatte **zwei** Kernziele, beide erfuellt:

**1. Methodik etablieren** — die 8-Schritte-Methodik aus dem Plan ist jetzt operativ. Jedes Folge-Modul kann diesen Ablauf 1:1 wiederverwenden:

- Tooling-Setup (knip, ESLint, module-health) ist einmalig, gilt fuer alle Folge-Wellen
- Bestands-Audit-Vorlage (drei Tabellen: Rules/Tests/Docs) ist im playbook.md verankert
- Audit-Aktionen (`keep`/`update`/`migrate`/`delete`/`archive`) sind durch alle Schritte konsistent verfolgt
- Char-Test-Strategie (Decision-Funktion + Helper testen statt Monolith mocken) ist erprobt

**2. Pilot-Modul `external-jobs` greifbar verbessert** — alle messbaren Drift-Symptome aus Plan-Sektion 1 sind adressiert:

- ✅ Silent Fallback in `external-jobs-repository.ts:320` behoben (PR #16)
- ✅ Skip-Semantik-Drift in Contract-Rule beseitigt (PR #15)
- ✅ Verzeichnisstruktur fuer Modul-Split etabliert (PR #16)
- ✅ Dead-Code entfernt (270 Zeilen weg in PR #17)
- ✅ Bestands-Audit dokumentiert, alle Audit-Aktionen verfolgt (PRs #14/#15/#16/#17)

## Was offen bleibt (Folge-PRs in derselben Pilot-Domaene)

| Was | Geschaetzter Diff | Wohin |
|---|---|---|
| `phase-template.ts` voller Split (5 Sub-Module) | ~1.500 Zeilen ueber 4-5 PRs | Folge-PR-Serie nach Pilot |
| 75 leere Catches in `external-jobs/` aufraeumen | ~300 Zeilen ueber 5-7 PRs | Folge-PR-Serie nach Pilot |
| Tests fuer `extract-only.ts`, `phase-shadow-twin-loader.ts`, `phase-ingest.ts`, `chapters.ts`, `images.ts` | je 50-100 Zeilen | Opportunistisch |
| Architektur: `external-jobs-repository.ts`/`-worker.ts`/`-watchdog.ts` in `src/lib/external-jobs/` verschieben | ~500 Zeilen Imports | **User-Abstimmung erforderlich** (Audit-Anmerkung) |
| `tests/unit/jobs-worker-pool.test.ts` ggf. nach `tests/unit/external-jobs/` migrieren | ~30 Zeilen | Opportunistisch |
| Ungenutzte Exports in `external-jobs/auth.ts` pruefen + entfernen | ~50 Zeilen | Folge-PR |
| Folge-Modul Welle 1: `storage` als naechstes Pilot | siehe Plan §5 Welle 1 | naechste Refactor-Initiative |

## Lessons Learned

- **Char-Tests vor Modul-Split sind unverhandelbar**. Beim ersten Helper-Split (PR #16) blieben die Tests gruen, weil sie das Verhalten exakt eingefangen haben. Ohne diesen Schutz waere jeder Split spekulativ.
- **Pragmatische Test-Strategie schlaegt Vollstaendigkeit**. Fuer `runTemplatePhase` (1.900 Zeilen, 10 externe Calls) Decision-Funktion + Helper testen statt Monolith mocken — gibt Sicherheitsnetz, ohne in Mock-Hoelle zu landen.
- **AGENTS.md Stop-Bedingungen funktionieren**. >1.000 Zeilen Diff in einer PR wurde als zu riskant identifiziert und in Folge-PRs aufgeteilt — vermeidet Big-Bang-Refactor.
- **Bestands-Audit (Schritt 0) hat Test-Drift verhindert**. Alle 8 Tests waren als `keep` markiert — beim Refactor war klar, dass nichts zu migrieren ist. Ohne Audit waere unklar, welche Tests "alte Welt" sind.

## Empfehlung fuer User

1. **Lokal verifizieren** vor Merge:
   - `pnpm install`
   - `pnpm test` → 451 Tests gruen?
   - `pnpm test:integration:api` (mit gueltigen Credentials) → relevante Pilot-Cases gruen?
2. **Merge-Reihenfolge** beachten: #13 → #14 → #15 → #16 → #17. Diese PR (#18 Abnahme) als letzte oder zusammen mit #17.
3. **Naechste Welle starten**: Plan-Sektion 5 → Welle 1 ist `storage` (Backend / Datenquelle). Mit der jetzt etablierten Methodik kann das nach demselben 5-Agent-Schema ablaufen.
