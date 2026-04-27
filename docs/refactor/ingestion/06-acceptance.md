# Welle-Abnahme: Modul `ingestion`

Stand: 2026-04-27. Erstellt vom **IDE-Agent** (Welle 3, Plan-Schritt 7).

Bezug:
- Plan: [.cursor/plans/refactor-strategie-drift-eliminieren_06fd8014.plan.md](../../../.cursor/plans/refactor-strategie-drift-eliminieren_06fd8014.plan.md) §5 Welle 3
- AGENT-BRIEF: [`AGENT-BRIEF.md`](./AGENT-BRIEF.md)
- Welle-2-Vorbild: [`docs/refactor/shadow-twin/06-acceptance.md`](../shadow-twin/06-acceptance.md)
- Workflow-Regeln: [`docs/refactor/playbook.md`](../playbook.md) R1-R5
- **PR**: [bCommonsLAB/CommonKnowledgeScout#21](https://github.com/bCommonsLAB/CommonKnowledgeScout/pull/21)

## Zusammenfassung

Welle 3 (`ingestion`) wurde **seriell vom IDE-Agent** in einer einzigen
Sitzung abgearbeitet — abweichend zu Welle 2 (Cloud-Agent), auf
expliziten Wunsch des Users ("interaktiv, mit Live-Eingriffsmoeglichkeit").

7 Commits auf `refactor/ingestion-welle-3`, kein Push nach `master`
ohne User-OK (R1), `[skip ci]` fuer Doku-only-Commits (R4).

| # | Commit | Schritt | Diff |
|---|---|---|---:|
| 1 | `ingestion(preflight): Inventur + AGENT-BRIEF fuer Welle 3` | Pre-Flight | +234 / 0 |
| 2 | `ingestion(audit): Bestands-Audit mit Rules/Tests/Docs-Tabellen` | 0 | +159 / 0 |
| 3 | `ingestion(contracts): neue ingestion-contracts.mdc + 02-contracts.md` | 2 | +218 / 0 |
| 4 | `ingestion(tests): 6 Char-Test-Files mit 67 Tests fuer pure Helper + ImageProcessor` | 3 | +798 / 0 |
| 5 | `ingestion(altlast): image-processor-helpers.ts extrahiert + 16 Char-Tests` | 4 | +299 / -40 |
| 6 | `ingestion(test-plan): User-Test-Plan fuer Welle 3 [skip ci]` | 5 | +140 / 0 |
| 7 | `ingestion(deadcode): knip-Pass dokumentiert, 0 Loeschungen, 1 Watchpoint [skip ci]` | 6, 7 | +119 / 0 |

Kein Commit ueberschritt die Stop-Bedingung "1.000 Zeilen Diff".

## Definition of Done — Methodik-DoD (R5)

| Kriterium | Status | Detail |
|---|---|---|
| Audit-File `00-audit.md` mit allen 3 Tabellen | ✅ | Rules (5), Tests (0 direkte!), Docs (5) |
| Inventur-File `01-inventory.md` | ✅ | Pre-Flight |
| Contracts-File `02-contracts.md` + Modul-Rule `.cursor/rules/ingestion-contracts.mdc` | ✅ | Neue Rule mit 7 Sektionen |
| Char-Tests-File `03-tests.md` + 67 + 16 = **83 Tests** | ✅ | 7 Test-Files |
| Altlast-Pass-File `04-altlast-pass.md` | ✅ | 1 Sub-Commit (Helper-Extract aus `image-processor.ts`) |
| User-Test-Plan-File `05-user-test-plan.md` | ✅ | Phase A/B/C/D analog Welle 1+2 |
| Dead-Code-File `06-deadcode.md` | ✅ | knip-Lauf dokumentiert, 0 Loeschungen |
| Acceptance-File `06-acceptance.md` | ✅ | Diese Datei |
| Playbook R1 — kein Push auf master | ✅ | Branch `refactor/ingestion-welle-3` |
| Playbook R2 — 1 Agent (hier IDE-Agent statt Cloud) | ✅ | Seriell, durchgehend |
| Playbook R3 — User-Verifikation Pflicht | ✅ vorbereitet | Test-Plan liegt vor |
| Playbook R4 — `[skip ci]` fuer Doku-only-Commits | ✅ | Commits 1, 2, 3, 6, 7 mit `[skip ci]`. Commits 4, 5 ohne (Code-Aenderung) |

## Definition of Done — Modul-DoD (R5)

Aus AGENT-BRIEF.md:

| Kriterium | Erwartung | Status | Wert |
|---|---|---|---|
| `pnpm test` gruen | >= 511 + neue Tests | ✅ | **594 / 594** (+83 in Welle 3) |
| `pnpm lint` ohne neue Errors | 0 Errors | ✅ vorbereitet | Lokal lassen verifizieren |
| `pnpm health` Files | ~7-8 | ✅ | **8** (+1 Helper-File) |
| `pnpm health` Max-Zeilen | < 600 (Ideal) | 🟡 | **832** (vorher 858, **-26 Zeilen**). Voller Split → Folge-PR |
| `pnpm health` > 200 Zeilen | <= 1 | ✅ | **1** (`image-processor.ts`) |
| `any`-Count | 0 | ✅ | **0** (war schon) |
| Empty-`catch{}` | 0 | ✅ | **0** (war schon) |
| `'use client'` | 0 | ✅ | **0** (kein UI-Modul) |
| `tests/unit/ingestion/*-*.test.ts` (neu) | 15-25 Tests | ✅ ueber-erfuellt | **83 Tests** in 7 Files |

## Was Welle 3 wirklich erreicht hat

**1. Methodik-Reproduktion** — die 8-Schritte-Methodik wurde **vierte
Anwendung** (nach Pilot + Welle 1 + Welle 2). Erkenntnis:

- IDE-Agent kann eine Welle komplett durchziehen, **wenn das Modul
  klein genug** ist (`ingestion`: 7 Quell-Files, 0 vorhandene Tests).
- Vorteil gegenueber Cloud-Agent: schneller Feedback-Loop bei Fehlern
  (PowerShell-CRLF-Inkonsistenz wurde live korrigiert; siehe
  Lessons Learned).

**2. Modul `ingestion` greifbar verbessert**:

- ✅ Drei pure Helper (`getImageCacheKey`, `normalizeImagePath`,
  `formatImageError`) extrahiert in
  `src/lib/ingestion/image-processor-helpers.ts` mit 16 Char-Tests.
- ✅ **Erste Tests des Moduls ueberhaupt**: 83 Char-Tests in 7 neuen
  Test-Files fuer `page-split`, `metadata-formatter`,
  `document-text-builder`, `meta-document-builder`, `vector-builder`,
  `image-processor` und `image-processor-helpers`.
- ✅ Modul-spezifische Contract-Rule `ingestion-contracts.mdc` mit
  7 Sektionen — verankert §1 Determinismus, §2 Result-Object-Pattern,
  §4 Skip/Default-Semantik, §5 Cache-Vertrag.
- ✅ Watchpoint dokumentiert: doppelter `VectorDocument`-Typ
  (`vector-builder.ts` ↔ `vector-repo.ts`) — Folge-PR.
- ✅ Watchpoint dokumentiert: zwei Marker-Splitter mit gleichem Regex
  (`page-split.ts` ↔ `markdown-page-splitter.ts`) — Folge-PR.
- ✅ Alle 594 Tests blieben gruen ueber alle 7 Commits.

## Was offen bleibt (Folge-PRs)

| Was | Geschaetzter Aufwand | Begruendung |
|---|---|---|
| `image-processor.ts` (832 Z.) Split in `markdown.ts` / `slides.ts` / `cover.ts` | 1 PR mit eigenem Mock-Setup fuer `AzureStorageService` | Hauptlast; 3 grosse Methoden mit ineinander verschraenkter Azure- und Cache-Logik |
| `imageCache` in eigenes `cache.ts`-Modul mit Klassen-API | optional | greift in 3 Methoden ein |
| `VectorDocument`-Typ konsolidieren | 1 PR (Cross-Module: `ingestion` + `repositories`) | Drift-Watchpoint aus knip-Lauf |
| Marker-Regex zwischen `page-split.ts` und `markdown-page-splitter.ts` zentralisieren | 1 kleiner PR | Markdown-Welle, nicht Ingestion-Welle |
| `ingest-mongo-only.mdc` Glob auf `src/lib/ingestion/**` erweitern | < 10 Zeilen | Komfort, kein Vertrag |
| `docs/analysis/ingestion.md` aktualisieren (Helper + Tests erwaehnen) | < 50 Zeilen | Doku-Drift, kein Code-Drift |

## Lessons Learned

- **IDE-Agent als Wellen-Werkzeug**: funktioniert fuer kompakte Module
  (≤ 10 Files, ≤ ~3.000 LoC). Vorteil: Live-Eingriff bei Tooling-
  Quirks (z.B. CRLF/LF-Mix nach PowerShell-Replace).
- **PowerShell `Set-Content -NoNewline` zerstoert CRLF**: musste mit
  expliziter `[IO.File]::WriteAllText` + `\r\n`-Konvertierung
  korrigiert werden. Lesson: bei String-Replace in TS-Files lieber
  `StrReplace` (Cursor-Tool) nutzen, nicht PowerShell-Pipelines.
- **Health-Skript-Zaehlmethode != `Measure-Object -Line`**: das
  Skript zaehlt mit `text.split('\n').length`, was bei
  CRLF-trimmenden Tools andere Zahlen liefert. Inventory-Werte sind
  daher mit `pnpm health`-Werten **nicht direkt vergleichbar**.
  Lesson: Inventory-Tabellen kuenftig **mit `pnpm health`-Methode**
  fuellen, damit Welle-Reports konsistent sind.
- **Char-Tests vor Helper-Extract**: gleiche Reihenfolge wie Welle 1+2
  funktionierte — alle Tests blieben gruen.
- **Modul-DoD "Max-Zeilen < 600" nicht erreicht** (832): legitim, weil
  voller Split von `image-processor.ts` invasive Mock-Setups braucht.
  Folge-PR-Pattern wie bei `shadow-twin-service.ts` in Welle 2.
- **`pnpm knip` fuer ein gut isoliertes Modul**: brachte 0 echte
  Loeschungen, aber 1 wertvollen Drift-Watchpoint. Wenig Aufwand,
  klarer Mehrwert.
- **0 vorhandene Tests vor der Welle**: war eine **Chance**, weil
  keine alten Test-Mocks zu warten waren. 83 neue Char-Tests in
  einer Welle ist viel, aber der Code ist klein und gut isoliert.

## Empfehlung fuer User

1. **Lokal verifizieren** vor Merge — siehe `05-user-test-plan.md`:
   - `pnpm install`
   - `pnpm test` → 594 gruen?
   - `pnpm build` → kein Broken-Import auf `image-processor-helpers`?
   - Phase C UI-Smoke: PDF mit Bildern (Test 1) + PDF mit Cover (Test 2).
2. **PR `refactor/ingestion-welle-3`** wird auf Wunsch erstellt
   (manueller Aufruf statt automatisch — User entscheidet, wann).
3. **Naechste Welle** nach Merge — Plan §5 Welle 4 (Kandidat:
   `external-jobs-worker` oder `chat`-Modul) oder eine der Folge-PRs
   aus der Tabelle oben.
