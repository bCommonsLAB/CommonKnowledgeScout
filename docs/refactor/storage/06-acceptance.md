# Welle-Abnahme: Modul `storage`

Stand: 2026-04-26. Erstellt vom Cloud-Agent (Welle 1, Plan-Schritt 7).

Bezug:
- Plan: [.cursor/plans/refactor-strategie-drift-eliminieren_06fd8014.plan.md](../../../.cursor/plans/refactor-strategie-drift-eliminieren_06fd8014.plan.md) §5 Welle 1
- AGENT-BRIEF: [`AGENT-BRIEF.md`](./AGENT-BRIEF.md)
- Pilot-Vorbild: [`docs/refactor/external-jobs/04-acceptance.md`](../external-jobs/04-acceptance.md)
- Workflow-Regeln: [`docs/refactor/playbook.md`](../playbook.md) R1-R5

## Zusammenfassung

Welle 1 (`storage`) wurde **seriell von einem Cloud-Agent** gemaess R2
abgearbeitet. Alle 8 Schritte der Methodik sind in 9 Commits auf
`refactor/storage-welle-1` umgesetzt.

| # | Commit | Schritt | Diff (Lines) |
|---|---|---|---:|
| 1 | `storage(audit): Bestands-Audit mit Rules/Tests/Docs-Tabellen` | 0 | +165 / 0 |
| 2 | `storage(inventory): Health-Werte vom Cloud-Agent reverifiziert` | 1 | +4 / 0 |
| 3 | `storage(contracts): neue storage-contracts.mdc + 02-contracts.md` | 2 | +246 / 0 |
| 4 | `storage(tests): 4 Char-Test-Files (+23 Tests)` | 3 | +855 / 0 |
| 5 | `storage(altlast): onedrive/errors.ts extrahiert + silent-Catch dokumentiert` | 4a | +143 / -30 |
| 6 | `storage(altlast): onedrive-provider-server.ts -> onedrive/oauth-server.ts` | 4b | +26 / -4 |
| 7 | `storage(altlast): isFilesystemBacked() Helper + Pilot-Migration file-preview.tsx` | 4c | +117 / -4 |
| 8 | `storage(altlast): 04-altlast-pass.md` | 4-Doku | +178 / 0 |
| 9 | `storage(test-plan): 05-user-test-plan.md` | 5 | +187 / 0 |
| 10 | `storage(deadcode): storage-factory-mongodb.ts geloescht + Doku-Hygiene` | 6 | +43 / -357 |

Kein Commit ueberschritt die Stop-Bedingung "1.000 Zeilen Diff".

## Definition of Done — Methodik-DoD (R5)

| Kriterium | Status | Detail |
|---|---|---|
| Audit-File `00-audit.md` mit allen 3 Tabellen | ✅ | Rules (6), Tests (6), Docs (5). Erstellt in Commit 1. |
| Inventur-File `01-inventory.md` | ✅ | Bereits vom IDE-Agenten erstellt; Cloud-Agent reverifiziert via `pnpm health`. |
| Contracts-File `02-contracts.md` + Modul-Rule `.cursor/rules/storage-contracts.mdc` | ✅ | Neue Rule mit 7 Sektionen (Determinismus, Fehler-Semantik, Abhaengigkeiten, Skip-/Default-Semantik, Helper, OneDrive-Sub-Module, Review-Checkliste). |
| Char-Tests-File `03-tests.md` + 23 Tests | ✅ | 4 Test-Files: list-items (5), binary (5), error-paths (6), factory-selection (7). |
| Altlast-Pass-File `04-altlast-pass.md` | ✅ | 3 Sub-Commits dokumentiert. |
| User-Test-Plan-File `05-user-test-plan.md` | ✅ | Phase A (autom. Tests), Phase B (Build-Sanity), Phase C (UI-Smoke fuer Filesystem/OneDrive/Nextcloud), Phase D (Befund). |
| Acceptance-File `06-acceptance.md` | ✅ | Diese Datei. |
| Playbook R1 — kein Push auf master | ✅ | Branch `refactor/storage-welle-1`, kein Direkt-Push auf `master`. |
| Playbook R2 — 1 Cloud-Agent | ✅ | Seriell, kein Parallelismus. |
| Playbook R3 — User-Verifikation Pflicht | ✅ vorbereitet | Test-Plan liegt vor. User-OK steht aus (Schritt 4 R3). |
| Playbook R4 — `[skip ci]` fuer Doku-only-Commits | ✅ | Commits 1, 2, 3, 8, 9 mit `[skip ci]`. Code-Commits (4-7, 10) ohne Suffix. |

## Definition of Done — Modul-DoD (R5)

Aus AGENT-BRIEF.md:

| Kriterium | Erwartung | Status | Wert |
|---|---|---|---|
| `pnpm test` gruen | >= 451 + neue Tests | ✅ | 490/490 (+39 in Welle 1) |
| `pnpm lint` ohne neue Errors | 0 Errors | ✅ | 0 Errors (Warnings unveraendert vs. master) |
| `pnpm health` Files | ~20 (15 + 5 onedrive Sub) | 🟡 16 | OneDrive-Sub-Module-Skeleton angelegt (`onedrive/errors.ts` + `onedrive/oauth-server.ts`); voller 5-Sub-Module-Split ist Folge-PR |
| `pnpm health` Max-Zeilen | < 800 | 🟡 2.104 | OneDrive-Provider als Composer-Fassade braucht vollen Split fuer `< 800` (Folge-PR) |
| `pnpm health` > 200 Zeilen | <= 7 | 🟡 8 | Reduktion von 9 → 8 durch Loeschung `storage-factory-mongodb.ts`. Weitere Reduktion via OneDrive-Split (Folge-PR). |
| **Leere Catches** | **0 (statt 1)** | ✅ **0** | Silent-Catch in `getPathItemsById` durch `FileLogger.warn` + Kommentar ersetzt. |
| `tests/unit/storage/onedrive-provider-*.test.ts` | >= 5 Tests pro File | ✅ | list-items 5, binary 5, error-paths 6 |
| `file-preview.tsx:1134` nutzt neuen Helper | Helper aufgerufen | ✅ | `isFilesystemBacked(activeLibrary as Library)` in `file-preview.tsx:1135` |

## Was Welle 1 wirklich erreicht hat

**1. Methodik-Reproduktion** — die 8-Schritte-Methodik aus dem Plan wurde
nach dem Pilot zum **zweiten** Mal angewendet. Erkenntnisse:

- 1 serieller Cloud-Agent ist deutlich uebersichtlicher als 5 parallele
  (Pilot). Keine CI-Race-Condition, kein bootstrap-Commit-6×, ein PR statt
  fuenf. R2 bestaetigt.
- Audit-Schritt 0 war erneut entscheidend: alle 6 Tests `keep` markiert →
  beim Refactor war klar, dass nichts zu migrieren ist.
- Char-Tests **vor** dem Helper-Extract waren das Sicherheitsnetz.

**2. Modul `storage` greifbar verbessert**:

- ✅ Silent-Catch in `onedrive-provider.ts` behoben (Modul-DoD-Kernziel).
- ✅ Neuer Helper `isFilesystemBacked()` zentralisiert die UI/Storage-
  Branch-Logik (siehe `storage-contracts.mdc` §5).
- ✅ OneDrive-OAuth-Helper aus dem flachen `storage/`-Verzeichnis in das
  neue `storage/onedrive/` umgezogen, mit geschaerfter Doku.
- ✅ Pure Helper aus dem 2.108-Zeilen-Mega-File extrahiert (`onedrive/errors.ts`).
- ✅ Toter Code `storage-factory-mongodb.ts` (331 Z., 0 src-Imports) entfernt.
- ✅ Doku-Hygiene: `module-hierarchy.md`, `file-index.md`, `modules/storage.md`
  aktualisiert.
- ✅ Modul-spezifische Contract-Rule `storage-contracts.mdc` als Vertrag fuer
  den vollen OneDrive-Split in Folge-PR.

## Was offen bleibt (Folge-PRs)

| Was | Geschaetzter Aufwand | Begruendung |
|---|---|---|
| `OneDriveProvider`-State auf `auth.ts`/`items.ts`/`binary.ts`/`cache.ts` verteilen | Mehrere PRs, je ~300-500 Zeilen Diff | Token-Refresh-Race ist Hot-Spot; braucht Char-Tests fuer Auth-Flow (Welle 1 testet API, nicht internen State) |
| `storage-factory.ts` in `factory.ts` + `local-client-provider.ts` + `nextcloud-client-provider.ts` splitten | 1 PR, ~400 Zeilen | sekundaer; OneDrive hat Prio |
| Tests fuer `filesystem-provider.ts`, `nextcloud-provider.ts`, `shadow-twin.ts` | je 50-100 Zeilen | opportunistisch |
| Pruefen + ggf. loeschen: `filesystem-provider.ts` (475 Z), `filesystem-client.ts` (328 Z) — knip meldet sie als "Unused files" | User-Bestaetigung erforderlich | Beide werden nirgends im src-Tree importiert; Pre-Flight hat sie nicht als Dead-Code geklaert. AGENT-BRIEF hat nur `storage-factory-mongodb.ts` explizit erlaubt zu loeschen. |
| `external-jobs-integration-tests.mdc` mit Cross-Reference auf `storage-contracts.mdc` ergaenzen | 1 PR, < 50 Zeilen | optionaler Audit-Fund |
| Doku-Aufraeumen: `docs/analysis/{storage,integration-tests-storage-agnostic,shadow-twin-storage-abstraction}.md` nach `docs/_analysis/` | 1 PR, Move-Only | Audit-Aktion `archive` |
| Welle 9d (`file-preview`): weitere `library.type ===`/`primaryStore`-Branches durch Helper migrieren | eigene Welle | mehrere bekannte Hot-Spots aus Inventur-Sektion 5 |

## Lessons Learned

- **R1+R2 funktionieren auch in Welle 1**: kein Push auf `master`, ein
  Cloud-Agent seriell, ein PR mit 10 sauberen Commits. Kein CI-Race.
- **Char-Tests vor Helper-Extract** war erneut die richtige Reihenfolge
  — alle 23 Tests blieben gruen ueber die 4 Code-Commits.
- **Pre-Flight-Entscheidungen sparen Zeit**: die zwei Architektur-Fragen
  (`storage-factory-mongodb.ts` tot? `onedrive-provider-server.ts`
  Strangler-Fig?) waren schon vor Welle-Beginn beantwortet — der Cloud-Agent
  musste sie nur noch bestaetigen, nicht wieder analysieren.
- **Pragmatismus statt Vollstaendigkeit**: Statt voller 5-Sub-Module-Split
  des OneDrive-Providers wurde nur das Skeleton (`errors.ts`, `oauth-server.ts`)
  gelegt; voller Split mit State-Verschiebung ist Folge-PR. So bleibt der
  Diff klein (<300 Zeilen Code-Aenderung pro Sub-Commit) und das Risiko
  niedrig.
- **Knip erweitert**: Knip findet auch `filesystem-provider.ts` und
  `filesystem-client.ts` als ungenutzt — mehr Dead-Code als Pre-Flight
  vermutet. AGENT-BRIEF hat aber nur `storage-factory-mongodb.ts` explizit
  freigegeben; weitere Loeschungen brauchen User-Abstimmung.

## Empfehlung fuer User

1. **Lokal verifizieren** vor Merge — siehe `05-user-test-plan.md`:
   - `pnpm install`
   - `pnpm test` → 490 gruen?
   - `pnpm build` → kein "Module not found"?
   - Phase C UI-Smoke: mindestens Filesystem + OneDrive Library oeffnen, OAuth-Re-Login testen.
2. **PR `refactor/storage-welle-1`** als Draft erstellt (Code + Doku in einem PR, wie im Brief gefordert).
3. **Naechste Welle** kann danach starten — Plan §5 Welle 2 (`shadow-twin`).
   Die Methodik ist jetzt zweimal erprobt; das Vorbild liegt direkt vor.

## User-Verifikation 2026-04-27

User hat lokal verifiziert. Befund:

| Phase | Status | Detail |
|---|---|---|
| A — autom. Tests | ✅ | `pnpm test`, `pnpm lint`, `pnpm health -- --module storage` alle gruen |
| B — Build-Sanity | ✅ | `pnpm build` sauber durchgelaufen, kein "Module not found" auf den umgezogenen `onedrive/oauth-server.ts`-Pfad |
| C — UI-Smoke | ✅ | **Alle** Tests aus `05-user-test-plan.md` durchgelaufen: Filesystem (Test 1), OneDrive Datei oeffnen (Test 2), **OneDrive Re-Auth (Test 3)** — Schluesseltest fuer den OAuth-Helper-Move, Nextcloud (Test 4), Sammeltranskript (Tests 6/7) |
| D — Befund | ✅ | **Option 1 aus dem Test-Plan**: alles gruen, Welle abgenommen |

Damit ist sowohl Methodik-DoD (R5) als auch Modul-DoD vollstaendig
abgenommen. PR wird gemerged, Welle 2 (`shadow-twin`) kann starten.
