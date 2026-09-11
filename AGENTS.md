# Agent Instructions for CommonKnowledgeScout

Verbindliche Kurz-Regeln fuer alle Agenten (lokal und in Remote-Sessions).
Detaillierte Begruendungen + Beispiele:
[`docs/agents-handbuch.md`](docs/agents-handbuch.md).

## Aktueller Fahrplan (zuerst lesen)

**Eine Quelle fuer den Stand: [`docs/STAND.md`](docs/STAND.md).** Dort steht,
welches Vorhaben „jetzt" traegt, was geplant ist, was erledigt und was
verworfen. Es gibt keinen Zustand „offen" mehr. Gearbeitet wird **ein
Vorhaben nach dem anderen**; Agenten arbeiten nur am Vorhaben, das in
`STAND.md` auf „jetzt" steht, es sei denn, der Owner sagt es anders.

- **Vorhaben 1 (jetzt): AECED, Galerie als einbettbare Komponente (M5).**
  Brief: [`docs/refactor/modularisierung/AGENT-BRIEF-M5.md`](docs/refactor/modularisierung/AGENT-BRIEF-M5.md)
  (fuenf Schritte, Vorgeschichte M1–M4e, Regeln aus frueheren Wellen).
  Die Schritte 1 und 3 laufen als Teilwellen M4f–M4i mit eigener Messung:
  [`AGENT-BRIEF-M4f.md`](docs/refactor/modularisierung/AGENT-BRIEF-M4f.md)
  (M4f bis M4i erledigt — die Galerie liegt im Paket; naechstes ist M5).
- **Vorhaben 2: Klimamaßnahmen Südtirol, Vortrag 30.09.** (OneDrive-Anmeldung
  stabil neu aufsetzen, Library-Anpassungen, Webseite; Konzept im Archiv).
- **Vorhaben 3: SHF Konsensieren-Modul** (Freeze 09.10.); die Erfassung
  wird dort in einem Zug bereinigt (Alt-Endpunkte, ADR 0003, Welle 3-VI).

**Neue Punkte, die beim Bauen sichtbar werden**, traegt der Agent in
`docs/STAND.md` unter „Neu dazugekommen" des laufenden Vorhabens ein (mit
Datum), nicht nur in den Hand-off.

**Pflicht seit dem Build-Fehler nach M4b**: Eine A-Welle wird NICHT gemergt,
bevor `pnpm build` lokal gruen ist. `check-build` (PR) faehrt den
Docker-Build nicht — gruene PR-Checks sind kein Beleg.

**Abgeschlossene Straenge** (nicht neu aufgreifen; Kurzliste in
`docs/STAND.md`): Refactor-Wellen 1.1–3-IV und 4, Shadow Twin Mongo-only,
Werkbank/Agentensicht W0–W5, W1–W8, A1–A7b (Kuration nach ADR 0006, Tab
„Aktuell" aus den Bericht-Feldern der `VorhabenCard`s, Postfach-Frische
ueber `agentView.postfachMaxRueckstandWochen`), Modularisierung M1–M4e,
Storage ueber MCP ST1–ST4.

**Ruhend / geplant**: alles im Vorrat von `docs/STAND.md`, darunter die
Juni-Roadmap
[`docs/roadmap-formatunabhaengige-library-und-onboarding.md`](docs/roadmap-formatunabhaengige-library-und-onboarding.md)
(Plan 1 bis auf A4-Feinschliff erledigt, Plan 2 Onboarding-Flow). Erst
wieder aufgreifen, wenn der Owner es in ein Vorhaben holt.

## Pflicht-Lektuere zu Beginn jedes Tasks

1. `CLAUDE.md` (Einstiegs-Memory: Routing-Index, Coding-Konventionen;
   laedt die immer geltenden Contracts per `@`-Import)
2. Fuer den bearbeiteten Pfad: die im Routing-Index genannten Contracts
   unter `docs/contracts/` — der passende Contract-Skill fasst sie zusammen
3. Diese Datei — insb. den Abschnitt „Aktueller Fahrplan" — und
   [`docs/STAND.md`](docs/STAND.md) (welches Vorhaben traegt, was wartet)
4. Den Brief des laufenden Vorhabens (in `STAND.md` verlinkt)
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
- Live-Diktat: [`live-transkription.md`](docs/architecture/live-transkription.md)
- Neues Per-Library-Config-Feld: [`library-config-field.md`](docs/contracts/library-config-field.md)
- Lokale Live-Verifikation (ohne Zeit zu verlieren): [`verification-playbook.md`](docs/guides/verification-playbook.md)

## Test- und Lint-Commands (Kurz)

**Im Cloud-Agent (Pflicht):** `pnpm test` + `pnpm lint`. Kein
`pnpm build` (kostet 3-5 USD pro Lauf, lokal kostenlos). Ausnahme:
einmal bei konkretem Build-Fehler-Verdacht.

**ACHTUNG, Luecke zwischen den Gates (Befund 28.08.2026):** `pnpm test` und
`pnpm lint` pruefen KEINE Typen im App-Code. Eine falsche Property auf einem
Interface laeuft durch beide gruen durch und bricht erst `pnpm build` — also
erst nach dem Merge, im Docker-Build von `ci-main`. `check-build` an der PR
faengt es NICHT.

Wer App-Code (`src/**`) anfasst, prueft deshalb zusaetzlich:

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep '^src/'
```

Muss LEER sein. **Nicht auf einzelne Dateien filtern:** Genau daran ist der
Fehler vom 28.08. vorbeigerutscht.

**ACHTUNG, der `^src/`-Filter reicht NICHT (Befund 09.09.2026):** Hier stand,
die uebrigen Treffer laegen in `tests/**` und der Next-Build pruefe sie nicht.
Das ist FALSCH. `tsconfig.json` zieht mit `**/*.ts` und `**/*.tsx` auch
`tests/**` ein, und `pnpm build` typprueft das mit — der `ci-main`-Lauf 515 ist
genau daran gescheitert (`tests/unit/agent-view/report-merge.fixtures.ts`,
zwei neue Pflichtfelder an einem Interface). Dass eine Reihe alter
`.test.ts`-Fehler den Build trotzdem passieren laesst, ist kein Verlass: Next
meldet den ERSTEN Fehler, den es findet, und welcher das ist, haengt an der
Auswertungsreihenfolge.

Wer ein Interface um ein Pflichtfeld erweitert, prueft deshalb VOLLSTAENDIG
und vergleicht gegen den Stand vor der Aenderung — neu dazugekommene Zeilen
sind die eigenen:

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep 'error TS' | sed 's/(.*//' | sort -u > /tmp/nachher.txt
git stash -q && npx tsc --noEmit -p tsconfig.json 2>&1 | grep 'error TS' | sed 's/(.*//' | sort -u > /tmp/vorher.txt && git stash pop -q
comm -13 /tmp/vorher.txt /tmp/nachher.txt   # muss LEER sein
```

Guenstiger und sicherer, als das an `ci-main` zu merken: dort faellt es erst
nach dem Merge auf, im Docker-Build auf `master`.

**Beim User lokal vor Merge (Pflicht):**

```bash
bash scripts/welle-pre-merge-check.sh
```

Detail (warum, Symptome, Ausnahmen):
[`docs/agents-handbuch.md` §1](docs/agents-handbuch.md#1-test--und-build-strategie).

## Pläne

- Aktive Plaene liegen unter [`docs/plans/`](docs/plans/) — dort liegt seit
  2026-09-11 das Detailkonzept des Erfassungs-Composers fuer Vorhaben 3
  (`erfassungs-composer-s4-s5.plan.md`); das laufende Vorhaben hat seinen
  Brief, siehe [`docs/STAND.md`](docs/STAND.md)
- Geplante Plaene (gewollt, ohne Termin): [`docs/plans/geplant/`](docs/plans/geplant/)
- Erledigte/gegenstandslose Plaene: [`docs/plans/archiv/`](docs/plans/archiv/)
  (mit Beleg und Restnotiz je Plan in der dortigen README)
- Bei jedem Task: zuerst den referenzierten Plan bzw. Brief komplett lesen,
  dann das genannte Todo abarbeiten. Die `status:`-Marker in den Plan-Dateien
  sind NICHT verlaesslich gepflegt — massgeblich sind `STAND.md` und der Code.

## Architecture Decision Records (ADR)

- Verbindliche Architektur-Entscheidungen liegen unter `docs/adr/`
- Aktiv: `docs/adr/0001-event-job-vs-external-jobs.md` —
  `event-job` und `external-jobs` sind getrennte Domaenen, keine
  Vermischung in PRs
- Aktiv: `docs/adr/0002-galerie-sterne-ohne-clerk-read.md` —
  Galerie-Sterne und Voter-Namen kommen aus MongoDB + `GET docs`,
  nicht aus Clerk-Aggregations- oder Display-Name-Routen
- Vorgeschlagen (geplant, reserviert fuer Vorhaben SHF): `docs/adr/0003-wizard-schema-template-trennen.md` —
  Wizard (Flow/UI, generisch) und Schema-Template (Datenmodell + Renderer +
  Extractor, pro docType) werden getrennt und zur Laufzeit gemerged;
  Feld-Bindungsmodell bewusst offen
- Aktiv (akzeptiert 2026-09-09, gebaut seit Juni): `docs/adr/0004-capture-publish-entkopplung-inbox-modell.md` —
  Creation-Wizard schreibt bei Erfassung nie direkt in den Ziel-Provider;
  Submissions landen in interner Inbox (MongoDB + Azure Blob), Publikation
  ist ein rechte-gateter, idempotenter Promotion-Job
- Zurueckgestellt (2026-09-09): `docs/adr/0005-co-creator-eigene-storage-auth.md` —
  Co-Creator mit „Zugriff Archiv" nutzen kuenftig EIGENE Storage-Auth
  (OneDrive/Nextcloud) statt der Owner-Credentials; Galerie/Erkunden (MongoDB)
  vs. Archiv (Storage) trennen; Auth bei Invite eingeben + testen — spaeterer Schritt
- Aktiv: `docs/adr/0006-beweislast-umdrehen-werkbank-kuration.md` —
  Werkbank-Kuration: Modell B angenommen (2026-08-26). Maschinenarbeit gilt als
  angenommen (oranger Haken), der Mensch markiert nur Fehler (Stopp-Zeichen,
  `twin_status: fehlerhaft` + `flagged_by/at/note`); Sammelaktionen werden
  zurueckgebaut, Zaehler zaehlt Widerstaende statt Bestaetigungen
- Aktiv (akzeptiert 2026-09-09): `docs/adr/0007-modularisierung-monorepo-schale-module.md` —
  pnpm-Monorepo mit Schale (`@ks/shell`), Modul-Paketen (`@ks/module-*`) und
  Shared Libraries; SiteConfig pro Deployment; Core- vs. Modul-APIs mit
  Route-Handler-Fabriken; Detail: `docs/architecture/modul-landkarte.md` +
  `docs/architecture/einsatz-szenarien.md` + `migrations-strategie.md`
- Aktiv (akzeptiert 2026-09-09): `docs/adr/0008-deployment-ziele.md` — Ein Deployment, viele
  Sites (Host→SiteConfig zur Laufzeit, `next/dynamic` je Modul); eigene
  Compilate nur bei anderer Laufzeit (Electron, npm-Embed); Module exportieren
  montierbare Wurzelkomponenten.
  **Nachtrag 2026-08-29 (zwei Owner-Entscheidungen, bindend)**:
  (a) Die Huelle `embed` liefert AUSSCHLIESSLICH oeffentliche Inhalte — kein
  Site-Token, keine Besucher-Anmeldung, keine Uebernahme fremder Identitaeten.
  Geschuetztes gibt es nur in der eigenstaendigen Anwendung. Folge:
  `@ks/embed` braucht keine Anmelde-Mechanik, die Remote-Lese-API ist anonym,
  und die offene TopNav-Auth-Frage wird dadurch kleiner.
  (b) Die Headless-API (P8) nutzt DENSELBEN MCP-Konto-Schluessel
  (`src/lib/mcp/account-key-service.ts`), kein zweiter Mechanismus. Das
  Konzeptpapier nannte hier faelschlich `api/libraries/[id]/tokens` — diese
  Route liefert OneDrive-Zugangsdaten, keine Konsumenten-Schluessel.
  **Offene Kante**: Der Schluessel gilt mit den vollen Rechten seines
  Besitzers und kennt keine Scopes; wer ihn hat, erreicht auch die
  schreibenden MCP-Werkzeuge. Bis das anders ist: Schluessel nur an Parteien,
  denen man auch Schreibzugriff anvertraut
- Vorgeschlagen (geplant, M8): `docs/adr/0009-library-foederation.md` — mehrere Libraries
  pro Site (primary + federated); Frage- und Inhalts-Bruecken auf Basis des
  Perspektiven-Bruecken-Zielbilds; Inhalts-Bruecken vorberechnet
- Vorgeschlagen (geplant, M8): `docs/adr/0010-retrieval-profile.md` — Profile pro Library
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
