# Inventur: Modul `external-jobs`

Stand: 2026-04-23. Erstellt von Cloud-Agent 2 (Pilot-Welle, Plan-Schritt 1).
Quelle: `node scripts/module-health.mjs --module external-jobs --json` plus manuelle Test-Zuordnung.

## 1. Modul-Health-Zusammenfassung (von `pnpm health`)

| Modul | Files | Max-Zeilen (Datei) | > 200 Zeilen | hat Tests | any | leere catch{} | use client |
|---|---:|---|---:|---|---:|---:|---:|
| `external-jobs` | 40 | 2.097 (`phase-template.ts`) | 14 | ja | 0 | **75** | 0 |
| `external-jobs-log-buffer` | 1 | 27 | 0 | nein | 0 | 0 | 0 |
| `external-jobs-repository` | 1 | 650 | 1 | nein | 0 | 4 | 0 |
| `external-jobs-watchdog` | 1 | 112 | 0 | nein | 0 | 0 | 0 |
| `external-jobs-worker` | 1 | 330 | 1 | nein | 0 | 2 | 0 |
| **Summe** | **44** | — | **16** | — | **0** | **81** | **0** |

**Kommentar**: 81 leere `catch {}`-Bloecke ueber 44 Files, davon 75 in `external-jobs/` selbst und davon 37 (!) in einer einzigen Datei `phase-template.ts`. Das ist die Hauptlast fuer den Altlast-Pass (Plan-Schritt 4).

## 2. Files in `src/lib/external-jobs/` (40)

Sortiert nach Zeilen, absteigend.

| Datei | Zeilen | leere Catches | hat Test |
|---|---:|---:|---|
| phase-template.ts | 2096 | 37 | nein ← Pilot-Hauptziel fuer Char-Tests |
| extract-only.ts | 796 | 4 | nein |
| phase-shadow-twin-loader.ts | 727 | 0 | nein |
| images.ts | 668 | 9 | nein |
| phase-ingest.ts | 432 | 8 | nein |
| chapters.ts | 416 | 3 | nein |
| template-run.ts | 389 | 3 | nein |
| storage.ts | 342 | 3 | nein |
| secretary-request.ts | 287 | 0 | **ja** (`secretary-request.test.ts`) |
| complete.ts | 272 | 0 | nein |
| preprocess-core.ts | 262 | 0 | nein |
| secretary-sse-client.ts | 255 | 0 | nein |
| phase-translations.ts | 243 | 0 | **ja** (`phase-translations.test.ts`) |
| error-handler.ts | 175 | 0 | nein |
| offline-callback.ts | 173 | 0 | nein |
| template-files.ts | 169 | 3 | nein |
| preprocessor-ingest.ts | 167 | 0 | nein |
| progress.ts | 151 | 4 | **ja** (`progress.test.ts`) |
| template-body-builder.ts | 146 | 0 | **ja** (`template-body-builder.test.ts`) |
| secretary-url.ts | 145 | 0 | **ja** (`secretary-config-resolver.test.ts`) |
| enqueue-translations.ts | 142 | 0 | **ja** (`enqueue-translations.test.ts`) |
| preprocessor-transform-template.ts | 133 | 0 | nein |
| shadow-twin-helpers.ts | 129 | 0 | nein |
| template-decision.ts | 119 | 1 | nein |
| auth.ts | 116 | 0 | nein |
| callback-body-parser.ts | 103 | 0 | nein |
| trace-helpers.ts | 93 | 0 | nein |
| mistral-ocr-download.ts | 92 | 0 | nein |
| job-status-check.ts | 85 | 0 | nein |
| preprocessor-pdf-extract.ts | 82 | 0 | nein |
| context.ts | 66 | 0 | nein |
| template-source-frontmatter.ts | 50 | 0 | **ja** (`template-source-frontmatter.test.ts`) |
| provider.ts | 49 | 0 | nein |
| policies.ts | 37 | 0 | nein |
| ingest.ts | 35 | 0 | nein |

7 von 40 Files haben Tests = **18 % Coverage** auf File-Ebene.

## 3. Files auf Lib-Wurzel (4 zusaetzliche, audit-relevant)

| Datei | Zeilen | leere Catches | hat Test |
|---|---:|---:|---|
| [src/lib/external-jobs-repository.ts](../../../src/lib/external-jobs-repository.ts) | 649 | 4 | nein |
| [src/lib/external-jobs-worker.ts](../../../src/lib/external-jobs-worker.ts) | 329 | 2 | nein |
| [src/lib/external-jobs-watchdog.ts](../../../src/lib/external-jobs-watchdog.ts) | 111 | 0 | nein |
| [src/lib/external-jobs-log-buffer.ts](../../../src/lib/external-jobs-log-buffer.ts) | 26 | 0 | nein |

**Architektur-Frage** (siehe Audit-File Abschnitt "Architektur-Anmerkung"): sollten diese in `src/lib/external-jobs/` verschoben werden? — Empfehlung: ja, in Plan-Schritt 4 mit User-Abstimmung.

## 4. API-Routen `src/app/api/external/jobs/` (9 Files, 4.157 Zeilen)

| Route | Zeilen |
|---|---:|
| [`[jobId]/start/route.ts`](../../../src/app/api/external/jobs/[jobId]/start/route.ts) | 1.848 |
| [`[jobId]/route.ts`](../../../src/app/api/external/jobs/[jobId]/route.ts) | 1.299 |
| [`[jobId]/markdown/route.ts`](../../../src/app/api/external/jobs/[jobId]/markdown/route.ts) | 199 |
| [`internal/create/route.ts`](../../../src/app/api/external/jobs/internal/create/route.ts) | 178 |
| [`[jobId]/trace/route.ts`](../../../src/app/api/external/jobs/[jobId]/trace/route.ts) | 176 |
| [`route.ts`](../../../src/app/api/external/jobs/route.ts) | 110 |
| [`stream/route.ts`](../../../src/app/api/external/jobs/stream/route.ts) | 95 |
| [`[jobId]/download-archive/route.ts`](../../../src/app/api/external/jobs/[jobId]/download-archive/route.ts) | 94 |
| [`worker/route.ts`](../../../src/app/api/external/jobs/worker/route.ts) | 52 |

`start/route.ts` mit 1.848 Zeilen ist das offensichtlichste Modularisierungs-Ziel auf Routen-Ebene — gehoert nicht in den Pilot-Schritt 4 (Fokus dort: `phase-template.ts`), sollte aber als **Folge-PR** in derselben Welle eingeplant werden.

## 5. Hot-Spots fuer Plan-Schritt 4 (Altlast-Pass)

| Hot-Spot | Datei(en) | Massnahme |
|---|---|---|
| **Silent Fallback** (Plan §4.2) | `external-jobs-repository.ts:320` | `} catch { return undefined }` durch `throw` oder bewusstes Default + Logging ersetzen |
| **Datei > 200 Zeilen** (Plan §4.7) | `phase-template.ts` (2.096) | Split nach `phase-template/index.ts` + Sub-Module wie im Plan-Schritt 4 vorgesehen |
| **Leere Catches** (Plan §4.2) | 75 in 14 Files | Mit hoher Quote in `phase-template.ts` (37). Aufraeumen erfordert pro Catch eine Mini-Entscheidung: `throw`, dokumentiertes Default, oder Logging-only. Quantitativ groesster Aufwand der Welle. |
| **Datei > 200 Zeilen** (zusaetzlich) | 13 weitere Files (siehe Tabelle 2) | Opportunistisch in Folge-PRs |

## 6. Hot-Spots fuer Plan-Schritt 3 (Characterization Tests)

Pilot-Fokus laut Plan: `phase-template.ts`.

Geplante Test-Files (Plan-Schritt 3):
- `tests/unit/external-jobs/phase-template-happy-path.test.ts`
- `tests/unit/external-jobs/phase-template-skip-paths.test.ts`
- `tests/unit/external-jobs/phase-template-empty-input.test.ts`

Hinweis: vor Test-Erstellung muss kurz analysiert werden, was die oeffentlich exportierten Funktionen von `phase-template.ts` sind. Cloud-Agent 3 erledigt das als ersten Substep.

## 7. Bekannte Risiken / Watchpoints

- **`worker_dispatch fetch failed`** ist eine bekannte Live-Issue (siehe `docs/analyse-worker-start-route-hang.md`). Der Pilot beruehrt diese Code-Pfade indirekt, soll sie aber **nicht** im Rahmen der Welle fixen — separater Bug-Fix.
- **Keine Live-Mongo/Secretary-Aufrufe** in Cloud-Agents (siehe Plan-Sektion 8.6). Tests muessen mocken, was Beispiel-Tests in `tests/unit/external-jobs/` bereits sauber tun (`vi.mock('@/lib/external-jobs-repository', ...)`).
- **`tests/unit/jobs-worker-pool.test.ts`** liegt formal nicht in `external-jobs/`-Test-Ordner, gehoert aber thematisch dazu — ggf. in Schritt 4 verschieben.
