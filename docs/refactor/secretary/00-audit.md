# Bestands-Audit: Modul `secretary`

Stand: 2026-04-27. Welle 2.1, Schritt 0 (siehe Methodik
[`docs/refactor/playbook.md`](../playbook.md)).

Vorbild-Format: [`docs/refactor/ingestion/00-audit.md`](../ingestion/00-audit.md).

## A. Cursor Rules

| Rule-Datei | Bezug zum Modul | Status | Aktion | Begruendung |
|---|---|---|---|---|
| `.cursor/rules/no-silent-fallbacks.mdc` | global | aktuell | keep | gilt fuer den `catch {}` in `client.ts:731`, der in Schritt 4 gefixt wird |
| `.cursor/rules/storage-abstraction.mdc` | global | aktuell | keep | UI darf Storage nicht kennen — `secretary` darf erst recht nicht |
| `.cursor/rules/contracts-story-pipeline.mdc` | indirekt (Pipeline-Context) | aktuell | keep | Secretary ist Vertragspartner der Pipeline, aber nicht selbst Pipeline-Code |
| `.cursor/rules/external-jobs-integration-tests.mdc` | indirekt (Z. 59-69 beschreiben Secretary-Service) | aktuell | keep | Beschreibt den externen Service, nicht den Wrapper. Bleibt unveraendert |
| `.cursor/rules/shadow-twin-contracts.mdc` | indirekt (Z. 75 erwaehnt `response-parser`) | aktuell | keep | Pflicht-Aufruf von `parseSecretaryMarkdownStrict` ist hier verankert |
| `.cursor/rules/template-structure.mdc` | indirekt (Z. 11/248 erwaehnen Secretary) | aktuell | keep | Beschreibt Template-Vertrag, nicht Wrapper |
| `.cursor/rules/detail-view-type-checklist.mdc` | indirekt (Z. 226 erwaehnt Secretary-Serialisierung) | aktuell | keep | UI-Doku, kein Wrapper-Bezug |
| `.cursor/rules/secretary-contracts.mdc` (NEU) | direkt | wird in Schritt 2 erstellt | create | Modul-spezifische Invarianten — Pflicht-Output dieser Welle |

**Audit-Ergebnis Rules**: Keine bestehende Rule muss veraendert oder
geloescht werden. Eine neue Rule wird erstellt (Schritt 2).

## B. Tests

| Test-Datei | Testet welchen Code | Code existiert? | Vertrag korrekt? | Aktion | Begruendung |
|---|---|---|---|---|---|
| `tests/unit/secretary/extract-audio-text.test.ts` | `extractSecretaryAudioText` aus `src/lib/secretary/extract-audio-text.ts` | ja | ja | keep | 6 Tests, deckt alle 5 Faelle der pure Funktion ab |
| `tests/unit/secretary/response-parser.test.ts` | `parseSecretaryMarkdownStrict` aus `src/lib/secretary/response-parser.ts` | ja | ja, aber knapp | keep | nur 2 Tests; Welle 2.1 fuegt KEINE weiteren hinzu (nicht im Hot-Spot-Plan), aber Folge-PR-Watchpoint |
| `tests/unit/secretary/image-analyzer-multi.test.ts` | `callImageAnalyzerTemplate` aus `src/lib/secretary/image-analyzer.ts` (PR #294) | ja | ja | keep | 5 Tests, deckt single + multi-image-Pfade + Fehler ab |
| `tests/unit/secretary/process-video-job-defaults.test.ts` | `POST` Handler aus `src/app/api/secretary/process-video/job/route.ts` | ja, aber **nicht** `src/lib/secretary/` | ja | **migrate** | testet eine API-Route, gehoert nach `tests/unit/api/secretary/`. Verschieben in Schritt 4 |

**Cross-Modul-Tests** (Tests in anderen `tests/unit/*`-Verzeichnissen,
die Secretary-Code testen):

| Test-Datei | Testet was | Aktion |
|---|---|---|
| `tests/unit/external-jobs/secretary-request.test.ts` | `secretary-request.ts` aus `external-jobs/` (Wrapper, der `secretary/`-Funktionen aufruft) | keep, kein direkter Secretary-Test |

**Audit-Ergebnis Tests**: 4 Files, davon 3 `keep` und 1 `migrate`. Keine
Loeschungen. Bestands-Tests sind das Sicherheitsnetz fuer Welle 2.1.

## C. Docs

| Doc-Datei | Beschreibt was | Status | Aktion | Begruendung |
|---|---|---|---|---|
| `docs/_secretary-service-docu/overview.md` | Externer Service-Ueberblick | aktuell (Spiegel des externen Service) | keep | Repo-fremder Service-Vertrag |
| `docs/_secretary-service-docu/audio.md` | Audio-Endpunkt | aktuell | keep | dito |
| `docs/_secretary-service-docu/pdf.md` | PDF-Endpunkt | aktuell (PR #294) | keep | dito |
| `docs/_secretary-service-docu/video.md` | Video-Endpunkt | aktuell | keep | dito |
| `docs/_secretary-service-docu/image-analyzer.md` | Image-Analyzer (PR #294) | aktuell | keep | dito |
| `docs/_secretary-service-docu/transformer.md` | Transformer-Endpunkt | aktuell | keep | dito |
| `docs/_secretary-service-docu/text2image.md` | Text2Image | aktuell | keep | dito |
| `docs/_secretary-service-docu/jobs.md` | Job-Verwaltung | aktuell | keep | dito |
| `docs/_secretary-service-docu/offline-clients.md` | Offline-Clients | aktuell | keep | dito |
| `docs/_secretary-service-docu/office.md` | Office-Endpunkt | aktuell | keep | dito |
| `docs/architecture/secretary-format-interfaces.md` | Format-Interfaces zwischen Secretary und Pipeline | aktuell | keep | Architektur-Referenz fuer §5 Streaming-Vertrag |
| `docs/diktat-secretary-flow.md` | Diktat-Flow ueber Secretary | aktuell | keep | nicht im Welle-Scope, aber wertvolle Referenz |
| `docs/analysis/shadow-twin-metadata-to-secretary-context.md` | Datenfluss Shadow-Twin → Secretary | aktuell | keep | Cross-Modul-Analyse, post-Welle-1 |
| `docs/composite-multi-image-e2e.md` (PR #294) | Composite-Multi-Image-Flow inkl. Secretary-Aufrufe | aktuell | keep | frisch |

**Audit-Ergebnis Docs**: 14+ Files, alle `keep`. Keine Loeschungen.
Externe Service-Doku (`docs/_secretary-service-docu/`) wird grundsaetzlich
nicht von dieser Welle angefasst (E1: Externer Service ist Tabu).

## Zusammenfassung Audit

| Kategorie | keep | update | migrate | merge | delete | create |
|---|---:|---:|---:|---:|---:|---:|
| Rules | 7 | 0 | 0 | 0 | 0 | 1 |
| Tests | 3 | 0 | 1 | 0 | 0 | 0 |
| Docs | 14 | 0 | 0 | 0 | 0 | 0 |

**Kritische Findings fuer Folge-Schritte**:

1. **Schritt 2** (Contracts): neue Rule `.cursor/rules/secretary-contracts.mdc` anlegen.
2. **Schritt 3** (Char-Tests): bestehende Tests bleiben, **mind. 15-25 neue** Tests fuer `client.ts` + `adapter.ts`.
3. **Schritt 4** (Altlast):
   - `catch {}` in `client.ts:731` fixen (Logging + Kommentar).
   - `process-video-job-defaults.test.ts` nach `tests/unit/api/secretary/` verschieben.
   - Pure Helper aus `client.ts` extrahieren (Token-Refresh, FormData-Builder, URL-Builder).
4. **Schritt 6** (Dead-Code): keine Audit-Findings mit Status `delete` — knip-Lauf entscheidet.

**Watchpoints (NICHT in Welle 2.1)**:

- UI-Komponenten importieren direkt aus `src/lib/secretary/`
  (`src/components/event-monitor/`, `src/components/creation-wizard/`,
  `src/components/library/file-preview.tsx`). Wird in Welle 3
  korrigiert. Secretary-Contract-Rule §3 verankert das Verbot.
- `client.ts` benutzt `localStorage` direkt (Z. ~720). Server-Lib mit
  Browser-API ist Drift. Welle 3-Watchpoint, oder Folge-PR.
- `response-parser.test.ts` hat nur 2 Tests — bei Bedarf in Folge-PR
  ausbauen.
- Cross-Modul-`secretary-request.ts` in `external-jobs/` — eigener
  Wrapper. Pruefen ob konsolidierbar (Folge-Initiative).
