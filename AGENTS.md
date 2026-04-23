# Agent Instructions for CommonKnowledgeScout

Diese Datei definiert verbindliche Regeln fuer alle Agenten (lokal und Cursor Cloud), die in diesem Repo arbeiten.

## Cursor Cloud specific instructions

### Setup

- Package Manager: `pnpm@9.15.3`
- Install: `pnpm install --frozen-lockfile`
- Node-Version: laut `.nvmrc` / engines im `package.json`

### Test- und Lint-Commands (nach jeder Code-Aenderung ausfuehren)

- `pnpm test`          # Vitest Unit-Tests, muss gruen sein
- `pnpm lint`          # ESLint, muss ohne neue Warnings sein
- `pnpm health`        # Modul-Health-Report (sobald Tooling-Agent gemerged ist)
- Bei Pipeline-Aenderungen zusaetzlich: `pnpm test:integration:api` (siehe `.cursor/rules/external-jobs-integration-tests.mdc`)

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

### Branching, Commits, PRs

- Default-Branch dieses Repos ist `master` (nicht `main`)
- Branch-Namensschema fuer Refactoring-Plan: `refactor/cloud-<schritt>` (z.B. `refactor/cloud-tooling-setup`)
- Pro logischem Schritt einzelner Commit mit Prefix `[plan <plan-id>] <bereich>: <beschreibung>`
- PR-Titel beschreibt Intention auf Deutsch, PR-Body listet:
  - Was wurde geaendert
  - Welche Tests laufen / welche bewusst nicht
  - Verweise auf Plan-File und Todo-IDs
  - Offene Folge-Schritte

### Stop-Bedingungen (nicht raten, abbrechen + in PR/Comment melden)

- Tests, die schon vor Agent-Aenderung rot waren, ohne klare Reproduktion
- Plan-Schritt verweist auf nicht existierende Datei oder Funktion
- Konflikt mit anderem offenen `refactor/cloud-*`-Branch
- Mehr als 3 fehlgeschlagene Versuche fuer dieselbe Aenderung
- Sicherheitsrelevante Aenderungen (Auth, Secrets, Datenbank-Schema) ohne expliziten Auftrag
- Aenderungen, die mehr als 1000 Zeilen Diff erzeugen wuerden, ohne dass dies explizit im Plan steht
