# Bestands-Audit: Modul `external-jobs`

Stand: 2026-04-23. Erstellt von Cloud-Agent 2 (Pilot-Welle, Plan-Schritt 0).

**Scope-Hinweis (ADR 0001)**: `event-job` ist eine getrennte Domaene und wird hier **nicht** auditiert. Audit fuer `event-job` ist Teil von Welle 4 nach Pilot.

## Zusammenfassung

| Bereich | Eintraege | keep | update | merge | migrate | delete | archive |
|---|---:|---:|---:|---:|---:|---:|---:|
| Cursor Rules | 4 | 3 | 1 | 0 | - | 0 | - |
| Tests | 8 | 8 | 0 | - | 0 | 0 | - |
| Docs | 1 | 0 | 0 | - | - | 0 | 1 |
| **Summe** | **13** | **11** | **1** | **0** | **0** | **0** | **1** |

**Kritische Findings**:

- Audit zeigt **kein Bestands-Test-Drift**: alle 8 relevanten Tests pruefen real existierenden Code mit korrekten Vertraegen → starkes Sicherheitsnetz fuer den Pilot.
- `external-jobs-integration-tests.mdc` ist eine sehr ausfuehrliche, gepflegte Rule (400 Zeilen) und Hauptquelle der Wahrheit — keep, nur kleinere Punkte fuer Update.
- `analyse-worker-start-route-hang.md` beschreibt eine Live-Debug-Session vom Tag dieser Initiative (2026-04-23). Inhaltlich aktuell, aber ist eine **Analyse**-Notiz — Aktion: archive nach Welle-Abschluss.

## A. Cursor Rules

| Rule-Datei | Bezug zum Modul | Status | Aktion | Begruendung |
|---|---|---|---|---|
| [.cursor/rules/external-jobs-integration-tests.mdc](../../../.cursor/rules/external-jobs-integration-tests.mdc) | direkt (`src/lib/external-jobs/**` + `src/app/api/external/jobs/**` + `tests/unit/external-jobs/**`) | aktuell | **update** | gepflegt und detailliert; nur kleine Erweiterung um Skip-Semantik bzgl. `details.skipped=true` (Plan-Schritt 2) |
| [.cursor/rules/contracts-story-pipeline.mdc](../../../.cursor/rules/contracts-story-pipeline.mdc) | direkt (deckt `src/lib/external-jobs/**` mit ab) | aktuell | keep | bereits sehr klar formulierte globale Pipeline-Contracts |
| [.cursor/rules/no-silent-fallbacks.mdc](../../../.cursor/rules/no-silent-fallbacks.mdc) | global (gilt fuer alle Module, also auch fuer external-jobs) | aktuell | keep | konkrete Quelle fuer den Pilot-Altlast-Fix in `external-jobs-repository.ts:320` |
| [.cursor/rules/storage-abstraction.mdc](../../../.cursor/rules/storage-abstraction.mdc) | global (UI/Storage-Trennung) | aktuell | keep | nur indirekt fuer Pilot relevant (external-jobs ist Service-Layer, nicht UI); voller Bezug erst in Welle 3b file-preview |

### Update-Detail fuer `external-jobs-integration-tests.mdc`

Konkrete Erweiterung in Plan-Schritt 2 (Contracts):

- **§3 Skip-Semantik schaerfen**: Heute steht in der Rule sowohl "kein eigener StepStatus `'skipped'`" als auch eine optionale Toleranz fuer Legacy. Vorschlag: In v2 der Rule wird `'skipped'` als StepStatus **explizit verboten**, weil im Pilot-Refactor alle Vorkommen normalisiert werden. Die Toleranz-Klausel kann dann gestrichen werden.
- Optional: harte Invariante "Kein `} catch { return undefined }` in `phase-*.ts`" hinzufuegen, sobald Pilot-Schritt 4 (Altlast-Pass) sauber ist.

## B. Tests

In-Scope sind alle Tests in `tests/unit/external-jobs/`. Zur Pruefung mit aufgenommen: `tests/unit/jobs-worker-pool.test.ts` (testet Worker-Pool-Helpers in `@/lib/env`, **nicht** in `external-jobs` direkt — formal Grenzfall).

**Out of Scope** (gehoeren zur event-job-Domaene per ADR 0001):
- Alle Files in `tests/unit/events/` werden im event-job-Audit (Welle 4) bewertet.

| Test-Datei | Testet welchen Code | Code existiert? | Vertrag korrekt? | Aktion | Begruendung |
|---|---|---|---|---|---|
| [tests/unit/external-jobs/enqueue-translations.test.ts](../../../tests/unit/external-jobs/enqueue-translations.test.ts) | `enqueueTranslations` aus `src/lib/external-jobs/enqueue-translations.ts` (142 Zeilen) | ja | ja — prueft `job_type === 'translation'`-Vertrag | keep | Sicherheitsnetz fuer Translation-Phase |
| [tests/unit/external-jobs/phase-translations.test.ts](../../../tests/unit/external-jobs/phase-translations.test.ts) | `splitByScope` aus `src/lib/external-jobs/phase-translations.ts` (243 Zeilen) | ja | ja — prueft Gallery/Detail-Scope-Split | keep | Pure Funktion, gut getestet |
| [tests/unit/external-jobs/progress.test.ts](../../../tests/unit/external-jobs/progress.test.ts) | `handleProgressIfAny` aus `src/lib/external-jobs/progress.ts` (151 Zeilen) | ja | ja — prueft Watchdog-Bump und Event-Bus-Emission | keep | Wichtig fuer Worker-Heartbeat |
| [tests/unit/external-jobs/secretary-config-resolver.test.ts](../../../tests/unit/external-jobs/secretary-config-resolver.test.ts) | `resolveLibrarySecretaryConfig` aus `src/lib/external-jobs/secretary-url.ts` (145 Zeilen) | ja | ja — verhindert dokumentierten Konfig-Drift (POST/Callback) | keep | Schuetzt vor Regression eines bekannten Bugs |
| [tests/unit/external-jobs/secretary-request.test.ts](../../../tests/unit/external-jobs/secretary-request.test.ts) | `prepareSecretaryRequest` aus `src/lib/external-jobs/secretary-request.ts` (287 Zeilen) | ja | ja — Request-Body-Aufbau fuer Secretary | keep | Vertrag zur externen API |
| [tests/unit/external-jobs/template-body-builder.test.ts](../../../tests/unit/external-jobs/template-body-builder.test.ts) | `buildTransformationBody` aus `src/lib/external-jobs/template-body-builder.ts` (146 Zeilen) | ja | ja — Strategie-Auswahl (`bodyInText` vs Template-Render) | keep | Klare pure Funktion |
| [tests/unit/external-jobs/template-source-frontmatter.test.ts](../../../tests/unit/external-jobs/template-source-frontmatter.test.ts) | `extractForwardedTemplateSourceFrontmatter` aus `src/lib/external-jobs/template-source-frontmatter.ts` (50 Zeilen) | ja | ja — `_source_files`-Forwarding | keep | Pflicht laut media-lifecycle-Rule |
| [tests/unit/jobs-worker-pool.test.ts](../../../tests/unit/jobs-worker-pool.test.ts) | `getJobsWorkerPoolId`, `workerPoolMongoMatch` aus `@/lib/env` | ja (in `src/lib/env.ts`) | ja | keep | Grenzfall: testet `env.ts`, nicht `external-jobs/`. **Hinweis fuer Schritt 4**: Funktionen sollten konzeptuell in `external-jobs-worker.ts` liegen — Verschiebung ist Plan-Schritt 4 (Altlast-Pass) zu pruefen, dann mit `migrate`-Aktion. |

### Test-Coverage-Luecke (fuer Plan-Schritt 3 dokumentiert)

Die folgenden grossen Files in `external-jobs/` haben **keinen direkten Test**:

- `phase-template.ts` (2.096 Zeilen) ← Pilot-Hauptziel fuer Characterization Tests
- `phase-shadow-twin-loader.ts` (727 Zeilen)
- `phase-ingest.ts` (432 Zeilen)
- `extract-only.ts` (796 Zeilen)
- `images.ts` (668 Zeilen)
- `chapters.ts` (416 Zeilen)
- `complete.ts` (272 Zeilen)
- `external-jobs-repository.ts` (649 Zeilen)
- `external-jobs-worker.ts` (329 Zeilen)
- `external-jobs-watchdog.ts` (111 Zeilen)

Das sind ~6.500 Zeilen unkontrollierter Code. Plan-Schritt 3 fokussiert auf `phase-template.ts` (Happy-Path/Skip-Paths/Empty-Input); die anderen Files koennen opportunistisch in spaeteren PRs Tests bekommen.

## C. Docs

| Doc-Datei | Beschreibt was | Status | Aktion | Begruendung |
|---|---|---|---|---|
| [docs/analyse-worker-start-route-hang.md](../../analyse-worker-start-route-hang.md) | Konkrete Analyse einer Live-Debug-Session am 2026-04-23 zu `fetch failed` zwischen Worker und `/api/external/jobs/[jobId]/start` | aktuell | archive | Inhaltlich korrekt, aber **Analyse-Notiz**, nicht dauerhafte Doku. Nach Pilot-Abschluss (Welle 5/6 Dead-Code) nach `docs/_analysis/` oder `docs/archive/` verschieben. Bis dahin: keep, weil Hinweise fuer Schritt 4 (Altlast) interessant. |

### Out of Scope

Andere `docs/`-Files erwaehnen `external-jobs` nur als Querreferenz (z.B. `docs/architecture/pipeline-phases.md`, `docs/analysis/wizard-and-jobs.md`, `docs/_chats/*`). Diese sind **nicht** primaer external-jobs-Doku und werden in den jeweiligen Wellen ihrer Hauptmodule auditiert (`pipeline-phases.md` → Welle 1 ingestion/shadow-twin; `wizard-and-jobs.md` → Welle 3d creation-wizard).

`docs/_chats/*` und `docs/_analysis/*` sind per Naming-Konvention (Unterstrich-Prefix) bereits als historisch markiert — kein Audit-Bedarf.

## Audit → Folge-Schritte

| Audit-Aktion | Folge-Schritt | Wo umgesetzt |
|---|---|---|
| Rule `external-jobs-integration-tests.mdc` → **update** | Plan-Schritt 2 (Contracts) | Cloud-Agent 3 |
| Test `jobs-worker-pool.test.ts` → ggf. **migrate** (Funktion in worker.ts verschieben?) | Plan-Schritt 4 (Altlast) | Cloud-Agent 4 — pruefen, nicht Pflicht |
| Doc `analyse-worker-start-route-hang.md` → **archive** | Plan-Schritt 6 (Dead-Code/Cleanup) | Cloud-Agent 5 |

## Architektur-Anmerkung (kein Audit-Eintrag)

Beim Lesen der Rules ist klar geworden: **`src/lib/external-jobs-worker.ts`, `external-jobs-watchdog.ts`, `external-jobs-log-buffer.ts`, `external-jobs-repository.ts` liegen NICHT im Verzeichnis `src/lib/external-jobs/`** sondern auf der Ebene daneben. Das `module-health.mjs`-Skript zaehlt sie deshalb als **eigenstaendige Module** (siehe Inventory-File). Fuer den Refactor ist das eine offene Frage:

- Option A: Verschiebung in `src/lib/external-jobs/` als `worker.ts`/`watchdog.ts`/`log-buffer.ts`/`repository.ts` (klare Modulgrenze)
- Option B: bleibt aussen, bewusste Trennung (Worker/Repo sind Singleton-Layer, Phasen sind Pipeline-Steps)

Empfehlung fuer Plan-Schritt 4 (Altlast): **Option A**, weil es den Modulbegriff vereinfacht und `pnpm health --module external-jobs` dann eine Zahl statt fuenf liefert. Aber: das ist invasive Bewegung mit grossem Diff (Imports!), gehoert in **eigenen** Commit innerhalb von Cloud-Agent 4 und sollte zuerst mit User abgestimmt werden.
