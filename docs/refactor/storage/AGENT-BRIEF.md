# Cloud-Agent-Brief: Welle 1 — Modul `storage`

Stand: 2026-04-26. Erstellt vom IDE-Agenten (Pre-Flight, Welle 1, R1+R2 der Methodik).

## Kontext (lies das ZUERST)

1. **Methodik & Workflow-Regeln**: [`docs/refactor/playbook.md`](../playbook.md)
   — insbesondere Workflow-Regeln R1-R5 (kein Parallelismus, ein Test-Cycle, User-Verifikation Pflicht).
2. **Pilot-Erfahrung**: [`docs/refactor/external-jobs/`](../external-jobs/)
   — komplette 5-File-Doku-Serie (`00-audit.md` bis `05-user-test-plan.md`)
   ist die Vorlage fuer dieses Modul.
3. **Plan-Bezug**: [.cursor/plans/refactor-strategie-drift-eliminieren_06fd8014.plan.md](../../../.cursor/plans/refactor-strategie-drift-eliminieren_06fd8014.plan.md)
   Sektion 5 (Welle 1).
4. **Architektur-Rule**: [.cursor/rules/storage-abstraction.mdc](../../../.cursor/rules/storage-abstraction.mdc)
   ist `alwaysApply: true` — ALLE Aenderungen muessen sie respektieren.
5. **Inventur** (schon erstellt): [`01-inventory.md`](./01-inventory.md)
   — Du hast die Health-Zahlen + Hot-Spots als Startpunkt.
6. **AGENTS.md** im Repo-Root — verbindliche Regeln fuer alle Agenten.

## Aufgabe

Du bist **EIN** Cloud-Agent (kein Parallelismus, R2). Du arbeitest die
8 Schritte der Methodik **seriell** durch, fuer das Modul `storage`.

Output landet in `docs/refactor/storage/00-audit.md`, `02-contracts.md`,
`03-tests.md`, `04-altlast-pass.md`, `05-user-test-plan.md`,
`06-acceptance.md` (Nummerierung 02-06, weil 01 schon existiert).

Code-Aenderungen landen direkt in `src/lib/storage/`, neue Tests in
`tests/unit/storage/`. Eine modul-spezifische Contract-Rule
`.cursor/rules/storage-contracts.mdc` wird neu erstellt.

## Schritt-fuer-Schritt-Ablauf

### Schritt 0 — Bestands-Audit
- File: `docs/refactor/storage/00-audit.md`
- 3 Tabellen (Rules, Tests, Docs) wie in [Pilot-Vorlage](../external-jobs/00-audit.md)
- Vergiss `tests/unit/storage/` nicht (6 vorhandene Tests + 2 Helper-Tests)
- Klaeren: Ist `storage-factory-mongodb.ts` Duplikat zu `storage-factory.ts`? Ist `onedrive-provider-server.ts` Strangler-Fig zu `onedrive-provider.ts`?

### Schritt 1 — Inventur
- File: `docs/refactor/storage/01-inventory.md` **existiert bereits** (vom IDE-Agenten geschrieben).
- Du kannst Spalten ergaenzen, falls du Details findest, die jetzt fehlen.

### Schritt 2 — Contracts
- Neue Rule: `.cursor/rules/storage-contracts.mdc`
- Globs: `["src/lib/storage/**/*.ts"]`
- Mindestens definieren:
  - **§1 Determinismus**: `StorageProvider`-Interface ist Vertrag (siehe `storage-abstraction.mdc` §6)
  - **§2 Fehler-Semantik**: Ungueltige libraryId/itemId → wirft, kein silent return undefined
  - **§3 Erlaubte/verbotene Abhaengigkeiten**: `src/lib/storage/**` darf NICHT von `src/components/**` oder UI-Code abhaengen
  - **§4 Skip-/Default-Semantik**: Was tut `getProvider()`, wenn Library-Type unbekannt? (verboten: silent fallback)

### Schritt 3 — Characterization Tests
- Mindestens 3 neue Test-Files fuer `onedrive-provider.ts`:
  - `tests/unit/storage/onedrive-provider-list-items.test.ts`
  - `tests/unit/storage/onedrive-provider-binary.test.ts`
  - `tests/unit/storage/onedrive-provider-error-paths.test.ts`
- Mindestens 1 Test fuer `storage-factory.ts` (Provider-Auswahl je `library.type`)
- Mocks: `vi.mock('@azure/msal-...')` oder eigener Fake-Provider; **keine Live-Calls**.

### Schritt 4 — Altlast-Pass

**Pflicht-Subset** (nicht alles auf einmal):
1. `onedrive-provider.ts` (2.109 Z.) → 5 Sub-Module splitten:
   - `onedrive/auth.ts`, `onedrive/items.ts`, `onedrive/binary.ts`, `onedrive/cache.ts`, `onedrive/errors.ts`
   - `onedrive-provider.ts` bleibt als Composer / Fassade (~200 Z.)
   - Char-Tests aus Schritt 3 muessen gruen bleiben
2. Silent Catch in `onedrive-provider.ts` dokumentieren oder beheben (1 Stelle)
3. **Helper-Service erstellen** fuer "ist diese Library auf Filesystem?" — z.B. `storage/library-capability.ts` mit `isFilesystemBacked(library): boolean`. Pilot-Migration: `file-preview.tsx:1134` darauf umstellen.

**Optional bei Zeit/Budget**: weitere `> 200 Zeilen`-Files prufen (`storage-factory.ts`, `filesystem-provider.ts`).

**NICHT in dieser Welle** (Folge-PRs):
- Vollstaendiges Aufraeumen aller `library.type ===`-Branches in der Codebase (gehoert teilweise zu Welle 9d `file-preview`)
- Architektur-Entscheidung "soll `storage-factory-mongodb.ts` mit `storage-factory.ts` mergen?" — nur **dokumentieren** in `04-altlast-pass.md`, **nicht** umsetzen ohne User-Abstimmung.

### Schritt 5 — Strangler-Fig
- Falls Audit ergibt, dass `storage-factory-mongodb.ts` Duplikat ist: Markiere alte Variante als `@deprecated` mit Log-Warnung, **migriere nicht** (User entscheidet in eigener Welle).
- Falls `onedrive-provider-server.ts` als Strangler-Fig zu `onedrive-provider.ts` identifiziert wird: dokumentieren, nicht aufloesen.

### Schritt 6 — Dead-Code
- `pnpm knip` laufen lassen
- Findings in `storage`-Modulgrenzen pruefen, sicher loeschbares loeschen
- API-Route `streaming-url/route.ts` pruefen: noch genutzt?

### Schritt 7 — Abnahme

Du fuellst BEIDE DoD-Teile (R5):

**Methodik-DoD**:
- Alle 6 Doku-Files vorhanden (`00-audit.md` bis `06-acceptance.md`, plus
  `05-user-test-plan.md`)
- `storage-contracts.mdc` existiert
- Char-Tests existieren

**Modul-DoD** (in DIESER Welle erreichbar):
- `pnpm test` gruen (vorher 451 Tests, danach >= 451 + neue Tests)
- `pnpm lint` ohne neue Errors (Warnings okay)
- `pnpm health --module storage` zeigt:
  - Files: 15 + 5 (onedrive Sub-Module) - 0 (nichts geloescht ohne knip-Beleg) = ~20
  - Max-Zeilen: < 800 (onedrive-provider als Fassade < 250, andere unveraendert oder kleiner)
  - **`> 200 Zeilen`: ≤ 7** (von 9 jetzt, durch onedrive-Split min. 2 Files raus)
  - leere Catches: 0 (statt 1)
- `tests/unit/storage/onedrive-provider-*.test.ts` existieren mit ≥ 5 Tests pro File
- `file-preview.tsx:1134` nutzt neuen Helper

### Schritt 5 (User-Test-Plan, nicht Strangler-Fig)
- File: `docs/refactor/storage/05-user-test-plan.md` (Vorlage: [external-jobs/05](../external-jobs/05-user-test-plan.md))
- Phase A (autom. Tests), Phase B (Build-Sanity), Phase C (UI-Smoke), Phase D (Befund)
- Phase C konkret: Use-Cases fuer Filesystem + OneDrive + Nextcloud Library wechseln, Datei oeffnen, Datei hochladen, Datei loeschen — minimaler Smoke fuer alle 3 Provider

## Push-Strategie (R1, R4)

**Du PUSHST NICHT auf master.** Stattdessen:
- Eigener Branch: `refactor/storage-welle-1`
- Commit pro Schritt (`storage(audit): ...`, `storage(tests): ...`, etc.)
- 1 PR am Ende, die alle Schritte enthaelt
- Kein Auto-Merge — User reviewt, testet lokal nach `05-user-test-plan.md`,
  merged dann selbst

## Stop-Bedingungen

Stoppe und melde dem User, wenn:
- `> 1.000 Zeilen Diff` in einem Commit (zu riskant, splitte)
- Tests werden rot und du findest die Ursache nicht in 30 Min
- Architektur-Frage auftritt, die nicht im Brief geklaert ist (siehe oben:
  z.B. Mongo-Factory-Merge)
- Storage-Provider-Live-Calls (Microsoft Graph etc.) werden noetig — diese
  sind verboten, mocke sauber

## Daten zum Mitnehmen

- Repo: `bCommonsLAB/CommonKnowledgeScout`, default branch `master`
- Aktueller Stand `master`: nach Pilot-Welle abgeschlossen, ci-main mit
  Concurrency-Schutz aktiv
- Test-Setup: `pnpm install` (Node 20+, pnpm 9.15.3)
- Tools: `pnpm test`, `pnpm lint`, `pnpm health -- --module storage`, `pnpm knip`
- **Keine** Live-Mongo/Secretary/OneDrive/Nextcloud-Calls (siehe AGENTS.md)
