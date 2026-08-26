# Bestands-Audit: Welle 3-III — Galerie + Story-Mode + Chat

Stand: 2026-05-02 (Cloud-Agent, Schritt 0).

**Scope-Hinweis**: Welle 3-III deckt 65 Files in `src/components/library/`
ab — `gallery/`, `chat/`, `story/`, `shared/perspective-*`,
`filter-context-bar.tsx`, `file-category-filter.tsx`. App-Schale
(Welle 3-I) und Archiv-Detail (Welle 3-II) sind bereits refactored;
Hooks-Future-Work (Welle 3-II-Hooks) ebenfalls.

## Zusammenfassung

| Bereich | Eintraege | keep | update | merge | migrate | delete | archive |
|---|---:|---:|---:|---:|---:|---:|---:|
| Cursor Rules | 13 | 12 | 1 | 0 | – | 0 | – |
| Tests | 5 | 5 | 0 | – | 0 | 0 | – |
| Docs | 6 | 4 | 2 | – | – | 0 | 0 |
| **Summe** | **24** | **21** | **3** | **0** | **0** | **0** | **0** |

**Kritische Findings**:

- **F1 — 0 direkte Tests fuer alle 65 Welle-3-III-Files** (verifiziert
  via `node scripts/ui-welle-3iii-stats.mjs`). Char-Test-Backlog →
  Schritt 3 (6 kleine Files in dieser PR) und Sub-Wellen 3-III-a/b/c
  (Hauptkomponenten).
- **F2 — Sehr saubere Hot-Spot-Lage**: 0 leere Catches, 0 `any`,
  0 Storage-Branches in der gesamten Welle (verifiziert). Das ist
  besser als Welle 3-II (7 Catches + 1 Storage-Branch). Vermutlich,
  weil Galerie/Chat juenger sind und nach Erlassung der Konventionen
  geschrieben wurden.
- **F2b — Aber: ~15 "Comment-only-Catches"** in der Welle (nicht von
  ESLint als leer erkannt, aber semantisch Silent Fallback laut
  `no-silent-fallbacks.mdc`):
  - `chat/utils/chat-storage.ts` (6×, alle "Ignoriere Fehler" beim
    LocalStorage-Read)
  - `chat/chat-panel.tsx:77,90,844`, `chat/chat-conversation-item.tsx:115`
  - `chat/hooks/use-chat-{config,history,stream,toc}.ts` (zusammen 6×)
  - `gallery/document-share-button.tsx` (3×, `navigator.share`-Cancel
    + Clipboard-Fallback)
  - `gallery/switch-to-story-mode-button.tsx:137`,
    `gallery/speaker-icons.tsx:38`
  - **Aktion**: NICHT in dieser PR fixen (Vorbereitungs-PR bleibt
    klein). Backlog in `04-altlast-pass.md` notiert; Fix in den
    Sub-Wellen 3-III-a (gallery) und 3-III-b (chat) zusammen mit
    den Modul-Splits.
- **F3 — `chat/chat-panel.tsx` mit 36 Hooks und 1.268 Zeilen** ist der
  groesste UI-Hot-Spot der Welle. Eigene Sub-Welle 3-III-b mit
  Modul-Split + Hook-Extraktion.
- **F4 — `gallery/gallery-root.tsx` mit 49 Hooks und 994 Zeilen** ist
  der zweite grosse Hot-Spot. Sub-Welle 3-III-a mit Modul-Split nach
  View-Modus (items vs grouped vs virtualized).
- **F5 — `shared/perspective-page-content.tsx` mit 13 Hooks und 926
  Zeilen** ist die dritte grosse Datei. Sub-Welle 3-III-c
  (Aufwaerm-Sub-Welle, weil Story + Perspective fachlich
  zusammengehoeren).
- **F6 — `chat/hooks/use-chat-stream.ts` (492z)** und
  `chat/hooks/use-chat-toc.ts` (328z) sind Hook-Files, die selbst
  ueber DoD-Schwelle liegen. Sub-Welle 3-III-b muss die Hooks splitten
  (z.B. Reducer als Pure-Helper).
- **F7 — Chat-Backend-Contracts (`chat-contracts.mdc`)** existieren
  bereits fuer `src/lib/chat/`. UI in `src/components/library/chat/`
  ist Konsument; neue Welle-3-III-Contracts muessen das respektieren.

## A. Cursor Rules

13 von 23 `../../contracts/*.md`-Dateien haben Bezug zur Welle 3-III.

| Rule-Datei | Bezug | Status | Aktion | Begruendung |
|---|---|---|---|---|
| [../../contracts/storage-abstraction.md](../../contracts/storage-abstraction.md) | global, **direkt** (0 Verstoesse) | aktuell | keep | Wird in Welle 3-III bereits eingehalten |
| [../../contracts/no-silent-fallbacks.md](../../contracts/no-silent-fallbacks.md) | global, **direkt** (0 Verstoesse) | aktuell | keep | Wird in Welle 3-III bereits eingehalten |
| [../../contracts/media-lifecycle.md](../../contracts/media-lifecycle.md) | indirekt (Galerie konsumiert Frontmatter-Felder) | aktuell | keep | Galerie-Komponenten lesen Frontmatter, schreiben nicht |
| [../../contracts/chat-contracts.md](../../contracts/chat-contracts.md) | direkt (UI konsumiert chat-Backend) | aktuell | keep | Backend-Contracts, bleiben unangetastet |
| [../../contracts/contracts-story-pipeline.md](../../contracts/contracts-story-pipeline.md) | indirekt (Galerie zeigt Pipeline-Outputs) | aktuell | keep | – |
| [../../contracts/shadow-twin-architecture.md](../../contracts/shadow-twin-architecture.md) | direkt (gallery-root und chat-panel lesen Shadow-Twin-State) | aktuell | keep | Bleibt als Vertrag |
| [../../contracts/welle-3-archiv-detail-contracts.md](../../contracts/welle-3-archiv-detail-contracts.md) | indirekt (`detail-overlay.tsx` ruft Detail-Komponenten auf) | aktuell | keep | Globs decken Welle 3-II ab, nicht 3-III |
| [../../contracts/welle-3-schale-loader-contracts.md](../../contracts/welle-3-schale-loader-contracts.md) | indirekt (App-Schale ist Vorbedingung) | aktuell | keep | Globs decken Welle 3-I ab |
| [../../plans/archiv/reorganizing-components.md](../../plans/archiv/reorganizing-components.md) | direkt (Modul-Split-Empfehlung) | aktuell | keep | Welle 3-III setzt das in Sub-Wellen um |
| [../../plans/archiv/prio1-state-caching-navigation.md](../../plans/archiv/prio1-state-caching-navigation.md) | direkt (Galerie nutzt URL-State, nuqs) | aktuell | keep | – |
| [../../plans/archiv/prio2-logging-errorhandling.md](../../plans/archiv/prio2-logging-errorhandling.md) | direkt (Logging-Vorgabe fuer Chat-Fehler) | aktuell | keep | Wird in Sub-Wellen eingehalten |
| [../../plans/archiv/prio3-init-grundfunktion.md](../../plans/archiv/prio3-init-grundfunktion.md) | indirekt | aktuell | keep | – |
| [../../contracts/refactor-batch-strategy.md](../../contracts/refactor-batch-strategy.md) | direkt (Methodik fuer Sub-Wellen) | aktuell | keep | Wird in 3-III-a/b/c verwendet |
| [../../contracts/refactor-naming-konvention.md](../../contracts/refactor-naming-konvention.md) | direkt (Welle 3-III ist Plan-Welle) | aktuell | **update** | Tabelle in §"Wellen-Stand" um Welle 3-III "in Arbeit" markieren (mache ich im Update-Commit dieser PR) |

**Output dieser Welle (neue Rule)**:
[`../../contracts/welle-3-iii-galerie-chat-contracts.md`](../../contracts/welle-3-iii-galerie-chat-contracts.md) —
wird in Schritt 2 angelegt.

## B. Tests

In-Scope sind alle Tests, die UI-Komponenten der Welle 3-III betreffen.
Aktueller Stand: **0 direkte Tests** fuer die 65 Welle-3-III-Files.

**Bekannte UI-Tests im Repo (Setup-Vorbild aus Welle 3-I/3-II)**:

| Test-Datei | Testet welchen Code | Code existiert? | Vertrag korrekt? | Aktion | Begruendung |
|---|---|---|---|---|---|
| [tests/unit/components/library/library-shell.test.tsx](../../../tests/unit/components/library/library-shell.test.tsx) | Library-Shell (Welle 3-I) | ja | ja | keep | – |
| [tests/unit/components/library/file-list-render.test.tsx](../../../tests/unit/components/library/file-list-render.test.tsx) | FileList (Welle 3-I) | ja | ja | keep | Vorbild fuer Render-Smoke |
| [tests/unit/components/library/markdown-metadata.test.tsx](../../../tests/unit/components/library/markdown-metadata.test.tsx) | MarkdownMetadata (Welle 3-II) | ja | ja | keep | Vorbild fuer Field-Validation |
| [tests/unit/components/library/text-editor.test.tsx](../../../tests/unit/components/library/text-editor.test.tsx) | TextEditor (Welle 3-II) | ja | ja | keep | Vorbild fuer onSave-Vertrag |
| [tests/unit/gallery/](../../../tests/unit/gallery/) | gallery-bezogene Pure-Helper | ja | ja | keep | 5 Files (cover-ref-display-name, doc-source-path, gallery-card-density, map-item-to-doc-card-meta, resolve-cover-url-client) — bestehende Pure-Helper-Tests |

**Out of Scope** (gehoeren zu spaeteren UX-Wellen):
- Tests fuer Settings → Welle 3-IV
- Tests fuer Job/Event-Monitor → Welle 3-V
- Tests fuer Creation-Wizard → Welle 3-VI

## C. Docs

| Doc-Datei | Beschreibt was | Status | Aktion | Begruendung |
|---|---|---|---|---|
| [docs/_analysis/chat-stream-debug.md](../../../docs/_analysis/chat-stream-debug.md) (falls vorhanden) | Chat-Stream-Analyse | falls vorhanden: aktuell | keep | – (wird im Audit-Update geprueft, siehe Verfahren) |
| [docs/refactor/chat/](../../../docs/refactor/chat/) | Backend-Chat-Refactor | aktuell | keep | Backend, beruehrt nicht 3-III |
| [docs/reference/file-index.md](../../../docs/reference/file-index.md) | Datei-Verzeichnis | unvollstaendig (keine Welle-3-III-Komponenten gelistet) | **update** | In Schritt 6 (Doku-Hygiene) Welle-3-III-Komponenten ergaenzen |
| [docs/reference/modules/library.md](../../../docs/reference/modules/library.md) | Library-Modul | aktuell (Welle 3-I + 3-II drin) | **update** | Wird in Sub-Wellen 3-III-a/b/c ergaenzt, sobald Sub-Module final |
| [docs/refactor/welle-3-archiv-detail/06-acceptance-3-ii-GESAMT.md](../06-acceptance-3-ii-GESAMT.md) | Welle 3-II Acceptance | aktuell | keep | Vorbild |
| [docs/refactor/welle-3-ii-hooks/06-acceptance-3-ii-hooks-GESAMT.md](../../welle-3-ii-hooks/06-acceptance-3-ii-hooks-GESAMT.md) | Welle 3-II-Hooks Acceptance | aktuell | keep | Vorbild |

**Bewusst nicht aufgenommen** (ausserhalb Scope oder bereits erfasst):
- `docs/refactor/{storage,secretary,templates,external-jobs,shadow-twin,ingestion}/` — Backend-Wellen
- `docs/refactor/welle-3-schale-loader/` — Welle 3-I
- `docs/refactor/welle-3-archiv-detail/` (ausser GESAMT) — Welle 3-II Sub-Wellen
- `docs/refactor/welle-3-ii-hooks/` (ausser GESAMT) — Welle 3-II-Hooks Sub-Wellen
- `docs/_chats/*` — chronologische Chat-Logs
- `docs/adr/*` — Architektur-ADRs (keine Aenderung)

## Verfahren

1. Vorlage in-place ausgefuellt.
2. Pro Tabelle Status und Aktion entschieden.
3. Zusammenfassung am Anfang aktualisiert.
4. Kritische Findings als Bullet-Liste am Anfang ergaenzt.
5. Commit-Message: `welle-3-iii(audit): Bestands-Audit Galerie + Chat`.
