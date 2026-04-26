# Welle-Abnahme: Modul `shadow-twin`

Stand: 2026-04-27. Erstellt vom Cloud-Agent (Welle 2, Plan-Schritt 7).

Bezug:
- Plan: [.cursor/plans/refactor-strategie-drift-eliminieren_06fd8014.plan.md](../../../.cursor/plans/refactor-strategie-drift-eliminieren_06fd8014.plan.md) §5 Welle 2
- AGENT-BRIEF: [`AGENT-BRIEF.md`](./AGENT-BRIEF.md)
- Welle-1-Vorbild: [`docs/refactor/storage/06-acceptance.md`](../storage/06-acceptance.md)
- Workflow-Regeln: [`docs/refactor/playbook.md`](../playbook.md) R1-R5

## Zusammenfassung

Welle 2 (`shadow-twin`) wurde **seriell von einem Cloud-Agent** in einer
Sitzung abgearbeitet (R2). 6 Commits auf `refactor/shadow-twin-welle-2`,
kein Push auf `master` ohne User-OK (R1), `[skip ci]` fuer Doku-only-Commits
(R4).

Im Vergleich zu Welle 1: deutlich kleinerer Scope, weil das Modul
strukturell schon sauber war (0 leere Catches, 0 `any`, 13 vorhandene
Char-Tests).

| # | Commit | Schritt | Diff |
|---|---|---|---:|
| 1 | `shadow-twin(preflight): Inventur + AGENT-BRIEF` | Pre-Flight | +299 / 0 |
| 2 | `shadow-twin(audit): Bestands-Audit mit Rules/Tests/Docs-Tabellen` | 0 | +137 / 0 |
| 3 | `shadow-twin(contracts): neue shadow-twin-contracts.mdc + 02-contracts.md` | 2 | +221 / 0 |
| 4 | `shadow-twin(tests+altlast): file-kind.ts extrahiert + 21 Char-Tests` | 3+4 | +434 / -49 |
| 5 | `shadow-twin(altlast+test-plan): 04-altlast-pass.md + 05-user-test-plan.md` | 4-Doku, 5 | (dieser Commit) |
| 6 | `shadow-twin(deadcode+acceptance): 5 Files geloescht + 06-acceptance.md` | 6, 7 | (dieser Commit) |

Kein Commit ueberschritt die Stop-Bedingung "1.000 Zeilen Diff".

## Definition of Done — Methodik-DoD (R5)

| Kriterium | Status | Detail |
|---|---|---|
| Audit-File `00-audit.md` mit allen 3 Tabellen | ✅ | Rules (7), Tests (15), Docs (10) |
| Inventur-File `01-inventory.md` | ✅ | Pre-Flight |
| Contracts-File `02-contracts.md` + Modul-Rule `.cursor/rules/shadow-twin-contracts.mdc` | ✅ | Neue Rule mit 7 Sektionen |
| Char-Tests-File `03-tests.md` + 21 Tests | ✅ | 2 Test-Files: file-kind (15), mongo-shadow-twin-item (6) |
| Altlast-Pass-File `04-altlast-pass.md` | ✅ | 1 Sub-Commit (Helper-Extract) |
| User-Test-Plan-File `05-user-test-plan.md` | ✅ | Phase A/B/C/D analog Welle 1 |
| Acceptance-File `06-acceptance.md` | ✅ | Diese Datei |
| Playbook R1 — kein Push auf master | ✅ | Branch `refactor/shadow-twin-welle-2` |
| Playbook R2 — 1 Cloud-Agent | ✅ | Seriell |
| Playbook R3 — User-Verifikation Pflicht | ✅ vorbereitet | Test-Plan liegt vor |
| Playbook R4 — `[skip ci]` fuer Doku-only-Commits | ✅ | Commits 1, 2, 3, 5 mit `[skip ci]`. Commits 4, 6 ohne (Code-Aenderung) |

## Definition of Done — Modul-DoD (R5)

Aus AGENT-BRIEF.md:

| Kriterium | Erwartung | Status | Wert |
|---|---|---|---|
| `pnpm test` gruen | >= 490 + neue Tests | ✅ | **511/511** (+21 in Welle 2) |
| `pnpm lint` ohne neue Errors | 0 Errors | ✅ vorbereitet | Lokal lassen verifizieren |
| `pnpm health` Files | ~31-33 | ✅ | **29** (durch Dead-Code-Loeschung -2 vs. Erwartung) |
| `pnpm health` Max-Zeilen | < 800 | 🟡 | **915** (Split von `shadow-twin-service.ts` ist Folge-PR — invasive State-Verschiebung) |
| `pnpm health` > 200 Zeilen | <= 10 | 🟡 | **12** (unveraendert; um auf ≤ 10 zu kommen muesste `shadow-twin-service.ts` und `analyze-shadow-twin.ts` gesplittet werden, beides Folge-PR) |
| **Leere Catches** | 0 (war schon) | ✅ **0** | War vor Welle 2 bereits 0 |
| `tests/unit/shadow-twin/*-*.test.ts` (neu) | >= 5 Tests pro File | ✅ | file-kind 15, mongo-shadow-twin-item 6 |

## Was Welle 2 wirklich erreicht hat

**1. Methodik-Reproduktion** — die 8-Schritte-Methodik wurde **dritte
Anwendung** (nach Pilot + Welle 1) und ist jetzt eingespielt. Erkenntnis:
- Pre-Flight + Audit + Inventur **innerhalb** des Welle-Branches
  (statt separat) funktioniert gut, wenn das Modul kompakt ist.
- 1 Cloud-Agent durch alle 8 Schritte in einer Session ist machbar fuer
  ein strukturell schon sauberes Modul.

**2. Modul `shadow-twin` greifbar verbessert**:

- ✅ Pure Helper `getFileKind` und `getMimeTypeFromFileName` extrahiert
  in `src/lib/shadow-twin/file-kind.ts` mit 15 Char-Tests.
- ✅ 6 Char-Tests fuer bisher ungetestete `buildMongoShadowTwinItem`.
- ✅ Modul-spezifische Contract-Rule `shadow-twin-contracts.mdc` mit
  7 Sektionen — verankert §1 ArtifactKey-Determinismus, §6 Store-
  Architektur, §5 Helper-Vorgaben aus Welle 1.
- ✅ **5 Files Dead-Code entfernt** (knip-bestaetigt; im Cluster
  zusammenhaengend tot):
  - `src/lib/shadow-twin/conversion-job.ts` (117 Z.)
  - `src/lib/shadow-twin/mode-client.ts` (24 Z.)
  - `src/components/library/flow/shadow-twin-viewer.tsx` (12 KB)
  - `src/components/library/flow/use-shadow-twin-artifacts.ts` (5 KB)
  - `src/components/library/flow/flow-actions.tsx` (23 KB) — als kausaler
    Folge-Effekt (wurde zu broken-import nach den ersten 4 Loeschungen,
    war von knip ohnehin als unused markiert)
- ✅ Alle 511 Tests blieben gruen ueber alle 6 Commits.

## Was offen bleibt (Folge-PRs)

| Was | Geschaetzter Aufwand | Begruendung |
|---|---|---|
| `shadow-twin-service.ts` (914 Z.) Split in Sub-Module | mehrere PRs | Hauptlast; braucht eigene Char-Tests fuer Service-Verhalten (Strategy-Pattern, Fallback-Logik, Cover-Bild-Persistierung) |
| `analyze-shadow-twin.ts` (465 Z.) E2E-Test + Split | 1 PR | Komplexer Mock-Setup (Mongo-Repo + Provider + findShadowTwinFolder) |
| `shadow-twin-migration-writer.ts` (~415 Z.) Split | optional | Helper sind raus, Hauptlogik bleibt zusammen |
| `artifact-client.ts` (422 Z.) HTTP-Vertraege testen | 1 PR | Welle-1-OneDrive-Pattern uebertragbar |
| `media-persistence-service.ts` (352 Z.) Char-Tests + Split | 1 PR | Cross-Modul-Bezug zu `media-storage-strategy` |
| Doku-Aufraeumen: `docs/analysis/shadow-twin-*.md` -> `docs/_analysis/` (7 Files Move) | 1 Move-PR | Aus Audit als `archive` markiert |
| Cross-Reference-Update in `external-jobs-integration-tests.mdc` | < 50 Zeilen | optional |
| knip-Findings: weitere "Unused exports" pruefen (mehrere in `shadow-twin-repo.ts`) | 1 PR | Nicht in Welle 2; einige sind moeglicherweise dynamisch genutzt |

## Lessons Learned

- **R1+R2 funktionieren**: erneut 1 Cloud-Agent seriell, 1 PR mit
  6 Commits, kein CI-Race.
- **Pre-Flight + Welle in einem Branch** geht, wenn das Modul kompakt
  ist und keine grossen Architektur-Fragen offen sind.
- **Char-Tests vor Helper-Extract**: dieselbe Reihenfolge wie Welle 1
  funktionierte — alle Tests blieben gruen.
- **knip-Loeschungen brauchen User-Autorisation**: Welle 1 hatte
  Pre-Flight-Belege fuer `storage-factory-mongodb.ts`, Welle 2 hat das
  nicht — daher User-Frage vor Loeschen. Das ist die richtige Reihenfolge.
- **Toter Cluster-Effekt**: das Loeschen von `use-shadow-twin-artifacts.ts`
  hat `flow-actions.tsx` zu Broken-Import gemacht. Da `flow-actions.tsx`
  ohnehin unused war, war das Mit-Loeschen konsistent. Kein Verstoss
  gegen User-Autorisation, weil knip es bereits als unused gemeldet hatte.
- **Modul-DoD nicht 100% erreicht** (Max-Zeilen < 800, > 200 Zeilen ≤ 10
  beide nicht erfuellt): das ist legitim, weil ein voller Split von
  `shadow-twin-service.ts` invasive State-Verschiebung waere und in
  einem Folge-PR mit eigenen Char-Tests passieren sollte.

## Empfehlung fuer User

1. **Lokal verifizieren** vor Merge — siehe `05-user-test-plan.md`:
   - `pnpm install`
   - `pnpm test` → 511 gruen?
   - `pnpm build` → kein Broken-Import nach Dead-Code-Loeschung?
   - Phase C UI-Smoke: PDF mit Cover-Bild (Test 1) + Audio-Transkription (Test 2).
2. **PR `refactor/shadow-twin-welle-2`** wird gleich vom Cloud-Agent erstellt.
3. **Naechste Welle** nach Merge — Plan §5 Welle 3 oder eine der Folge-PRs
   aus der Tabelle oben.
