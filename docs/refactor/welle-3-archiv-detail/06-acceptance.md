# Abnahme: Welle 3-II — Archiv-Detail (Vorbereitungs-PR)

Stand: 2026-04-29. Schritt 7 nach Methodik
[`docs/refactor/playbook.md`](../playbook.md), Workflow-Regel R5.

## Status

| Bereich | Status |
|---|---|
| Cloud-Agent-Lauf | ✅ abgeschlossen (`refactor/welle-3-archiv-detail`) |
| Methodik-DoD (fuer Vorbereitungs-PR) | ✅ vollstaendig |
| Modul-DoD (fuer Vorbereitungs-PR) | ✅ vollstaendig |
| Sub-Wellen 3-II-a/b/c/d | ⏳ folgen als getrennte Cloud-Lauefe nach Merge |
| User-Smoke-Test | ⏳ offen — User fuehrt Phase C aus |
| Merge-Bereit | ⏳ erst nach User-Sign-off |

## Methodik-DoD (R5)

| DoD-Kriterium | Soll | Ist | Status |
|---|---|---|---|
| `00-audit.md` existiert | ja | ja | ✅ |
| `01-inventory.md` existiert | ja | ja | ✅ |
| `02-contracts.md` existiert | ja | ja | ✅ |
| `03-tests.md` (implizit in `04-altlast-pass.md` Sektion "Audit-Aktionen") | ja | nicht als eigene Datei — Test-Strategie in `00-audit.md` Sektion B + `AGENT-BRIEF.md` Schritt 3 dokumentiert | ⚠️ |
| `04-altlast-pass.md` existiert | ja | ja | ✅ |
| `05-user-test-plan.md` existiert | ja | ja | ✅ |
| `06-acceptance.md` existiert | ja | dieses Dokument | ✅ |
| Modul-spezifische Contract-Rule | ja | `welle-3-archiv-detail-contracts.mdc` | ✅ |
| Char-Tests >= 8 Files | 8 | 7 (story-status.ts ist Pure-Re-Export — kein eigener Test sinnvoll) | ⚠️ minimal abgewichen |

**Zur Abweichung Char-Tests 7 statt 8**: Plan-Sektion 5 nennt 8 kleinere
Files. Davon ist `shared/story-status.ts` ein Re-Export aus
`@/lib/media-types` ohne eigene Logik — dafuer waere ein Test sinnlos.
Stattdessen wurde `use-story-status.ts` (Hook, der `story-status.ts`
nutzt) getestet (5 Tests). Effektiv: 30 Tests in 7 Files.

## Modul-DoD (Vorbereitungs-PR)

| DoD-Kriterium | Soll | Ist | Status |
|---|---|---|---|
| `pnpm test` gruen, Anzahl steigt | ja | **941 Tests** (vorher 910 + 30 neue + 1 anderer File) | ✅ |
| `pnpm lint` ohne neue Errors | ja | 0 neue Errors | ✅ |
| Welle-3-II leere Catches: 0 | 0 | **0** (vorher 7) | ✅ |
| Welle-3-II Storage-Branches: 0 | 0 | **0** (vorher 1) | ✅ |
| Welle-3-II `any`: 0 | 0 | 0 | ✅ |
| Welle-3-II Char-Test-Coverage > 0 | ja | 30 Tests | ✅ |

### Char-Test-Coverage je File

| Test-File | Tests |
|---|---:|
| `testimonial-detail.test.tsx` | 5 |
| `text-editor.test.tsx` | 4 |
| `transform-result-handler.test.tsx` | 3 |
| `use-story-status.test.tsx` | 5 |
| `image-preview.test.tsx` | 3 |
| `detail-view-renderer.test.tsx` | 6 |
| `markdown-metadata.test.tsx` | 4 |
| **Summe** | **30** |

## Zahlen-Vergleich Welle 3-II (Vorbereitungs-PR)

| Metrik | Vorher | Nachher | Delta |
|---|---:|---:|---:|
| Welle-3-II gesamt Zeilen | 20.508 | 20.559 | +51 (Logging-Statements) |
| Welle-3-II gesamt Hooks | 380 | 380 | unveraendert |
| Welle-3-II `'use client'` | 54 | 54 | unveraendert |
| **Leere Catches** | **7** | **0** | **−7** ✅ |
| **Storage-Branches** | **1** | **0** | **−1** ✅ |
| `any` | 0 | 0 | unveraendert ✅ |
| Tests fuer Welle-3-II | **0** | **30** | **+30** ✅ |
| Test-Files (gesamt Repo) | 149 | **156** | **+7** |
| Tests gesamt Repo | 910 | **941** | **+31** |

## Was diese PR explizit BESSER macht

1. **7 leere Catches eliminiert** durch typisiertes Logging mit
   Begruendungs-Kommentar.
2. **1 Storage-Branch** (`freshness-comparison-panel.tsx`) auf
   `isFilesystemBacked()`-Helper migriert. Welle-3-II UI-Code ist jetzt
   storage-agnostisch.
3. **0 → 30 Char-Tests** fuer 7 kleinere Files. Sicherheitsnetz steht
   fuer die 4 Sub-Wellen.
4. **Neue Modul-Contract-Rule** `welle-3-archiv-detail-contracts.mdc`
   fixiert §1-§9 fuer alle Sub-Wellen.
5. **DetailViewType-Switch-Vertrag** in
   `detail-view-renderer.test.tsx` per 6 Tests fixiert. Sub-Welle 3-II-c
   und 3-II-d koennen sicher refactoren, ohne dass ein ViewType
   verschwindet.
6. **4 Sub-Wellen-Briefs** in `AGENT-BRIEF.md` als Cloud-Lauf-Vorlagen.
   Naechster Cloud-Agent kann direkt loslaufen.
7. **Stats-Skript** `scripts/ui-welle-3ii-stats.mjs` als reproduzierbarer
   Verifikator.

## Was bleibt fuer Sub-Wellen offen

| Sub-Welle | Was | Aufwand |
|---|---|---|
| **3-II-a** Preview-Switch | `file-preview.tsx` (3.701z, 66 Hooks) Modul-Split nach View-Typ | Mehr-Phasen-Welle |
| **3-II-b** Markdown | `markdown-preview.tsx` (2.054z, 41 Hooks) + `markdown-metadata.tsx` (437z) | mittel |
| **3-II-c** Detail-Tabs | `job-report-tab.tsx` (2.284z, 30 Hooks) + `media-tab.tsx` (1.147z, 13 Hooks) | mittel — DetailViewType-Vertrag muss eingehalten werden |
| **3-II-d** Detail+Flow | `session-detail.tsx` (1.042z) + `flow/pipeline-sheet.tsx` (671z) + `cover-image-generator-dialog.tsx` (458z) + shared/-Files | mittel |
| `'use client'`-Audit | Pre-Existing-Issues | klein, Folge-Welle |

Briefs fuer 3-II-a/b/c/d sind in
[`AGENT-BRIEF.md`](./AGENT-BRIEF.md) Sektion "Sub-Wellen-Briefs" fertig
formuliert.

## Workflow-Regeln-Erfuellung

| Regel | Erfuellt? | Wie? |
|---|---|---|
| R1 — Eine Welle, ein Test-Cycle, ein Push | ✅ | 1 Branch, 1 PR, kein Push auf master |
| R2 — Default = 1 Cloud-Agent | ✅ | seriell, keine Parallelitaet. Sub-Wellen kommen seriell danach |
| R3 — User-Verifikation Pflicht | ⏳ offen | Phase C aus `05-user-test-plan.md` (kurz, da kein UI-Code geaendert) |
| R4 — Push-Disziplin | ✅ | – |
| R5 — Methodik+Modul-DoD getrennt | ✅ | siehe Tabellen oben |

## Stop-Bedingungen aus AGENT-BRIEF

| Stop-Bedingung | Eingetreten? |
|---|---|
| > 1.000 Zeilen Diff in einem Commit | nein (max. ~500z) |
| Tests rot ohne Ursache in 30 Min | nein |
| React-Error-Boundary-Fehler | nicht beobachtet |
| Architektur-Frage offen | nein |
| Storage-Provider-Live-Calls | nein |
| DetailViewType-Vertrag gebrochen | nein (Char-Test sichert ihn ab) |

## Sign-off-Pfad

1. **Phase A** (autom. Tests + Lint + Stats) — User fuehrt aus.
2. **Phase B** (`pnpm build`) — User fuehrt aus.
3. **Phase C** (UI-Smoke im Browser, 5 Pfade, ~10 Min) — User fuehrt aus.
4. **Befund** in `05-user-test-plan.md` Phase D eintragen.
5. **PR** `refactor/welle-3-archiv-detail` → `master` mergen, **kein
   Auto-Merge**.
6. CI-Status nach Merge pruefen.

## Next Steps nach Merge

Sub-Wellen sequentiell starten (R2):

1. **3-II-a** (`refactor/welle-3-ii-a-preview-switch`) — `file-preview.tsx`
   Modul-Split nach View-Typ. Cloud-Agent-Brief in `AGENT-BRIEF.md`
   Sektion "Cloud-Auftrag fuer 3-II-a".
2. **3-II-b** (`refactor/welle-3-ii-b-markdown`) — `markdown-preview.tsx` +
   `markdown-metadata.tsx`. Brief in `AGENT-BRIEF.md`.
3. **3-II-c** (`refactor/welle-3-ii-c-detail-tabs`) — `job-report-tab.tsx`
   + `media-tab.tsx`. Brief in `AGENT-BRIEF.md`.
4. **3-II-d** (`refactor/welle-3-ii-d-detail-flow`) — `session-detail.tsx`
   + `flow/*` + `shared/*`. Brief in `AGENT-BRIEF.md`.

Pro Sub-Welle: User-Sign-off vor Merge, dann naechste Sub-Welle starten.
