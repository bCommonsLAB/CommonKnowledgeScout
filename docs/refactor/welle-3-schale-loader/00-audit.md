# Bestands-Audit: Welle 3-I — App-Schale + Library-Loader

Stand: 2026-04-28 (vom Cloud-Agent ausgefuellt nach Methodik aus
[`docs/refactor/playbook.md`](../playbook.md) Schritt 0).

**Scope-Hinweis**: Welle 3-I deckt App-Schale (`library.tsx`,
`library-header.tsx`, `library-switcher.tsx`, `src/app/library/**`) und
Library-Loader (`file-list.tsx`, `file-tree.tsx`, `upload-dialog.tsx`,
`upload-area.tsx`, `create-library-dialog.tsx`) ab.
Detail-View (`file-preview.tsx`, `*-detail.tsx`) ist **nicht** im Scope —
gehoert zu Welle 3-II. Galerie/Story/Chat ist Welle 3-III.

## Zusammenfassung

| Bereich | Eintraege | keep | update | merge | migrate | delete | archive |
|---|---:|---:|---:|---:|---:|---:|---:|
| Cursor Rules | 9 | 8 | 0 | 0 | – | 0 | – |
| Tests | 5 | 5 | 0 | – | 0 | 0 | – |
| Docs | 6 | 4 | 2 | – | – | 0 | 0 |
| **Summe** | **20** | **17** | **2** | **0** | **0** | **0** | **0** |

**Kritische Findings**:

- **F1 — 0 direkte Tests fuer alle 16 Welle-3-I-Files** (verifiziert via
  `node scripts/ui-welle-3i-stats.mjs`). Char-Test-Backlog → Schritt 3.
- **F2 — 3 leere Catches** in der Welle (`library-switcher.tsx:89`,
  `app/library/page.tsx:41`, `file-list.tsx:1391`). Verstoss gegen
  [`no-silent-fallbacks.mdc`](../../../.cursor/rules/no-silent-fallbacks.mdc).
  Fix in Schritt 4a (Library-Switcher + Page) und Schritt 4b
  (File-List im Modul-Split).
- **F3 — `file-list.tsx` mit 89 Hooks und 2.217 Zeilen** ist Verstoss gegen
  Methodik-Regel (Datei < 200 Zeilen). Modul-Split notwendig (Schritt 4b).
- **F4 — 0 Storage-Branches im UI** (verifiziert). Befund: `file-list.tsx`
  liest zwar `activeLibrary?.config?.shadowTwin` (Zeile 902-904), aber
  **delegiert** an den zentralen Helper
  `shouldFilterShadowTwinFolders` aus
  [`src/lib/storage/shadow-twin-folder-name.ts`](../../../src/lib/storage/shadow-twin-folder-name.ts).
  Das ist konform zu [`storage-contracts.mdc`](../../../.cursor/rules/storage-contracts.mdc)
  §5 (Helper statt direkter `library.type`-Branch). Wird in Schritt 2
  (Contracts) explizit erlaubt.
- **F5 — Doku-Drift in `docs/reference/file-index.md`** (Zeile 41,42,43:
  `library-header`, `library-switcher`, `file-list` haben TBD-Eintraege).
  Aktion: in Schritt 6 (Dead-Code/Doku-Hygiene) auffuellen.
- **F6 — `docs/reference/modules/library.md`** beschreibt `FileList` nur
  als Monolith — nach Modul-Split in Schritt 4b muss die Doku erweitert
  werden um die neuen Sub-Komponenten in `file-list/`.

## A. Cursor Rules

Alle .cursor/rules/*.mdc-Dateien wurden auf direkten/indirekten Bezug zur
Welle 3-I geprueft. Ergebnis: **9 von 19 Rules** haben Bezug zur Welle
(siehe Tabelle). Die uebrigen 10 Rules (`secretary-contracts.mdc`,
`templates-contracts.mdc`, `template-structure.mdc`, `chat-contracts.mdc`,
`shadow-twin-contracts.mdc`, `storage-contracts.mdc`,
`ingestion-contracts.mdc`, `ingest-mongo-only.mdc`,
`external-jobs-integration-tests.mdc`, `detail-view-type-checklist.mdc`)
sind themenfremd (Backend/andere UX-Welten) und werden hier **nicht**
aufgelistet, weil sie Welle 3-I nicht beruehren.

| Rule-Datei | Bezug | Status | Aktion | Begruendung |
|---|---|---|---|---|
| [.cursor/rules/storage-abstraction.mdc](../../../.cursor/rules/storage-abstraction.mdc) | global, **direkt** | aktuell | keep | Definiert Vertrag, dass UI kein Storage-Backend kennt. Welle 3-I respektiert das (0 Storage-Branches verifiziert). Kein Update noetig. |
| [.cursor/rules/no-silent-fallbacks.mdc](../../../.cursor/rules/no-silent-fallbacks.mdc) | global, **direkt** | aktuell | keep | Verbietet `catch {}` und stille Defaults. 3 Verstoesse in dieser Welle (siehe F2). Rule selbst bleibt unveraendert; Verstoesse werden in Schritt 4 gefixt. |
| [.cursor/rules/media-lifecycle.mdc](../../../.cursor/rules/media-lifecycle.mdc) | global, indirekt | aktuell | keep | `upload-dialog.tsx` und `upload-area.tsx` laden Medien hoch. Beide Files leiten Uploads an Hooks/APIs weiter, schreiben keine Frontmatter direkt. Konform. |
| [.cursor/rules/contracts-story-pipeline.mdc](../../../.cursor/rules/contracts-story-pipeline.mdc) | global, indirekt | aktuell | keep | Definiert Storage-Abstraktion fuer UI vs. Service-Layer (§2). Welle 3-I kapselt Storage-Detail in Helper. Konform. |
| [.cursor/rules/shadow-twin-architecture.mdc](../../../.cursor/rules/shadow-twin-architecture.mdc) | global, indirekt | aktuell | keep | Erklaert, wann `library.config.shadowTwin` in UI erlaubt ist (Helper, nicht Branch). `file-list.tsx:902-904` ist konform. |
| [.cursor/rules/reorganizing-components.mdc](../../../.cursor/rules/reorganizing-components.mdc) | direkt | aktuell | keep | Modul-Split-Empfehlung (Datei < 200 Zeilen). Welle 3-I setzt das in Schritt 4b um. |
| [.cursor/rules/prio1-state-caching-navigation.mdc](../../../.cursor/rules/prio1-state-caching-navigation.mdc) | direkt | aktuell | keep | Reglementiert Library-State und Folder-Navigation. `library.tsx` und `file-list.tsx` halten sich daran (`folderItemsAtom`, `useFolderNavigation`). |
| [.cursor/rules/prio2-logging-errorhandling.mdc](../../../.cursor/rules/prio2-logging-errorhandling.mdc) | direkt | aktuell | keep | Vorgabe fuer Logging in UI-Komponenten. Welle 3-I nutzt `StateLogger` / `FileLogger` / `NavigationLogger`. Konform. |
| [.cursor/rules/prio3-init-grundfunktion.mdc](../../../.cursor/rules/prio3-init-grundfunktion.mdc) | direkt | aktuell | keep | Init-Reihenfolge bei Library-Wechsel. `library.tsx` (useEffect-Reset bei Library-Switch) und `library-switcher.tsx` (Cache-Clear) sind konform. |

**Output dieser Welle (neue Rule)**:
[`.cursor/rules/welle-3-schale-loader-contracts.mdc`](../../../.cursor/rules/welle-3-schale-loader-contracts.mdc) —
wird in Schritt 2 angelegt.

## B. Tests

In-Scope sind alle Tests, die UI-Komponenten der Welle 3-I betreffen.
Aktueller Stand: **0 direkte Tests** fuer die 16 Welle-3-I-Files
(verifiziert via `node scripts/ui-welle-3i-stats.mjs`). Die folgenden
5 UI-Tests gehoeren zu anderen Komponenten, dienen aber als
Setup-Vorbild fuer die neuen Tests in Schritt 3.

| Test-Datei | Testet welchen Code | Code existiert? | Vertrag korrekt? | Aktion | Begruendung |
|---|---|---|---|---|---|
| [tests/unit/components/app-layout.test.tsx](../../../tests/unit/components/app-layout.test.tsx) | `AppLayout` aus `src/components/layouts/app-layout.tsx` | ja | ja | keep | Vorbild fuer neue Library-Shell-Tests (Mock-Pattern fuer `next/navigation`, `TopNavWrapper`, `JobMonitorPanel`). |
| [tests/unit/components/top-nav-config.test.ts](../../../tests/unit/components/top-nav-config.test.ts) | `topNavConfig` aus `src/components/top-nav-config.ts` | ja | ja | keep | Reine Konfig-Tests, themenfremd zu Welle 3-I, aber im Test-Setup-Verzeichnis vorhanden. |
| [tests/unit/components/composite-multi-dialog.test.ts](../../../tests/unit/components/composite-multi-dialog.test.ts) | `composite-multi-create-dialog` (gehoert zu Welle 3-VI/3-II) | ja | ja | keep | Themenfremd, dient nur als Test-Setup-Vorbild. |
| [tests/unit/components/public-home-links.test.tsx](../../../tests/unit/components/public-home-links.test.tsx) | Public-Home-Komponente | ja | ja | keep | Themenfremd, nur Setup-Vorbild. |
| [tests/unit/components/testimonial-list.test.tsx](../../../tests/unit/components/testimonial-list.test.tsx) | Testimonial-Liste (gehoert zu Welle 3-II) | ja | ja | keep | Themenfremd, nur Setup-Vorbild. |

**Out of Scope** (gehoeren zu spaeteren UX-Wellen):
- Tests fuer `file-preview.tsx`, `*-detail.tsx`, `markdown-preview.tsx` → Welle 3-II
- Tests fuer `gallery/`, `story/`, `chat/` → Welle 3-III
- Tests fuer Settings → Welle 3-IV
- Tests fuer Job/Event-Monitor → Welle 3-V

### Test-Coverage-Luecke (Backlog fuer Schritt 3)

Die folgenden Files in Welle 3-I haben **keinen** direkten Test:

| Datei | Zeilen | Hooks | Risiko ohne Char-Test |
|---|---:|---:|---|
| `file-list.tsx` | 2.217 | 89 | sehr hoch — Pilot-Hauptziel |
| `library.tsx` | 785 | 28 | hoch — Library-Loader, viele Race-Conditions |
| `file-tree.tsx` | 619 | 30 | mittel — Drag&Drop nicht trivial |
| `create-library-dialog.tsx` | 435 | 13 | mittel |
| `upload-area.tsx` | 226 | 3 | klein |
| `library-header.tsx` | 217 | 12 | klein |
| `app/library/create/page.tsx` | 207 | 5 | klein |
| `library-switcher.tsx` | 187 | 10 | klein, aber 1 leerer Catch |
| `app/library/page.tsx` | 149 | 10 | klein, aber 1 leerer Catch |
| `app/library/create/[typeId]/page.tsx` | 136 | 4 | sehr klein |
| `app/library/gallery/perspective/page.tsx` | 94 | 5 | sehr klein |
| `upload-dialog.tsx` | 94 | 2 | sehr klein |
| `app/library/gallery/ensure-library.tsx` | 26 | 4 | sehr klein |
| `app/library/gallery/page.tsx` | 17 | 0 | sehr klein |
| `app/library/gallery/client.tsx` | 10 | 0 | sehr klein |
| `app/library/gallery/page-client.tsx` | 8 | 0 | sehr klein |

Cloud-Agent erstellt mind. 8 neue Test-Files in Schritt 3 (siehe AGENT-BRIEF).

## C. Docs

Alle Dokumentations-Eintraege wurden mit `Grep` gegen die Welle-3-I-Datei-Namen
und gegen die Begriffe `App-Schale`, `Library-Loader` geprueft.

| Doc-Datei | Beschreibt was | Status | Aktion | Begruendung |
|---|---|---|---|---|
| [docs/reference/modules/library.md](../../../docs/reference/modules/library.md) | Library-Modul (Komponenten, State, Hooks, FileList-Header-Actions) | aktuell, aber unvollstaendig | update | Erwaehnt `library.tsx`, `library-header.tsx`, `library-switcher.tsx`, `file-list.tsx`. Nach Modul-Split in Schritt 4b muss Sektion ueber Sub-Komponenten ergaenzt werden. |
| [docs/reference/file-index.md](../../../docs/reference/file-index.md) | Datei-Verzeichnis | veraltet (`TBD`-Eintraege fuer `library-header.tsx` und `library-switcher.tsx`) | update | Zeile 41-43 enthaelt `TBD` fuer `Exports`-Spalte. In Schritt 6 (Doku-Hygiene) auffuellen. |
| [docs/architecture/dependency-graph.md](../../../docs/architecture/dependency-graph.md) | Abhaengigkeits-Graph | aktuell | keep | Erwaehnt `library.tsx` als zentralen Knotenpunkt; nach Modul-Split bleibt der Knoten gueltig. |
| [docs/architecture/module-hierarchy.md](../../../docs/architecture/module-hierarchy.md) | Modul-Hierarchie | aktuell | keep | Erwaehnt `library.tsx` als Top-Level. Bleibt gueltig. |
| [docs/architecture/shadow-twin.md](../../../docs/architecture/shadow-twin.md) | Shadow-Twin Architektur | aktuell | keep | Erwaehnt `file-list.tsx` als Konsument von Shadow-Twin-Analyse. Bleibt gueltig. |
| [docs/refactor/playbook.md](../playbook.md) | Methodik | aktuell | keep | Wird in dieser Welle befolgt, nicht modifiziert. |

**Bewusst nicht aufgenommen** (ausserhalb Scope oder bereits erfasst):
- `docs/_chats/*` — chronologische Chat-Logs, kein Zielzustand
- `docs/_analysis/file-list-metadata-und-thumbnail.md` — Analyse-Snapshot, gehoert zu Welle 3-II/3-III
- `docs/_analysis/shadow-twin-erkennung-divergenz.md` — Backend-Analyse
- `docs/analyse-underscore-folder-visibility.md` — bezieht sich auf
  Backend-Helper `shouldFilterShadowTwinFolders` (gehoert zu Welle 1)
- `docs/analysis/legacy-dialog-review.md` — Settings-Welle (3-IV)
- `docs/analysis/rules-gap-analysis.md` — global, nicht Welle-spezifisch
- `docs/analysis/pipeline-system-map.md`, `pipeline-standard-path-policy.md` — Backend
- `docs/analysis/build-fix-library-unused-folderitems.md` — Hotfix-Notiz, kein Zielzustand
- `docs/analysis/performance-analysis-loading.md` — Performance-Befund, dauert ueber Welle 3 hinaus
- `docs/composite-transformations-e2e.md` — Welle 3-VI

**Bekannte Doc-Verzeichnisse (vollstaendig geprueft)**:
- `docs/architecture/*.md` — 4 Files, keiner fuer Welle 3-I direkt relevant ausser den oben gelisteten
- `docs/reference/modules/library*.md` — 1 File (`library.md`), in Tabelle erfasst
- `docs/reference/file-index.md` — in Tabelle erfasst
- `docs/refactor/playbook.md` — in Tabelle erfasst
- `docs/refactor/external-jobs/`, `docs/refactor/storage/`, `docs/refactor/chat/`, `docs/refactor/shadow-twin/`, `docs/refactor/secretary/`, `docs/refactor/templates/` — vorherige Wellen (keep, dienen als Vorlage)

## Verfahren

1. Vorlage in-place ausgefuellt (TBD-Markierungen ersetzt).
2. Pro Tabelle Status und Aktion entschieden.
3. Zusammenfassung am Anfang aktualisiert.
4. Kritische Findings als Bullet-Liste am Anfang ergaenzt.
5. Commit-Message: `welle-3-i(audit): Bestands-Audit App-Schale + Library-Loader`.
