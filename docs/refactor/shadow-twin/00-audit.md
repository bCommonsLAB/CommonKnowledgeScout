# Bestands-Audit: Modul `shadow-twin`

Stand: 2026-04-27. Erstellt vom Cloud-Agent (Welle 2, Plan-Schritt 0).

Bezug:
- AGENT-BRIEF: [`AGENT-BRIEF.md`](./AGENT-BRIEF.md)
- Inventur: [`01-inventory.md`](./01-inventory.md)
- Vorbild: [`docs/refactor/storage/00-audit.md`](../storage/00-audit.md) (Welle 1)

## Zusammenfassung

| Bereich | Eintraege | keep | update | merge | migrate | delete | archive |
|---|---:|---:|---:|---:|---:|---:|---:|
| Cursor Rules | 7 | 6 | 1 | 0 | 0 | 0 | 0 |
| Tests | 15 | 15 | 0 | 0 | 0 | 0 | 0 |
| Docs | 10 | 2 | 1 | 0 | 0 | 0 | 7 |
| **Summe** | **32** | **23** | **2** | **0** | **0** | **0** | **7** |

**Kritische Findings**:

- Modul-Architektur-Rule [`shadow-twin-architecture.mdc`](../../../.cursor/rules/shadow-twin-architecture.mdc)
  ist gepflegt und gueltig. Sie wird nicht doppelt gepflegt; die neue
  `shadow-twin-contracts.mdc` setzt ergaenzende technische Invarianten
  (Welle-Schritt 2) und verweist auf sie.
- **Kein Bestands-Test-Drift**: alle 13 direkten Tests in
  `tests/unit/shadow-twin/` und 2 Cross-Modul-Tests in
  `tests/unit/storage/` pruefen real existierenden Code mit korrekten
  Vertraegen → starkes Sicherheitsnetz.
- **Doku-Drift**: `docs/analysis/shadow-twin-*.md` enthaelt 7 Analyse-
  Snapshots aus laufenden Diskussionen; keine "Quelle der Wahrheit", aber
  kein Handlungsbedarf in Welle 2. Aktion `archive` nach Welle-Abschluss
  (in spaeterer PR).
- Keine `delete`-Aktionen: das Modul ist strukturell sehr sauber.

## A. Cursor Rules

In Scope: alle Rules, die explizit auf `src/lib/shadow-twin/**` verweisen
oder im Body shadow-twin-Architektur normieren.

| Rule-Datei | Bezug zum Modul | Status | Aktion | Begruendung |
|---|---|---|---|---|
| [.cursor/rules/shadow-twin-architecture.mdc](../../../.cursor/rules/shadow-twin-architecture.mdc) | direkt (Architektur-Rule, alwaysApply: false aber pipeline-Globs) | aktuell | **keep** | Hauptquelle der Wahrheit; ArtifactKey-Determinismus, Storage-Abstraktion, Mongo-IDs. Inhalt deckt sich mit aktuellem Code. |
| [.cursor/rules/contracts-story-pipeline.mdc](../../../.cursor/rules/contracts-story-pipeline.mdc) | direkt (deckt shadow-twin-Pipeline mit ab) | aktuell | **keep** | Globaler Pipeline-Contract; bleibt unangetastet in Welle 2. |
| [.cursor/rules/storage-abstraction.mdc](../../../.cursor/rules/storage-abstraction.mdc) | indirekt (shadow-twin nutzt Storage-Provider) | aktuell | **keep** | Aus Welle 1; bleibt unveraendert. |
| [.cursor/rules/storage-contracts.mdc](../../../.cursor/rules/storage-contracts.mdc) | indirekt (Welle-1-Modul-Contract) | aktuell | **keep** | Aus Welle 1; bleibt unveraendert. |
| [.cursor/rules/media-lifecycle.mdc](../../../.cursor/rules/media-lifecycle.mdc) | indirekt (Persistenz/Lifecycle von Binary-Fragments) | aktuell | **keep** | Bleibt unangetastet. |
| [.cursor/rules/ingest-mongo-only.mdc](../../../.cursor/rules/ingest-mongo-only.mdc) | indirekt (Mongo-Only-Ingestion fuer shadow-twin-Artefakte) | aktuell | **keep** | Bleibt unangetastet. |
| [.cursor/rules/external-jobs-integration-tests.mdc](../../../.cursor/rules/external-jobs-integration-tests.mdc) | indirekt (Pipeline nutzt shadow-twin) | aktuell | **update** | Optional Cross-Reference auf neue `shadow-twin-contracts.mdc` ergaenzen. **Nicht Pflicht in Welle 2** — analog Welle 1. |

### Update-Detail (optional)

`external-jobs-integration-tests.mdc` koennte Footer-Verweis auf die neue
`shadow-twin-contracts.mdc` ergaenzen — nur Komfort, kein Vertrag. Wird in
Schritt 2 entschieden; bei Zeitknappheit nicht Pflicht.

### Neu zu erstellen (Schritt 2)

- `.cursor/rules/shadow-twin-contracts.mdc` — modul-spezifische
  Contract-Rule, Globs `["src/lib/shadow-twin/**/*.ts"]`. Komplementaer
  zu `shadow-twin-architecture.mdc`.

## B. Tests

In Scope: alle Tests in `tests/unit/shadow-twin/` (13 Files) plus die
Cross-Modul-Tests in `tests/unit/storage/`, die shadow-twin-Funktionen
indirekt pruefen.

| Test-Datei | Testet welchen Code | Code existiert? | Vertrag korrekt? | Aktion |
|---|---|---|---|---|
| [tests/unit/shadow-twin/artifact-naming.test.ts](../../../tests/unit/shadow-twin/artifact-naming.test.ts) | `artifact-naming.ts` (deterministische Pfad-/Name-Bildung) | ja | ja | **keep** |
| [tests/unit/shadow-twin/artifact-resolver.test.ts](../../../tests/unit/shadow-twin/artifact-resolver.test.ts) | `artifact-resolver.ts` (ArtifactKey -> Item) | ja | ja | **keep** |
| [tests/unit/shadow-twin/artifact-writer.test.ts](../../../tests/unit/shadow-twin/artifact-writer.test.ts) | `artifact-writer.ts` (Persistenz-Wrapper) | ja | ja | **keep** |
| [tests/unit/shadow-twin/binary-fragment-lookup.test.ts](../../../tests/unit/shadow-twin/binary-fragment-lookup.test.ts) | `binary-fragment-lookup.ts` | ja | ja | **keep** |
| [tests/unit/shadow-twin/conversion-job-utils.test.ts](../../../tests/unit/shadow-twin/conversion-job-utils.test.ts) | `conversion-job-utils.ts` | ja | ja | **keep** |
| [tests/unit/shadow-twin/freeze-markdown-image-urls.test.ts](../../../tests/unit/shadow-twin/freeze-markdown-image-urls.test.ts) | Cross-Modul: Markdown-Image-URLs einfrieren | ja | ja | **keep** |
| [tests/unit/shadow-twin/media-storage-loop.test.ts](../../../tests/unit/shadow-twin/media-storage-loop.test.ts) | Race-Condition-Test fuer Media-Persistierung | ja | ja | **keep** |
| [tests/unit/shadow-twin/media-storage-strategy.test.ts](../../../tests/unit/shadow-twin/media-storage-strategy.test.ts) | `media-storage-strategy.ts` (Auswahl Azure vs. Filesystem) | ja | ja | **keep** |
| [tests/unit/shadow-twin/mongo-shadow-twin-id.test.ts](../../../tests/unit/shadow-twin/mongo-shadow-twin-id.test.ts) | `mongo-shadow-twin-id.ts` (virtuelle ID-Konvention) | ja | ja | **keep** |
| [tests/unit/shadow-twin/mongo-shadow-twin-store.test.ts](../../../tests/unit/shadow-twin/mongo-shadow-twin-store.test.ts) | `store/mongo-shadow-twin-store.ts` | ja | ja | **keep** |
| [tests/unit/shadow-twin/shadow-twin-mongo-writer-rewrite.test.ts](../../../tests/unit/shadow-twin/shadow-twin-mongo-writer-rewrite.test.ts) | Aspekt von `shadow-twin-mongo-writer.ts` (Rewrite-Logik) | ja | ja | **keep** |
| [tests/unit/shadow-twin/shadow-twin-select.test.ts](../../../tests/unit/shadow-twin/shadow-twin-select.test.ts) | `shadow-twin-select.ts` | ja | ja | **keep** |
| [tests/unit/shadow-twin/shadow-twin-service.test.ts](../../../tests/unit/shadow-twin/shadow-twin-service.test.ts) | `store/shadow-twin-service.ts` (Hauptlast 914 Z.) | ja | ja | **keep** |
| [tests/unit/storage/shadow-twin-find-markdown-dot-basename.test.ts](../../../tests/unit/storage/shadow-twin-find-markdown-dot-basename.test.ts) | Cross-Modul: `findShadowTwinFolder` fuer Edge-Case | ja | ja | **keep** |
| [tests/unit/storage/shadow-twin-folder-name.test.ts](../../../tests/unit/storage/shadow-twin-folder-name.test.ts) | Cross-Modul: `shadow-twin-folder-name.ts` aus `src/lib/storage/` | ja | ja | **keep** |

### Test-Coverage-Luecke (in Schritt 3 abdecken)

Folgende grosse Files in `src/lib/shadow-twin/` haben **keinen direkten Test**:

- `analyze-shadow-twin.ts` (465 Z.) ← Welle-2-Hauptziel fuer Char-Tests
- `shadow-twin-migration-writer.ts` (458 Z.) ← Welle-2-Hauptziel
- `artifact-client.ts` (422 Z.) — opportunistisch
- `media-persistence-service.ts` (352 Z.) — opportunistisch
- `shadow-twin-direct-upload.ts` (266 Z.) — opportunistisch
- `store/provider-shadow-twin-store.ts` (156 Z.) — opportunistisch

Welle 2 fokussiert auf 2-3 Char-Test-Files; weitere Tests sind Folge-PRs.

## C. Docs

In Scope: alle Files in `docs/`, die shadow-twin im Pfad oder als primaeres
Thema haben.

| Doc-Datei | Beschreibt was | Status | Aktion | Begruendung |
|---|---|---|---|---|
| [docs/architecture/shadow-twin.md](../../architecture/shadow-twin.md) | Architektur-Reference fuer shadow-twin | unbekannt (nicht voll gelesen) | **update** | Falls beim Welle-Schritt 6 Doku-Hygiene Aenderungen am Modul stattfinden, hier einpflegen. Bis dahin: keep. |
| [docs/guides/shadow-twin.md](../../guides/shadow-twin.md) | User-/Developer-Guide | unbekannt | **keep** | Reines User-Doc, kein Welle-2-Update-Bedarf erkannt. |
| [docs/shadow-twin-freshness-sync.md](../../shadow-twin-freshness-sync.md) | Freshness-Sync-Mechanismus | unbekannt | **keep** | Spezifischer Aspekt, kein direkter Welle-2-Bezug. |
| [docs/analysis/shadow-twin-deterministic-architecture.md](../../analysis/shadow-twin-deterministic-architecture.md) | Determinismus-Diskussion | aktuell? | **archive** | Per Convention `docs/analysis/*` = Diskussions-Snapshot. Inhalt ist im `shadow-twin-architecture.mdc`-Rule normativ verankert. Folge-PR. |
| [docs/analysis/shadow-twin-storage-abstraction.md](../../analysis/shadow-twin-storage-abstraction.md) | Storage-Abstraktion in shadow-twin | unbekannt | **archive** | Wie oben; in `shadow-twin-architecture.mdc` und `storage-abstraction.mdc` normativ verankert. Folge-PR. |
| [docs/analysis/shadow-twin-mongo-target-structure.md](../../analysis/shadow-twin-mongo-target-structure.md) | Mongo-Zielstruktur | unbekannt | **archive** | Diskussions-Snapshot. Folge-PR. |
| [docs/analysis/shadow-twin-mongo-migration-plan.md](../../analysis/shadow-twin-mongo-migration-plan.md) | Migration-Plan | unbekannt | **archive** | Diskussions-Snapshot. Folge-PR. |
| [docs/analysis/shadow-twin-settings-ui.md](../../analysis/shadow-twin-settings-ui.md) | Settings-UI-Design | unbekannt | **archive** | Wie oben. Folge-PR. |
| [docs/analysis/shadow-twin-source-selection.md](../../analysis/shadow-twin-source-selection.md) | Source-Selection-Diskussion | unbekannt | **archive** | Wie oben. Folge-PR. |
| [docs/analysis/shadow-twin-v2-only.md](../../analysis/shadow-twin-v2-only.md) | V2-Only-Migration-Plan | unbekannt | **archive** | Wie oben. Folge-PR. |

### Out of Scope

Andere Files erwaehnen shadow-twin nur als Querreferenz:

- `docs/architecture/pipeline-phases.md` — pipeline-Welle
- `docs/architecture/module-hierarchy.md` — meta (in Welle 1 schon aktualisiert)
- `docs/use-cases/*` — use-case-Welle
- `docs/reference/modules/library.md` — library-Welle
- `docs/_chats/*` und `docs/_analysis/*` — historische Notizen, per Naming-Konvention archiviert

## Audit -> Folge-Schritte

| Audit-Aktion | Folge-Schritt | Wo umgesetzt | In Welle 2? |
|---|---|---|---|
| Rule `shadow-twin-contracts.mdc` neu anlegen | Schritt 2 | direkt | **ja** |
| Rule `external-jobs-integration-tests.mdc` -> **update** (optional) | Schritt 2 | direkt | nice-to-have |
| Tests fuer `analyze-shadow-twin.ts` + `shadow-twin-migration-writer.ts` -> **add** | Schritt 3 | direkt | **ja** |
| Pure Helper aus `shadow-twin-service.ts` extrahieren | Schritt 4 | direkt | **ja** |
| Pruefen ob Komponenten direkt `primaryStore` lesen, ggf. `useShadowTwinCapability()` einfuehren | Schritt 4 | direkt | **ja** |
| Doc `docs/architecture/shadow-twin.md` -> **update** falls noetig | Schritt 6 | direkt (Doku-Hygiene) | **ja** |
| Docs `docs/analysis/shadow-twin-*.md` -> **archive** nach `docs/_analysis/` | spaeter | Folge-PR | **nein** (zu viele Files, eigener PR) |
