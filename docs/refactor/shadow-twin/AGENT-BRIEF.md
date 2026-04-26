# Cloud-Agent-Brief: Welle 2 - Modul `shadow-twin`

Stand: 2026-04-27. Erstellt vom Cloud-Agent als Pre-Flight fuer Welle 2,
direkt nach erfolgreicher Welle 1 (`storage`).

## Kontext (lies das ZUERST)

1. **Methodik & Workflow-Regeln**: [`docs/refactor/playbook.md`](../playbook.md)
   - insbesondere R1-R5 (kein Push auf master ohne User-OK, kein Parallelismus).
2. **Pilot-Erfahrung**: [`docs/refactor/external-jobs/`](../external-jobs/) (Pilot)
   und [`docs/refactor/storage/`](../storage/) (Welle 1).
3. **Plan-Bezug**: [.cursor/plans/refactor-strategie-drift-eliminieren_06fd8014.plan.md](../../../.cursor/plans/refactor-strategie-drift-eliminieren_06fd8014.plan.md)
   Sektion 5 (Welle 2).
4. **Architektur-Rule**: [.cursor/rules/shadow-twin-architecture.mdc](../../../.cursor/rules/shadow-twin-architecture.mdc)
   ist die zentrale Architektur-Rule (alwaysApply: false, aber pipeline-Globs).
5. **Inventur** (schon erstellt): [`01-inventory.md`](./01-inventory.md).

## Aufgabe

Du bist **EIN** Cloud-Agent (R2). Du arbeitest die 8 Schritte der Methodik
**seriell** durch, fuer das Modul `shadow-twin`.

Output landet in `docs/refactor/shadow-twin/00-audit.md`, `02-contracts.md`,
`03-tests.md`, `04-altlast-pass.md`, `05-user-test-plan.md`, `06-acceptance.md`.

Code-Aenderungen landen direkt in `src/lib/shadow-twin/`, neue Tests in
`tests/unit/shadow-twin/`. Eine modul-spezifische Contract-Rule
`.cursor/rules/shadow-twin-contracts.mdc` wird neu erstellt
(komplementaer zu `shadow-twin-architecture.mdc`).

## Vorab-Entscheidungen (vom Cloud-Agent vor Start geklaert)

### E1: Verhaeltnis `shadow-twin-architecture.mdc` vs. neue `shadow-twin-contracts.mdc`

Genau wie in Welle 1 (`storage-abstraction.mdc` + `storage-contracts.mdc`):

- **`shadow-twin-architecture.mdc`** bleibt **unveraendert** -> erklaert das
  **Warum** (UI darf nicht Storage-Backend kennen, ArtifactKey-Determinismus,
  virtuelle Mongo-IDs).
- **`shadow-twin-contracts.mdc`** wird **neu erstellt** -> erklaert das
  **Wie genau** auf Funktions- und Fehler-Ebene.

### E2: `shadow-twin-service.ts` (914 Z.) Split-Strategie

Pragmatisch wie in Welle 1: pure Helper extrahieren, Hauptklasse als
Composer-Fassade belassen. Voller State-Split ist Folge-PR.

### E3: Char-Test-Status

Modul hat bereits 13 Char-Tests (deutlich besser als storage-Welle-1-Start).
Welle 2 fokussiert auf:
- 2-3 neue Tests fuer die groessten ungetesteten Files
  (`analyze-shadow-twin.ts`, `shadow-twin-migration-writer.ts`)
- Sicherstellen, dass alle bestehenden Tests gruen bleiben

### E4: Modul-DoD vs. Pilot

Wegen besserem Bestandszustand kann Welle 2 ambitionierter sein:
- 0 leere Catches (schon erreicht, halten)
- 0 `any` (schon erreicht, halten)
- > 200 Zeilen: `12 -> ≤ 10` (durch Helper-Extracts)
- Max-Zeilen: `914 -> < 800` (Helper-Extracts aus shadow-twin-service.ts)
- +2-3 neue Char-Tests
- Modul-Contract-Rule `shadow-twin-contracts.mdc` existiert
- Doku-Hygiene: `docs/architecture/shadow-twin.md`, `docs/reference/modules/...`
  pruefen + ggf. updaten

## Schritt-fuer-Schritt-Ablauf

### Schritt 0 - Bestands-Audit
- File: `docs/refactor/shadow-twin/00-audit.md`
- 3 Tabellen (Rules, Tests, Docs) wie Welle-1-Vorlage.
- Tests: 13 in `tests/unit/shadow-twin/` + 2 in `tests/unit/storage/`.
- Docs: `docs/architecture/shadow-twin.md`, `docs/guides/shadow-twin.md`,
  `docs/shadow-twin-freshness-sync.md`, `docs/analysis/shadow-twin-*.md`.

### Schritt 1 - Inventur
- File: [`01-inventory.md`](./01-inventory.md) **existiert bereits** (Cloud-Agent Pre-Flight).

### Schritt 2 - Contracts
- Neue Rule: `.cursor/rules/shadow-twin-contracts.mdc`
- Globs: `["src/lib/shadow-twin/**/*.ts"]`
- Mindestens definieren:
  - **§1 ArtifactKey-Determinismus** (technische Pflicht-Felder, Parsing-Vertrag)
  - **§2 Fehler-Semantik** (kein silent fallback, virtuelle Mongo-IDs werfen wenn an Filesystem geleitet)
  - **§3 Erlaubte/verbotene Abhaengigkeiten** (`src/lib/shadow-twin/**` darf NICHT von `src/components/**` abhaengen)
  - **§4 Skip-/Default-Semantik** (was bedeutet `primaryStore=mongo` fuer Provider-Operationen)
  - **§5 Helper-Vorgaben** (analog `library-capability.ts` aus Welle 1)
  - **§6 Store-Architektur** (Interface + 2 Implementierungen)

### Schritt 3 - Characterization Tests
Mindestens 2 neue Test-Files:
- `tests/unit/shadow-twin/analyze-shadow-twin-*.test.ts` (mind. 5 Tests)
- `tests/unit/shadow-twin/shadow-twin-migration-writer-*.test.ts` (mind. 5 Tests)
- Mocks: `vi.mock('mongodb')` oder eigene Fake-Repository, **keine** Live-Calls.

### Schritt 4 - Altlast-Pass

**Pflicht-Subset** (konservativ):
1. Pure Helper aus `shadow-twin-service.ts` extrahieren (analog
   `onedrive/errors.ts` in Welle 1) - 2-3 reine Funktionen identifizieren
2. Falls vorhanden: Silent-Catches dokumentieren oder beheben (laut Health 0)
3. UI/Service-Branches: pruefen ob Komponenten direkt `primaryStore` lesen,
   falls ja: zu `useShadowTwinCapability()` o.ae. migrieren
   (analog `isFilesystemBacked` in Welle 1)

**NICHT in dieser Welle**:
- Vollstaendiger Split von `shadow-twin-service.ts` (914 Z.) - Folge-PR
- `analyze-shadow-twin.ts` (465 Z.) splitten - Folge-PR
- `artifact-client.ts` (422 Z.) splitten - Folge-PR

### Schritt 5 - Strangler-Fig
- `MongoShadowTwinStore` und `ProviderShadowTwinStore` sind **kein**
  Strangler-Fig-Pattern, sondern bewusst zwei Implementierungen eines
  Interface fuer unterschiedliche Storage-Backends. Nichts zu tun.

### Schritt 6 - Dead-Code
- `pnpm knip` laufen lassen
- Findings in `shadow-twin`-Modulgrenzen pruefen, sicher loeschbares loeschen
- Doku-Hygiene: `docs/architecture/shadow-twin.md`, `docs/reference/modules/...`
  pruefen + ggf. updaten

### Schritt 7 - Abnahme

Du fuellst BEIDE DoD-Teile (R5):

**Methodik-DoD**:
- Alle 6 Doku-Files vorhanden (`00-audit.md` bis `06-acceptance.md`).
- `shadow-twin-contracts.mdc` existiert.
- Char-Tests existieren (13 alt + 2-3 neu).

**Modul-DoD** (in DIESER Welle erreichbar):
- `pnpm test` gruen (mind. 490 + 10-15 neue Tests)
- `pnpm lint` ohne neue Errors
- `pnpm health -- --module shadow-twin` zeigt:
  - Files: 30 + 1-3 (Helper) = ~31-33
  - Max-Zeilen: < 800 (durch Helper-Extracts aus shadow-twin-service.ts)
  - **`> 200 Zeilen`: ≤ 10** (von 12 jetzt)
  - leere Catches: 0 (unveraendert)

## Push-Strategie (R1, R4)

**Du PUSHST NICHT auf master.** Stattdessen:
- Eigener Branch: `refactor/shadow-twin-welle-2`
- Commit pro Schritt (`shadow-twin(audit): ...`, etc.)
- 1 PR am Ende - User reviewt, mergt selbst nach lokaler Verifikation
- `[skip ci]` fuer Doku-only-Commits.
- Mindestens 6 Min Abstand zum Welle-1-Merge auf master.

## Stop-Bedingungen

Stoppe und melde dem User, wenn:
- `> 1.000 Zeilen Diff` in einem Commit
- Tests werden rot und du findest die Ursache nicht in 30 Min
- Architektur-Frage auftritt, die nicht im Brief geklaert ist
- Live-Mongo/Azure-Calls werden noetig - diese sind verboten, mocke sauber
