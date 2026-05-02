# Agent Instructions for CommonKnowledgeScout

Diese Datei definiert verbindliche Regeln fuer alle Agenten (lokal und Cursor Cloud), die in diesem Repo arbeiten.

## Cursor Cloud specific instructions

### Setup

- Package Manager: `pnpm@9.15.3`
- Install: `pnpm install --frozen-lockfile`
- Node-Version: laut `.nvmrc` / engines im `package.json`

### Test- und Lint-Commands

**Update 2026-05-02** (Kosten-Strategie, siehe [`.cursor/rules/cloud-agent-cost-strategy.mdc`](.cursor/rules/cloud-agent-cost-strategy.mdc)):

**Im Cloud-Agent waehrend der Arbeit (Pflicht):**
1. `pnpm test --run <relevante-paths>` — gezielt, schnell, billig
2. `pnpm lint` — vor jedem Push

**`pnpm build` wird NICHT mehr im Cloud-Agent gemacht (Default).**
Begruendung: kostet 3-5 USD pro Lauf, lokal kostenlos.

**Beim User lokal vor Merge (Pflicht):**

```bash
bash scripts/welle-pre-merge-check.sh
```

Das Script faehrt `pnpm test + pnpm lint + pnpm build` und meldet,
wenn etwas nicht gruen ist. Bei rot: User postet Befund im PR-Comment,
Agent fixed nach.

**Ausnahme im Cloud-Agent**: Wenn der Agent einen konkreten Verdacht
auf einen Build-Fehler hat (z.B. nach Modul-Split mit vielen Imports),
darf er **einmal** `pnpm build` ausfuehren. Mehrfaches Bauen ohne
Fortschritt ist verboten.

Bei Pipeline-Aenderungen zusaetzlich: `pnpm test:integration:api`
(siehe `.cursor/rules/external-jobs-integration-tests.mdc`).

#### Warum `pnpm build` Pflicht ist (Lehre aus PR #29 / Hotfix #30)

`pnpm lint` (= `next lint`) klassifiziert bestimmte Regeln (z.B.
`@typescript-eslint/no-unused-vars`) lokal als **Warning**. Erst
`pnpm build` (= `next build`) macht daraus harte **Errors** und bricht
den Production-Deploy.

Symptom in CI:

```
Error: 'XYZ' is defined but never used. @typescript-eslint/no-unused-vars
> Build failed because of webpack errors
Process completed with exit code 1.
```

**Konsequenz** (Update 2026-05-02): `pnpm build` muss vor jedem Merge
gruen sein — aber **nicht zwingend im Cloud-Agent**. Stattdessen
laeuft das Pre-Merge-Script `scripts/welle-pre-merge-check.sh` lokal
beim User. Spart 3-5 USD pro Welle.

### Repo-Konventionen (verbindlich)

- Pflichtlektuere zu Beginn jedes Tasks:
  - `.cursorrules`
  - alle `.cursor/rules/*.mdc`
  - dieser AGENTS.md-Eintrag
- Sprache: Code englisch, Kommentare und Commit-Messages auf Deutsch
- Dateien max. 200 Zeilen, sonst aufsplitten (Regel aus `.cursorrules`)
- Kein `any`, kein leeres `catch {}` - beides ist Lint-Error (siehe `.cursorrules` und `.cursor/rules/no-silent-fallbacks.mdc`)
- Silent Fallbacks verboten - jeder gefangene Fehler muss entweder geworfen oder geloggt werden mit Begruendung im Kommentar (`.cursor/rules/no-silent-fallbacks.mdc`)
- UI darf Storage-Backend nicht kennen - keine `primaryStore`-Branches in Komponenten/Hooks (`.cursor/rules/storage-abstraction.mdc`)
- TypeScript-Strict-Mode bleibt aktiv, `unknown` + Type-Guard statt `any`
- Pipeline-Aenderungen muessen die Contracts in `.cursor/rules/contracts-story-pipeline.mdc` einhalten

### Cursor-Plans

- Verbindliche Plaene liegen unter `.cursor/plans/`
- Aktueller aktiver Plan: `.cursor/plans/refactor-strategie-drift-eliminieren_06fd8014.plan.md`
- Bei jedem Cloud-Task gilt: zuerst den referenzierten Plan komplett lesen, dann das genannte Todo abarbeiten

### Architecture Decision Records (ADR)

- Verbindliche Architektur-Entscheidungen liegen unter `docs/adr/`
- Bei jedem Cloud-Task gilt: alle relevanten ADRs vorher lesen
- Aktiv:
  - `docs/adr/0001-event-job-vs-external-jobs.md`: `event-job` und `external-jobs` sind **getrennte Domaenen**, kein Strangler-Fig zwischen ihnen, keine Vermischung in PRs

### Bestands-Audit beachten (Schritt 0 im Refactor-Playbook)

Vor jedem Refactor eines Moduls existiert ein Audit-File `docs/refactor/<modul>/00-audit.md`, das pro Bestands-Artefakt (Cursor-Rule, Test, Doc) eine Aktion festlegt: `keep` / `update` / `migrate` / `merge` / `delete`.

- Wenn ein Cloud-Task ein Modul refaktoriert, **muss** das Audit-File zu Beginn gelesen werden
- Aenderungen am Code muessen mit den Audit-Aktionen konsistent sein:
  - `keep`-Tests bleiben unangetastet (Sicherheitsnetz)
  - `migrate`-Tests werden im selben Schritt mit-aktualisiert (z.B. neuer Importpfad nach Modul-Split)
  - `delete`-Tests werden erst im Dead-Code-Schritt entfernt (nicht frueher, sonst verliert man Sicherheitsnetz)
- Beim Loeschen oder Verschieben von Code: zugehoerige Tests, Rules und Docs **immer** mit-anpassen — nie verwaiste Bestands-Artefakte zurueck lassen
- Existiert noch kein Audit-File fuer ein Modul: Aufgabe abbrechen und im PR/Comment melden, dass Audit-Phase fehlt

### Wellen-Naming-Konvention (PFLICHT)

Plan-Wellen-Nummern (Welle 0, 1, 2, 3-I, 3-II, 3-III, ...) sind im Plan-File reserviert — auch fuer noch nicht begonnene Wellen. Future-Work-Wellen, die aus einer Mutter-Welle entstehen, bekommen den Mutter-Namen mit Suffix (z.B. **Welle 3-II-Hooks** als Future-Work aus Welle 3-II), KEINE neue Wellen-Nummer.

Verbindliche Regel: `.cursor/rules/refactor-naming-konvention.mdc`.

Vor dem Anlegen eines neuen `docs/refactor/welle-X-Y/`-Verzeichnisses immer im Plan-File pruefen, ob die Nummer bereits reserviert ist.

### Branching, Commits, PRs

- Default-Branch dieses Repos ist `master` (nicht `main`)
- Branch-Namensschema fuer Refactoring-Plan: `refactor/cloud-<schritt>` (z.B. `refactor/cloud-tooling-setup`)
- Branch-Schema Welle: `cursor/refactor-welle-<welle>-<beschreibung>-<suffix>` (z.B. `cursor/refactor-welle-3-iii-a-gallery-a03a`)
- **Pro Welle EINE PR** (siehe `.cursor/rules/refactor-batch-strategy.mdc`)
  - Mehrere kohaerente Commits, max **1.000 Zeilen Diff pro Commit** (hart)
  - Max **5.000 Zeilen Brutto-Diff pro PR** (weich, mit Begruendung mehr OK)
  - Max **15 Commits pro PR** (weich)
  - Cleanup-Commits gehoeren ZWINGEND in den PR ihrer Ursache (NICHT als Folge-PR)
  - Doku-Commit (Acceptance) als letzten Commit
- Pro logischem Schritt einzelner Commit mit Prefix `[plan <plan-id>] <bereich>: <beschreibung>`
- PR-Titel beschreibt Intention auf Deutsch, PR-Body listet:
  - Was wurde geaendert (gegliedert nach Commits)
  - Welche Tests laufen / welche bewusst nicht
  - Verweise auf Plan-File und Todo-IDs
  - **Smoke-Test-Plan** (max 10 konkrete Klicks, nach Komponenten gruppiert)
  - Offene Folge-Schritte

### Stop-Bedingungen (nicht raten, abbrechen + in PR/Comment melden)

- Tests, die schon vor Agent-Aenderung rot waren, ohne klare Reproduktion
- Plan-Schritt verweist auf nicht existierende Datei oder Funktion
- Konflikt mit anderem offenen `refactor/cloud-*`-Branch
- Mehr als 3 fehlgeschlagene Versuche fuer dieselbe Aenderung
- Sicherheitsrelevante Aenderungen (Auth, Secrets, Datenbank-Schema) ohne expliziten Auftrag
- **Einzelner Commit** mit mehr als 1.000 Zeilen Diff (hartes Limit, splitte den Commit)
- **PR-Gesamtvolumen** ueber 5.000 Zeilen Brutto-Diff ohne Plan-Begruendung (zu schwer reviewbar)
- **PR-Commit-Anzahl** ueber 15 Commits ohne Plan-Begruendung (zu unstrukturiert)
- **Kosten-Eskalation** (siehe `cloud-agent-cost-strategy.mdc` R7):
  - Mehr als 3 grosse File-Reads (>500z) in derselben Welle ohne Modul-Split-Fortschritt
  - `pnpm build` mehr als 2x im Agent ohne Fortschritt — stattdessen User um lokale Verifikation bitten

### Hand-off am Welle-Ende (PFLICHT)

Verbindlich seit 2026-05-02. Quelle: [`.cursor/rules/cloud-agent-cost-strategy.mdc`](.cursor/rules/cloud-agent-cost-strategy.mdc).

Jede Welle-PR endet im PR-Body und in der Antwort an den User mit einem
**Hand-off-Block**, der genau die Anweisungen enthaelt, die der User
braucht, um die naechste Welle guenstig zu starten:

1. Aufruf von `bash scripts/welle-pre-merge-check.sh` (lokal vor Merge)
2. Naechste Welle-Identifikation (Name, Branch, AGENT-BRIEF-Sektion)
3. **Modellempfehlung**: Sonnet/Opus + Thinking-Level mit Begruendung
4. **Agent-Typ-Empfehlung**: NEUER Agent (Default) oder Resume mit Begruendung
5. **Konkreter Start-Prompt** (kopierbar in den naechsten Cloud-Agent)
6. **Kosten-Schaetzung** (mit/ohne Empfehlungen)

Vorlage und Beispiele: [`docs/refactor/cloud-agent-kostenoptimierung.md`](docs/refactor/cloud-agent-kostenoptimierung.md).

**Begruendung**: Cache-Read-Kosten skalieren quadratisch mit Konversations­
laenge. Eine Session ueber 5 Wellen kostet nicht 5x sondern eher 15-20x.
Pro Welle ein neuer Agent + Sonnet statt Opus + lokal bauen
= ca. 1/4 der Originalkosten.

### Modellwahl pro Welle-Typ (Empfehlung)

| Welle-Typ | Modell | Thinking |
|---|---|---|
| Audit + Inventur (nur Doku) | claude-sonnet | medium |
| Char-Tests schreiben (Pattern-Replikation) | claude-sonnet | medium |
| Pure-Helper / Hook-Extract | claude-sonnet | medium |
| Kleinerer Modul-Split (1 Hauptdatei, klares Vorbild) | claude-sonnet | medium |
| Grosser Modul-Split (>1 Hauptdatei, Cross-File-Edits) | claude-opus | medium |
| Architektur-Entscheidung mit Trade-offs | claude-opus | high |
| Latenter-Bug-Analyse / Hypothesen | claude-opus | high |

Verboten ohne explizite Begruendung:
- `thinking-xhigh` (selten noetig, sehr teuer)
- `opus` fuer reine Doku-Tasks
