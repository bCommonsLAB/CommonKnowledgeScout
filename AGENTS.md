# Agent Instructions for CommonKnowledgeScout

Verbindliche Kurz-Regeln fuer alle Agenten (lokal und Cursor Cloud).
Detaillierte Begruendungen + Beispiele:
[`docs/agents-handbuch.md`](docs/agents-handbuch.md).

## Setup

- Package Manager: `pnpm@9.15.3`
- Install: `pnpm install --frozen-lockfile`
- Node-Version: laut `.nvmrc` / engines im `package.json`

## Pflicht-Lektuere zu Beginn jedes Tasks

1. `.cursorrules`
2. Alle `.cursor/rules/*.mdc` mit `alwaysApply: true`
3. Diese Datei
4. Bei Refactor-Tasks: `docs/refactor/<modul>/00-audit.md` (Bestands-
   Audit) und `docs/refactor/<modul>/AGENT-BRIEF.md` (falls vorhanden)

## Repo-Konventionen

- Sprache: Code englisch, Kommentare und Commit-Messages auf Deutsch
- Dateien max. 200 Zeilen, sonst aufsplitten
- Kein `any`, kein leeres `catch {}` — beides ist Lint-Error
- Silent Fallbacks verboten — siehe
  [`no-silent-fallbacks.mdc`](.cursor/rules/no-silent-fallbacks.mdc)
- UI darf Storage-Backend nicht kennen — siehe
  [`storage-abstraction.mdc`](.cursor/rules/storage-abstraction.mdc)
- TypeScript-Strict-Mode bleibt aktiv, `unknown` + Type-Guard statt `any`
- Pipeline-Aenderungen muessen die Contracts in
  [`contracts-story-pipeline.mdc`](.cursor/rules/contracts-story-pipeline.mdc) einhalten
- **Frontmatter-Format**: Template-/Material-Frontmatter ist FLACH und
  Obsidian-kompatibel — `snake_case`-Keys auf EINER Ebene, KEINE Dot-Notation
  (`a.b:`) und KEINE verschachtelten YAML-Objekte. Verschachtelte Datenmodelle
  (z.B. ein Digital-Twin-Objekt) entstehen erst downstream (MongoDB), nicht im
  Frontmatter/Template. Gilt rueckwirkend: bestehende nested Frontmatter sind
  zu vermeiden, nicht zu erweitern.

## Querschnitt-Konventionen (vor Reverse-Engineering lesen)

- MongoDB-Repos: [`mongodb-repository-pattern.md`](docs/architecture/mongodb-repository-pattern.md)
- API-Routes: [`api-route-conventions.md`](docs/architecture/api-route-conventions.md)
- File-Preview-Tabs: [`file-preview-tab-architecture.md`](docs/architecture/file-preview-tab-architecture.md)
- Neues Per-Library-Config-Feld: [`library-config-field.mdc`](.cursor/rules/library-config-field.mdc)

## Test- und Lint-Commands (Kurz)

**Im Cloud-Agent (Pflicht):** `pnpm test` + `pnpm lint`. Kein
`pnpm build` (kostet 3-5 USD pro Lauf, lokal kostenlos). Ausnahme:
einmal bei konkretem Build-Fehler-Verdacht.

**Beim User lokal vor Merge (Pflicht):**

```bash
bash scripts/welle-pre-merge-check.sh
```

Detail (warum, Symptome, Ausnahmen):
[`docs/agents-handbuch.md` §1](docs/agents-handbuch.md#1-test--und-build-strategie).

## Cursor-Plans

- Verbindliche Plaene liegen unter `.cursor/plans/`
- Aktiver Plan: `.cursor/plans/refactor-strategie-drift-eliminieren_06fd8014.plan.md`
- Bei jedem Cloud-Task: zuerst den referenzierten Plan komplett lesen,
  dann das genannte Todo abarbeiten

## Architecture Decision Records (ADR)

- Verbindliche Architektur-Entscheidungen liegen unter `docs/adr/`
- Aktiv: `docs/adr/0001-event-job-vs-external-jobs.md` —
  `event-job` und `external-jobs` sind getrennte Domaenen, keine
  Vermischung in PRs
- Aktiv: `docs/adr/0002-galerie-sterne-ohne-clerk-read.md` —
  Galerie-Sterne und Voter-Namen kommen aus MongoDB + `GET docs`,
  nicht aus Clerk-Aggregations- oder Display-Name-Routen
- Vorgeschlagen: `docs/adr/0003-wizard-schema-template-trennen.md` —
  Wizard (Flow/UI, generisch) und Schema-Template (Datenmodell + Renderer +
  Extractor, pro docType) werden getrennt und zur Laufzeit gemerged;
  Feld-Bindungsmodell bewusst offen
- Vorgeschlagen: `docs/adr/0004-capture-publish-entkopplung-inbox-modell.md` —
  Creation-Wizard schreibt bei Erfassung nie direkt in den Ziel-Provider;
  Submissions landen in interner Inbox (MongoDB + Azure Blob), Publikation
  ist ein rechte-gateter, idempotenter Promotion-Job

## Branching, Commits, PRs (Kurz)

- Default-Branch: `master`
- Branch-Schema Welle:
  `cursor/refactor-welle-<welle>-<beschreibung>-<suffix>`
- **Pro Welle EINE PR** mit max. 1.000z Diff/Commit, max. 5.000z
  Brutto-Diff/PR, max. 15 Commits/PR
- Cleanup-Commits gehoeren ZWINGEND in den PR ihrer Ursache
- Wellen-Naming: Plan-Wellen-Nummern sind reserviert, Future-Work
  bekommt Mutter-Name + Suffix — siehe
  [`refactor-naming-konvention.mdc`](.cursor/rules/refactor-naming-konvention.mdc)

Detail-Regeln:
[`docs/agents-handbuch.md` §3](docs/agents-handbuch.md#3-branching-commits-prs-detail)
und [`refactor-batch-strategy.mdc`](.cursor/rules/refactor-batch-strategy.mdc).

## Stop-Bedingungen (Kurz)

Sofort abbrechen + im PR/Comment melden bei:

- Tests vor Aenderung schon rot, ohne klare Reproduktion
- Plan-Schritt verweist auf nicht existierende Datei/Funktion
- Konflikt mit anderem offenen `refactor/cloud-*`-Branch
- Mehr als 3 fehlgeschlagene Versuche fuer dieselbe Aenderung
- Sicherheitsrelevante Aenderungen ohne expliziten Auftrag
- Diff-Limit-Verstoss (>1.000z/Commit hart, >5.000z/PR weich)
- Kosten-Eskalation (>3 grosse File-Reads ohne Fortschritt,
  `pnpm build` >2x ohne Fortschritt)

Vollstaendige Liste:
[`docs/agents-handbuch.md` §4](docs/agents-handbuch.md#4-stop-bedingungen-nicht-raten-abbrechen--in-prcomment-melden).

## Hand-off am Welle-Ende (PFLICHT)

Jede Welle-PR endet mit einem **Hand-off-Block** im PR-Body und in
der Antwort an den User:

1. Aufruf von `bash scripts/welle-pre-merge-check.sh` (lokal vor Merge)
2. Naechste Welle-Identifikation (Name, Branch, AGENT-BRIEF-Sektion)
3. Modellempfehlung (Sonnet/Opus + Thinking-Level mit Begruendung)
4. Agent-Typ-Empfehlung (NEUER Agent als Default)
5. Konkreter Start-Prompt (kopierbar in den naechsten Cloud-Agent)
6. Kosten-Schaetzung

Vorlage + Modellwahl-Tabelle:
[`docs/agents-handbuch.md` §5-§6](docs/agents-handbuch.md#5-hand-off-am-welle-ende-pflicht)
und [`docs/refactor/cloud-agent-kostenoptimierung.md`](docs/refactor/cloud-agent-kostenoptimierung.md).
