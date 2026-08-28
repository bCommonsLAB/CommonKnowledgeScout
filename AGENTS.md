# Agent Instructions for CommonKnowledgeScout

Verbindliche Kurz-Regeln fuer alle Agenten (lokal und in Remote-Sessions).
Detaillierte Begruendungen + Beispiele:
[`docs/agents-handbuch.md`](docs/agents-handbuch.md).

## Aktueller Fahrplan (zuerst lesen)

**Laufender Strang (Stand 2026-08-27): Modularisierung.** EINE Quelle, damit
Sessions nicht doppelt bauen:

- **Was**: KnowledgeScout in Pakete schneiden (Schale + Module + Shared
  Libraries), damit einzelne Bereiche in fremde Seiten einbettbar sind, ohne
  doppelten Code und ohne unnoetige Client-Chunks.
- **Grundlage**: ADR [0007](docs/adr/0007-modularisierung-monorepo-schale-module.md)
  bis [0010](docs/adr/0010-retrieval-profile.md); Zuschnitt und Wellenplan in
  [`docs/architecture/modul-landkarte.md`](docs/architecture/modul-landkarte.md) §5;
  Umbau-Garantien in
  [`docs/architecture/migrations-strategie.md`](docs/architecture/migrations-strategie.md).
- **Agent-Brief M1** (abgeschlossen): [`docs/refactor/modularisierung/AGENT-BRIEF.md`](docs/refactor/modularisierung/AGENT-BRIEF.md)
- **Agent-Brief M2** (abgeschlossen): [`docs/refactor/modularisierung/AGENT-BRIEF-M2.md`](docs/refactor/modularisierung/AGENT-BRIEF-M2.md)
- **Agent-Brief M3** (abgeschlossen): [`docs/refactor/modularisierung/AGENT-BRIEF-M3.md`](docs/refactor/modularisierung/AGENT-BRIEF-M3.md)
- **Agent-Brief M4** (abgeschlossen): [`docs/refactor/modularisierung/AGENT-BRIEF-M4.md`](docs/refactor/modularisierung/AGENT-BRIEF-M4.md)
- **Agent-Brief M4b** (abgeschlossen): [`docs/refactor/modularisierung/AGENT-BRIEF-M4b.md`](docs/refactor/modularisierung/AGENT-BRIEF-M4b.md)
  (`@ks/ui`; enthaelt den Nachtrag zum Build-Fehler und die Korrektur zum
  `cn`-Schnitt: Teil-Extraktionen koennen `git log --follow` NICHT halten)
- **Agent-Brief M4c**: [`docs/refactor/modularisierung/AGENT-BRIEF-M4c.md`](docs/refactor/modularisierung/AGENT-BRIEF-M4c.md)
  (`@ks/i18n` mit zwei Einstiegspunkten; Locale-Atom bleibt paketintern)
- **Naechster Schritt**: Zurueck zur Landkarten-Zeile **M4** — die montierbare
  Explorer-Wurzelkomponente. `@ks/ui` und `@ks/i18n` stehen jetzt, damit ist
  sie erreichbar; ebenso die in M3 blockierte TopNav. Vorab zu entscheiden:
  TopNav zuerst (kleiner, in `@ks/shell`) oder direkt die Explorer-Wurzel —
  siehe Hand-off in AGENT-BRIEF-M4c.md. Voll-App bleibt unveraendert
  (Verhaltensneutralitaet ist Abnahmekriterium jeder A-Welle).
- **Pflicht seit dem Build-Fehler nach M4b**: Eine A-Welle wird NICHT gemergt,
  bevor `pnpm build` lokal gruen ist. `check-build` (PR) faehrt den
  Docker-Build nicht — gruene PR-Checks sind kein Beleg.

**Abgeschlossene Straenge** (nicht neu aufgreifen):

- **Werkbank/Agentensicht**: Wellen W1–W8 und A1–A6 sind umgesetzt
  ([`docs/concepts/projektauftrag-werkbank-abnahme.md`](docs/concepts/projektauftrag-werkbank-abnahme.md),
  Testsession dokumentiert). Kuration laeuft nach ADR 0006 (Modell B).

**Ruhender Strang**: Die Juni-Roadmap
[`docs/roadmap-formatunabhaengige-library-und-onboarding.md`](docs/roadmap-formatunabhaengige-library-und-onboarding.md)
(Plan 1 Library-Konsistenz, Plan 2 Onboarding-Flow) bleibt gueltig, wurde aber
zugunsten der Werkbank zurueckgestellt. Plan 1 ist bis auf A4-Feinschliff
erledigt. Erst wieder aufgreifen, wenn der Owner es sagt.

## Pflicht-Lektuere zu Beginn jedes Tasks

1. `CLAUDE.md` (Einstiegs-Memory: Routing-Index, Coding-Konventionen;
   laedt die immer geltenden Contracts per `@`-Import)
2. Fuer den bearbeiteten Pfad: die im Routing-Index genannten Contracts
   unter `docs/contracts/` — der passende Contract-Skill fasst sie zusammen
3. Diese Datei — insb. den Abschnitt „Aktueller Fahrplan"
4. [`docs/roadmap-formatunabhaengige-library-und-onboarding.md`](docs/roadmap-formatunabhaengige-library-und-onboarding.md) (Reihenfolge + Plan-1-Kickoff)
5. Bei Refactor-Tasks: `docs/refactor/<modul>/00-audit.md` (Bestands-
   Audit) und `docs/refactor/<modul>/AGENT-BRIEF.md` (falls vorhanden)

## Repo-Konventionen

- Sprache: Code englisch, Kommentare und Commit-Messages auf Deutsch
- Dateien max. 200 Zeilen, sonst aufsplitten
- Kein `any`, kein leeres `catch {}` — beides ist Lint-Error
- Silent Fallbacks verboten — siehe
  [`no-silent-fallbacks.md`](docs/contracts/no-silent-fallbacks.md)
- UI darf Storage-Backend nicht kennen — siehe
  [`storage-abstraction.md`](docs/contracts/storage-abstraction.md)
- TypeScript-Strict-Mode bleibt aktiv, `unknown` + Type-Guard statt `any`
- Pipeline-Aenderungen muessen die Contracts in
  [`contracts-story-pipeline.md`](docs/contracts/contracts-story-pipeline.md) einhalten
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
- Neues Per-Library-Config-Feld: [`library-config-field.md`](docs/contracts/library-config-field.md)
- Lokale Live-Verifikation (ohne Zeit zu verlieren): [`verification-playbook.md`](docs/guides/verification-playbook.md)

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

## Pläne

- Aktive Plaene liegen unter [`docs/plans/`](docs/plans/)
- Aktiver Plan: `docs/plans/refactor-strategie-drift-eliminieren_06fd8014.plan.md`
- Erledigte/gegenstandslose Plaene: [`docs/plans/archiv/`](docs/plans/archiv/)
  (mit Begruendung je Plan in der dortigen README)
- Bei jedem Task: zuerst den referenzierten Plan komplett lesen,
  dann das genannte Todo abarbeiten. Die `status:`-Marker in den Plan-Dateien
  sind NICHT verlaesslich gepflegt — im Zweifel gegen den Code pruefen.

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
- Vorgeschlagen (deponiert): `docs/adr/0005-co-creator-eigene-storage-auth.md` —
  Co-Creator mit „Zugriff Archiv" nutzen kuenftig EIGENE Storage-Auth
  (OneDrive/Nextcloud) statt der Owner-Credentials; Galerie/Erkunden (MongoDB)
  vs. Archiv (Storage) trennen; Auth bei Invite eingeben + testen — spaeterer Schritt
- Aktiv: `docs/adr/0006-beweislast-umdrehen-werkbank-kuration.md` —
  Werkbank-Kuration: Modell B angenommen (2026-08-26). Maschinenarbeit gilt als
  angenommen (oranger Haken), der Mensch markiert nur Fehler (Stopp-Zeichen,
  `twin_status: fehlerhaft` + `flagged_by/at/note`); Sammelaktionen werden
  zurueckgebaut, Zaehler zaehlt Widerstaende statt Bestaetigungen
- Vorgeschlagen: `docs/adr/0007-modularisierung-monorepo-schale-module.md` —
  pnpm-Monorepo mit Schale (`@ks/shell`), Modul-Paketen (`@ks/module-*`) und
  Shared Libraries; SiteConfig pro Deployment; Core- vs. Modul-APIs mit
  Route-Handler-Fabriken; Detail: `docs/architecture/modul-landkarte.md` +
  `docs/architecture/einsatz-szenarien.md` + `migrations-strategie.md`
- Vorgeschlagen: `docs/adr/0008-deployment-ziele.md` — Ein Deployment, viele
  Sites (Host→SiteConfig zur Laufzeit, `next/dynamic` je Modul); eigene
  Compilate nur bei anderer Laufzeit (Electron, npm-Embed); Module exportieren
  montierbare Wurzelkomponenten
- Vorgeschlagen: `docs/adr/0009-library-foederation.md` — mehrere Libraries
  pro Site (primary + federated); Frage- und Inhalts-Bruecken auf Basis des
  Perspektiven-Bruecken-Zielbilds; Inhalts-Bruecken vorberechnet
- Vorgeschlagen: `docs/adr/0010-retrieval-profile.md` — Profile pro Library
  (UI-Variante + pluggbare Retrieval-Strategie + Sprachen), Laie/Experte;
  Ingestion-Post-Prozesse (z.B. Geo-Normalisierung) als Pipeline-Phasen

## Branching, Commits, PRs (Kurz)

- Default-Branch: `master`
- Branch-Schema Welle:
  `cursor/refactor-welle-<welle>-<beschreibung>-<suffix>`
- **Pro Welle EINE PR** mit max. 1.000z Diff/Commit, max. 5.000z
  Brutto-Diff/PR, max. 15 Commits/PR
- Cleanup-Commits gehoeren ZWINGEND in den PR ihrer Ursache
- Wellen-Naming: Plan-Wellen-Nummern sind reserviert, Future-Work
  bekommt Mutter-Name + Suffix — siehe
  [`refactor-naming-konvention.md`](docs/contracts/refactor-naming-konvention.md)

Detail-Regeln:
[`docs/agents-handbuch.md` §3](docs/agents-handbuch.md#3-branching-commits-prs-detail)
und [`refactor-batch-strategy.md`](docs/contracts/refactor-batch-strategy.md).

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
