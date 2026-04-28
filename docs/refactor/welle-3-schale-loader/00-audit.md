# Bestands-Audit: Welle 3-I — App-Schale + Library-Loader

Stand: 2026-04-28 (**Vorlage vom IDE-Agenten — Cloud-Agent fuellt Status- und Aktion-Spalten**).

**Scope-Hinweis**: Welle 3-I deckt App-Schale (`library.tsx`, `library-header.tsx`, `library-switcher.tsx`, `src/app/library/**`) und Library-Loader (`file-list.tsx`, `file-tree.tsx`, `upload-dialog.tsx`, `upload-area.tsx`, `create-library-dialog.tsx`) ab. Detail-View (`file-preview.tsx`, `*-detail.tsx`) ist **nicht** im Scope — gehoert zu Welle 3-II. Galerie/Story/Chat ist Welle 3-III.

## Zusammenfassung (vom Cloud-Agent zu fuellen)

| Bereich | Eintraege | keep | update | merge | migrate | delete | archive |
|---|---:|---:|---:|---:|---:|---:|---:|
| Cursor Rules | TBD | TBD | TBD | TBD | – | TBD | – |
| Tests | TBD | TBD | TBD | – | TBD | TBD | – |
| Docs | TBD | TBD | TBD | – | – | TBD | TBD |
| **Summe** | **TBD** | – | – | – | – | – | – |

**Kritische Findings** (vom Cloud-Agent zu ergaenzen):
- TBD

## A. Cursor Rules (Pflicht-Pruefung)

| Rule-Datei | Bezug zum Modul | Status | Aktion | Begruendung |
|---|---|---|---|---|
| [.cursor/rules/storage-abstraction.mdc](../../../.cursor/rules/storage-abstraction.mdc) | global, **direkt** (UI darf Storage nicht kennen, betrifft Schale + Loader) | TBD | TBD | TBD |
| [.cursor/rules/no-silent-fallbacks.mdc](../../../.cursor/rules/no-silent-fallbacks.mdc) | global, **direkt** (3 leere Catches in dieser Welle) | TBD | TBD | TBD |
| [.cursor/rules/media-lifecycle.mdc](../../../.cursor/rules/media-lifecycle.mdc) | global, indirekt (upload-dialog laedt Medien hoch) | TBD | TBD | TBD |
| `.cursor/rules/storage-contracts.mdc` | indirekt (Welle 1 Modul-Contract) | TBD | TBD | TBD |
| `.cursor/rules/chat-contracts.mdc` | indirekt (chat-Modul von Welle 2; library.tsx kann chat-Tab haben) | TBD | TBD | TBD |
| `.cursor/rules/shadow-twin-contracts.mdc` | indirekt | TBD | TBD | TBD |
| `.cursor/rules/templates-contracts.mdc` | indirekt | TBD | TBD | TBD |
| `.cursor/rules/secretary-contracts.mdc` | indirekt | TBD | TBD | TBD |
| `.cursor/rules/ingestion-contracts.mdc` | indirekt | TBD | TBD | TBD |

**Cloud-Agent**: Liste mit `Glob` `.cursor/rules/*.mdc` alle Rules auf, ergaenze ggf. weitere mit Bezug zur Schale/Loader.

**Output dieser Welle**: Neue Rule `.cursor/rules/welle-3-schale-loader-contracts.mdc` (siehe AGENT-BRIEF Schritt 2).

## B. Tests (Pflicht-Pruefung)

In-Scope sind alle Tests, die UI-Komponenten der Welle 3-I betreffen. Aktueller Stand laut [`01-inventory.md`](./01-inventory.md): **0 direkte Tests** fuer die 16 Welle-3-I-Files.

**Bekannte UI-Tests im Repo (potentielle Vorbilder fuer Schritt 3, hier mit Aktion `keep` zu bewerten)**:

| Test-Datei | Testet welchen Code | Code existiert? | Vertrag korrekt? | Aktion | Begruendung |
|---|---|---|---|---|---|
| [tests/unit/components/app-layout.test.tsx](../../../tests/unit/components/app-layout.test.tsx) | App-Layout, evtl. Vorbild fuer `library.tsx` | TBD | TBD | TBD | TBD |
| [tests/unit/components/top-nav-config.test.ts](../../../tests/unit/components/top-nav-config.test.ts) | Top-Nav-Konfiguration | TBD | TBD | TBD | TBD |
| [tests/unit/components/composite-multi-dialog.test.ts](../../../tests/unit/components/composite-multi-dialog.test.ts) | Dialog-Komponente | TBD | TBD | TBD | TBD |
| [tests/unit/components/public-home-links.test.tsx](../../../tests/unit/components/public-home-links.test.tsx) | Public-Home-Komponente | TBD | TBD | TBD | TBD |
| [tests/unit/components/testimonial-list.test.tsx](../../../tests/unit/components/testimonial-list.test.tsx) | Testimonial-Liste | TBD | TBD | TBD | TBD |

**Out of Scope** (gehoeren zu spaeteren UX-Wellen):
- Tests fuer `file-preview.tsx`, `*-detail.tsx`, `markdown-preview.tsx` → Welle 3-II
- Tests fuer `gallery/`, `story/`, `chat/` → Welle 3-III
- Tests fuer Settings → Welle 3-IV
- Tests fuer Job/Event-Monitor → Welle 3-V

### Test-Coverage-Luecke (fuer Schritt 3 dokumentiert)

Die folgenden Files in Welle 3-I haben **keinen direkten Test**:

- `file-list.tsx` (2.217 Zeilen, 89 Hooks) ← Pilot-Hauptziel fuer Characterization Tests
- `library.tsx` (785 Zeilen, 28 Hooks)
- `file-tree.tsx` (619 Zeilen, 30 Hooks)
- `create-library-dialog.tsx` (435 Zeilen, 13 Hooks)
- `upload-area.tsx` (226 Zeilen)
- `library-header.tsx` (217 Zeilen, 12 Hooks)
- `app/library/create/page.tsx` (207 Zeilen)
- `library-switcher.tsx` (187 Zeilen, 10 Hooks, 1 leerer Catch)
- weitere kleinere Files (siehe `01-inventory.md` Sektion 2)

Cloud-Agent erstellt mind. 8 neue Test-Files in Schritt 3 (siehe AGENT-BRIEF).

## C. Docs (Pflicht-Pruefung)

Cloud-Agent listet mit `Grep` alle `docs/**/*.md`, die folgende Begriffe enthalten:
- `library.tsx` / `LibraryShell` / `library-header` / `library-switcher`
- `file-list.tsx` / `FileList` / `file-tree`
- `App-Schale` / `Library-Loader`
- App-Router-Pfade `src/app/library/`

| Doc-Datei | Beschreibt was | Status | Aktion | Begruendung |
|---|---|---|---|---|
| TBD | TBD | TBD | TBD | TBD |

**Bekannte Doc-Verzeichnisse** (Cloud-Agent prueft systematisch):
- `docs/architecture/*.md` — Architektur-Diagramme, evtl. Schale-Bezug
- `docs/reference/modules/library*.md` — Modul-Referenz
- `docs/reference/file-index.md` — Datei-Verzeichnis
- `docs/refactor/playbook.md` — Methodik (keep, ist Vorlage)
- `docs/refactor/external-jobs/`, `docs/refactor/storage/`, etc. — vorherige Wellen (keep)

## Verfahren fuer den Cloud-Agent

1. Diese Vorlage in-place ausfuellen (TBD-Markierungen ersetzen).
2. Pro Tabelle: alle Status `aktuell` / `veraltet` / `widerspruechlich` setzen, Aktion entscheiden.
3. Zusammenfassung oben aktualisieren.
4. Kritische Findings als Bullet-Liste am Anfang ergaenzen.
5. Commit-Message: `welle-3-i(audit): Bestands-Audit App-Schale + Library-Loader`.
