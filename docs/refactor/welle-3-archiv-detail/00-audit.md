# Bestands-Audit: Welle 3-II — Archiv-Detail

Stand: 2026-04-29 (Cloud-Agent, Schritt 0).

**Scope-Hinweis**: Welle 3-II deckt 57 Files in `src/components/library/` ab —
alle Detail-View-Komponenten (`file-preview.tsx`, `*-detail.tsx`-Familie,
Tabs, Media-Renderer, Markdown-Sub-Komponenten, `flow/*`, `shared/*` ohne
`perspective-*`). App-Schale ist bereits in Welle 3-I (gemerged) refactored.
Galerie/Story/Chat ist Welle 3-III.

## Zusammenfassung

| Bereich | Eintraege | keep | update | merge | migrate | delete | archive |
|---|---:|---:|---:|---:|---:|---:|---:|
| Cursor Rules | 11 | 10 | 1 | 0 | – | 0 | – |
| Tests | 5 | 5 | 0 | – | 0 | 0 | – |
| Docs | 7 | 5 | 2 | – | – | 0 | 0 |
| **Summe** | **23** | **20** | **3** | **0** | **0** | **0** | **0** |

**Kritische Findings**:

- **F1 — 0 direkte Tests fuer alle 57 Welle-3-II-Files** (verifiziert via
  `node scripts/ui-welle-3ii-stats.mjs`). Char-Test-Backlog → Schritt 3 (8
  kleine Files in dieser PR) und Sub-Wellen 3-II-a/b/c/d (Hauptkomponenten).
- **F2 — 7 leere Catches** in der Welle (verifiziert mit Zeilennummern):
  - `file-preview.tsx:3652`
  - `markdown-preview.tsx:859,863,931`
  - `audio-transform.tsx:136`
  - `video-transform.tsx:136`
  - `pdf-transform.tsx:164`
  Verstoss gegen [`no-silent-fallbacks.mdc`](../../contracts/no-silent-fallbacks.md).
  **Alle** in dieser PR (Schritt 4a) gefixt.
- **F3 — 1 Storage-Branch** in
  `src/components/library/shared/freshness-comparison-panel.tsx:145`:
  `data.config.primaryStore === "filesystem" || data.config.persistToFilesystem`.
  Verstoss gegen [`storage-abstraction.mdc`](../../contracts/storage-abstraction.md).
  **In dieser PR** (Schritt 4a) gefixt — durch Helper aus Welle 1 ersetzen
  oder API-Response-Flag.
- **F4 — `file-preview.tsx` mit 66 Hooks und 3.701 Zeilen** ist der groesste
  Hot-Spot des gesamten Refactor-Programms. Eigene Mehr-Phasen-Sub-Welle
  3-II-a (Preview-Switch).
- **F5 — `detail-view-type-checklist.mdc` ist relevant** fuer den
  `detail-view-renderer.tsx`-Char-Test: dieser Renderer entscheidet anhand
  des `detailViewType`, welche `*-detail.tsx`-Komponente gerendert wird.
  Wenn der Test den Switch fixiert, kann jede Sub-Welle die einzelnen
  Detail-Komponenten gefahrlos refactoren.
- **F6 — Doku-Drift in `docs/shadow-twin-freshness-sync.md`** (Zeile 229):
  Verweist auf konkrete Code-Ausschnitte aus `file-preview.tsx`. Nach 3-II-a
  Modul-Split muss die Doku aktualisiert werden.

## A. Cursor Rules

11 von 19 `../../contracts/*.md`-Dateien haben Bezug zur Welle 3-II.

| Rule-Datei | Bezug | Status | Aktion | Begruendung |
|---|---|---|---|---|
| [../../contracts/storage-abstraction.md](../../contracts/storage-abstraction.md) | global, **direkt** (1 Verstoss in `freshness-comparison-panel`) | aktuell | keep | Wird in dieser PR durch Code-Fix befolgt; Rule selbst bleibt |
| [../../contracts/no-silent-fallbacks.md](../../contracts/no-silent-fallbacks.md) | global, **direkt** (7 Verstoesse) | aktuell | keep | Wird in dieser PR durch Code-Fix befolgt |
| [../../contracts/media-lifecycle.md](../../contracts/media-lifecycle.md) | global, **direkt** (cover-image-generator-dialog, media-tab, markdown-metadata schreiben Frontmatter) | aktuell | keep | Wird in Sub-Wellen 3-II-c/d eingehalten |
| [../../contracts/contracts-story-pipeline.md](../../contracts/contracts-story-pipeline.md) | global, **direkt** (file-preview, markdown-preview, job-report-tab konsumieren Pipeline-Output) | aktuell | keep | Bleibt als Vertrag |
| [../../contracts/shadow-twin-architecture.md](../../contracts/shadow-twin-architecture.md) | global, **direkt** (alle Detail-Tabs konsumieren Shadow-Twin-State) | aktuell | keep | Bleibt als Vertrag |
| [../../contracts/detail-view-type-checklist.md](../../contracts/detail-view-type-checklist.md) | direkt (`detail-view-renderer.tsx`, `*-detail.tsx`-Familie, `job-report-tab.tsx`) | aktuell | **update** | Punkt 9 verweist auf `job-report-tab.tsx`. Nach 3-II-c-Modul-Split muss `job-report-tab/teaser-card.tsx` als neuer Pfad ergaenzt werden |
| [../../contracts/welle-3-schale-loader-contracts.md](../../contracts/welle-3-schale-loader-contracts.md) | indirekt (Schale ist Vorbedingung) | aktuell | keep | Globs decken Welle-3-I ab, keine Aenderung noetig |
| [../../plans/archiv/reorganizing-components.md](../../plans/archiv/reorganizing-components.md) | direkt (Modul-Split-Empfehlung) | aktuell | keep | Welle 3-II setzt das in Sub-Wellen um |
| [../../plans/archiv/prio1-state-caching-navigation.md](../../plans/archiv/prio1-state-caching-navigation.md) | indirekt | aktuell | keep | – |
| [../../plans/archiv/prio2-logging-errorhandling.md](../../plans/archiv/prio2-logging-errorhandling.md) | direkt (Logging-Vorgabe) | aktuell | keep | Wird in Schritt 4a durch Catch-Fixes erfuellt |
| [../../plans/archiv/prio3-init-grundfunktion.md](../../plans/archiv/prio3-init-grundfunktion.md) | indirekt | aktuell | keep | – |

**Output dieser Welle (neue Rule)**:
[`../../contracts/welle-3-archiv-detail-contracts.md`](../../contracts/welle-3-archiv-detail-contracts.md) —
wird in Schritt 2 angelegt.

## B. Tests

In-Scope sind alle Tests, die UI-Komponenten der Welle 3-II betreffen.
Aktueller Stand: **0 direkte Tests** fuer die 57 Welle-3-II-Files.

**Bekannte UI-Tests im Repo (Setup-Vorbild, alle aus Welle 3-I)**:

| Test-Datei | Testet welchen Code | Code existiert? | Vertrag korrekt? | Aktion | Begruendung |
|---|---|---|---|---|---|
| [tests/unit/components/library/library-shell.test.tsx](../../../tests/unit/components/library/library-shell.test.tsx) | Library-Shell (Welle 3-I) | ja | ja | keep | Vorbild fuer `detail-view-renderer.test.tsx` |
| [tests/unit/components/library/file-list-render.test.tsx](../../../tests/unit/components/library/file-list-render.test.tsx) | FileList (Welle 3-I) | ja | ja | keep | Vorbild fuer Render-Smoke-Tests |
| [tests/unit/components/library/file-tree.test.tsx](../../../tests/unit/components/library/file-tree.test.tsx) | FileTree (Welle 3-I) | ja | ja | keep | – |
| [tests/unit/components/library/file-list-filter.test.tsx](../../../tests/unit/components/library/file-list-filter.test.tsx) | sortedFilteredFilesAtom | ja | ja | keep | Vorbild fuer Pure-Atom/Helper-Tests |
| [tests/unit/components/app-layout.test.tsx](../../../tests/unit/components/app-layout.test.tsx) | AppLayout | ja | ja | keep | Allgemeines Setup-Vorbild |

**Out of Scope** (gehoeren zu spaeteren UX-Wellen):
- Tests fuer `gallery/`, `story/`, `chat/` → Welle 3-III
- Tests fuer Settings → Welle 3-IV
- Tests fuer Job/Event-Monitor → Welle 3-V
- Tests fuer Creation-Wizard → Welle 3-VI

## C. Docs

| Doc-Datei | Beschreibt was | Status | Aktion | Begruendung |
|---|---|---|---|---|
| [docs/shadow-twin-freshness-sync.md](../../../docs/shadow-twin-freshness-sync.md) | Shadow-Twin-Freshness-Sync (Banner in `file-preview.tsx`) | aktuell, aber Code-Pfad-spezifisch | **update** | Zeile 229 verweist auf `file-preview.tsx`-Ausschnitte. Nach 3-II-a-Modul-Split muss der Pfad auf `file-preview/index.tsx` oder die jeweilige View-Datei zeigen. |
| [docs/architecture/pdf-transformation-phases.md](../../../docs/architecture/pdf-transformation-phases.md) | PDF-Transformation-Phasen | aktuell | keep | Beschreibt Pipeline, nicht UI |
| [docs/_analysis/event-testimonials-wizards.md](../../../docs/_analysis/event-testimonials-wizards.md) | Analyse-Snapshot Testimonial-Wizard | aktuell | keep | Bezug zu `testimonial-detail.tsx`, beschreibt Vergangenheit |
| [docs/composite-multi-image-e2e.md](../../../docs/composite-multi-image-e2e.md) | E2E composite-multi-image | aktuell | keep | Bezug zu `cover-image-generator-dialog`, beschreibt Pipeline |
| [docs/wizard-media-integration-analyse.md](../../../docs/wizard-media-integration-analyse.md) | Wizard-Media-Integration | aktuell | keep | Bezug zu `media-tab.tsx`, beschreibt Architektur-Entscheidung |
| [docs/reference/file-index.md](../../../docs/reference/file-index.md) | Datei-Verzeichnis | unvollstaendig (keine Welle-3-II-Komponenten gelistet) | **update** | In Schritt 6 (Doku-Hygiene) Welle-3-II-Komponenten + neue Sub-Module ergaenzen |
| [docs/reference/modules/library.md](../../../docs/reference/modules/library.md) | Library-Modul | aktuell (Welle 3-I drin) | keep | Wird in Sub-Wellen 3-II-a/b/c/d ergaenzt, sobald Sub-Module final |

**Bewusst nicht aufgenommen** (ausserhalb Scope oder bereits erfasst):
- `docs/_chats/*` — chronologische Chat-Logs
- `docs/_analysis/shadow-twin-erkennung-divergenz.md` — Backend-Analyse (Welle 1)
- `docs/refactor/storage/`, `docs/refactor/secretary/`, `docs/refactor/templates/`, `docs/refactor/external-jobs/`, `docs/refactor/shadow-twin/`, `docs/refactor/welle-3-schale-loader/` — vorherige Wellen (keep, dienen als Vorlage)
- `docs/analysis/markdown-processing-pipeline.md` — Backend
- `docs/analysis/media-storage-strategy.md` — Backend (Welle 1)
- `docs/analysis/pipeline-*.md` — Backend
- `docs/decisions/remove-story-creator.md` — historische Entscheidung
- `docs/adr/0001-event-job-vs-external-jobs.md` — Backend-Domaenen-ADR

## Verfahren

1. Vorlage in-place ausgefuellt.
2. Pro Tabelle Status und Aktion entschieden.
3. Zusammenfassung am Anfang aktualisiert.
4. Kritische Findings als Bullet-Liste am Anfang ergaenzt.
5. Commit-Message: `welle-3-ii(audit): Bestands-Audit Archiv-Detail`.
