# Contracts: Welle 3-I — App-Schale + Library-Loader

Stand: 2026-04-28. Zugehoerige Cursor-Rule:
[`.cursor/rules/welle-3-schale-loader-contracts.mdc`](../../../.cursor/rules/welle-3-schale-loader-contracts.mdc).

Diese Datei ist die **menschenlesbare Begleit-Doku** zur Contract-Rule.
Sie erklaert, **warum** die §-Klauseln so formuliert sind und **welche
Bestands-Findings** sie adressieren.

## Bezug zu vorhandenen Architektur-Rules

| Globale Rule | Was sie sagt | Wie diese Welle dazu beitraegt |
|---|---|---|
| [`storage-abstraction.mdc`](../../../.cursor/rules/storage-abstraction.mdc) | UI darf Storage-Backend nicht kennen | §3, §5 verbieten direkte Provider-Imports und `library.type`-Branches |
| [`no-silent-fallbacks.mdc`](../../../.cursor/rules/no-silent-fallbacks.mdc) | `catch {}` und `?? default` ohne Begruendung verboten | §2 macht das fuer Welle 3-I konkret und benennt erlaubte Ausnahmen |
| [`media-lifecycle.mdc`](../../../.cursor/rules/media-lifecycle.mdc) | Frontmatter enthaelt nur Dateinamen | §1 verbietet Frontmatter-Manipulation in UI-Containern |
| [`contracts-story-pipeline.mdc`](../../../.cursor/rules/contracts-story-pipeline.mdc) | Storage-Decisions in Service/Route-Layer | §1 verbietet Service-Logik in UI-Containern |
| [`shadow-twin-architecture.mdc`](../../../.cursor/rules/shadow-twin-architecture.mdc) | UI fragt nur abstrakte Faehigkeiten ab | §5 verbietet `primaryStore`-Branches |
| [`reorganizing-components.mdc`](../../../.cursor/rules/reorganizing-components.mdc) | Datei < 200 Zeilen | §6 fixiert das fuer den `file-list.tsx`-Split |

## §1 Determinismus — UI-Container ohne Business-Logik

**Warum?** Die App-Schale und der Library-Loader sind die zentrale
Render-Ebene fuer alle nachfolgenden UX-Wellen (Detail-View, Galerie,
Chat, Settings). Wenn dort Business-Logik liegt, breitet sich Drift
in jede Sub-Welle aus.

**Bestands-Befund (Inventur)**:

- `library.tsx` (785 Zeilen) ist heute eher Container-mit-Loading-Logik.
  Es enthaelt aber `loadItems()`-Logik (Zeilen 186-420), die **rein
  UI-Container-Aufgabe** ist (Atom-Update + Cache-Pflege). Das ist
  konform — kein Refactor noetig in dieser Welle.
- `file-list.tsx` (2.217 Zeilen) hat 89 Hooks. Etliche davon sind
  Business-Logik (`useShadowTwinAnalysis`, `findFileGroup`,
  Composite-Multi-Logik). Aufgabe in Schritt 4b: **Hooks in eigene
  Module verschieben** (`hooks/use-file-list-data.ts`,
  `hooks/use-file-list-selection.ts`).

## §2 Fehler-Semantik

**Warum?** Drei leere Catches existieren in dieser Welle (Inventur F2):

| Datei:Zeile | Was wird gefangen? | Aktuelle Behandlung | Sollverhalten |
|---|---|---|---|
| `library-switcher.tsx:89` | `localStorage.setItem('activeLibraryId', value)` | leerer `catch` | Kommentar + bewusst still (Quota-Exceeded / Privacy-Mode) |
| `library-switcher.tsx:109` | `router.replace('/library')` | leerer `catch {}` | Kommentar oder Logging — Navigation darf nicht still scheitern |
| `app/library/page.tsx:41` | `router.replace(...)` mit URLSearchParams-Aenderung | leerer `catch {}` | Kommentar oder Logging |
| `file-list.tsx:1391` | `library_refresh`-Event-Handler (folder-id-Vergleich + Trigger) | leerer `catch {}` | Logging via `FileLogger.warn` — Event-Verarbeitung soll zumindest sichtbar werden |

**Aktion**: Schritt 4a fixt die ersten drei, Schritt 4b den vierten im
Modul-Split.

**Erlaubte Catches** (mit Kommentar):

- `file-list.tsx:112-114` — `resolve-binary-url`-Aufruf fuer Cover-
  Thumbnail. Das Thumbnail ist optional, ein Platzhalter wird gerendert.
  Catch enthaelt Kommentar "// Fehler still ignorieren (Thumbnail
  optional)" — konform.
- `library.tsx:160-168` — `getItemById(openFileId)` schlaegt fehl, wenn
  das Dokument geloescht/umbenannt wurde. Catch loggt via
  `NavigationLogger.warn` — konform.

## §3 Erlaubte / verbotene Abhaengigkeiten

**Warum?** Pilot-Welle (storage) hat gezeigt: ein direkter
Provider-Import in einer UI-Komponente ist die haeufigste Quelle fuer
spaetere Storage-Drift. Diese Rule verhindert das fuer Welle 3-I.

**Verifikation jetzt** (vor Refactor):

```bash
rg "from '@/lib/storage/(filesystem|nextcloud|onedrive)" \
  src/components/library/library*.tsx \
  src/components/library/file-list.tsx \
  src/components/library/file-tree.tsx \
  src/components/library/upload-dialog.tsx \
  src/components/library/upload-area.tsx \
  src/components/library/create-library-dialog.tsx \
  src/app/library/
```

Ergebnis: leer. Welle 3-I ist konform — der `useStorage()`-Context und
die zentralen Helper sind die einzigen Storage-Touchpoints.

## §4 Skip- / Default-Semantik

**Warum?** Stille leere States machen Library-Bugs unsichtbar.
Wenn `provider.listItemsById('root')` fehlschlaegt, soll die UI **sichtbar**
zeigen, dass etwas fehlt.

**Bestands-Befund**:

- `library.tsx:534-549` zeigt sichtbare Hinweise fuer `waitingForAuth`
  und `!== 'ready'`. Konform.
- `app/library/page.tsx:107-137` zeigt eine "Keine Bibliotheken
  vorhanden"-Card mit Action-Button. Konform.
- `file-list.tsx` zeigt bei leerem Folder einen "Keine Dateien"-Hinweis
  (Verifikation in Schritt 3 via Char-Test).

## §5 Storage-Branches im UI verboten — Helper sind erlaubt

**Warum?** Verstoesse gegen `storage-abstraction.mdc` sind die
gefaehrlichsten Drift-Quellen, weil sie sich tief in der UI verteilen.
Welle 3-I hat **0 Verstoesse** — soll so bleiben.

**Einziger relevanter Touchpoint**:

- `file-list.tsx:902-904`: `shouldFilterShadowTwinFolders(activeLibrary?.config?.shadowTwin)`.
  Das ist ein **Helper-Aufruf**, kein Branch. Der Helper kapselt die
  Detail-Entscheidung in `src/lib/storage/shadow-twin-folder-name.ts`.
  Konform mit `storage-contracts.mdc` §5.

**Aktion**: Falls beim Modul-Split (Schritt 4b) der Aufruf in eine neue
Sub-Komponente wandert, **bleibt** er ein Helper-Aufruf. Kein direkter
`primaryStore === 'mongo'`-Branch erlaubt.

## §6 Modul-Split-Vertrag (`file-list.tsx`)

**Warum?** 2.217 Zeilen + 89 Hooks ist nicht reviewbar und nicht
testbar. Modul-Split ist die Voraussetzung fuer Char-Tests und
Folge-Wellen.

**Schritt 4b liefert**:

- `src/components/library/file-list/index.tsx` als Composer-Fassade
  (Export `FileList`).
- Sub-Module nach Verantwortung (siehe Rule §6).
- Jede Sub-Datei < 250 Zeilen (Ziel < 200).
- Char-Tests aus Schritt 3 muessen **nach jedem Sub-Split** gruen
  bleiben — sie sind das Sicherheitsnetz.

**Risiko**:

- React-Hooks-Reihenfolge muss erhalten bleiben (Hook-Reihenfolge ist
  Teil des Render-Lifecycles).
- Drag&Drop-State und Selection-State sind mit Atoms verbunden —
  kein State-Schema-Change in dieser Welle, nur Strukturierung.

## §7 `'use client'`-Direktiven minimieren

**Bestands-Befund**:

- 13 von 16 Welle-3-I-Files haben `'use client'`. Davon sind die
  3 ohne `'use client'` bereits Server-Komponenten:
  - `src/app/library/gallery/page.tsx` (17 Zeilen, Server-Composer)
  - `src/components/library/library.tsx` (785 Zeilen — **Server**?
    Verifikation: ja, hat keine `'use client'`-Direktive trotz
    `useAtom`-Aufrufen — das ist ein bestehendes Anti-Pattern).
  - `src/components/library/library-header.tsx` (217 Zeilen).

**Achtung — Pre-Existing-Issue**: `library.tsx` und `library-header.tsx`
ohne `'use client'`-Direktive verwenden `useAtom`/`useState` — das
funktioniert nur, weil sie via `<Library />` in einer client-Komponente
(`src/app/library/page.tsx`) eingebettet werden, die ihrerseits
`'use client'` hat. **Korrekter Praxis-Stand**: Datei ohne
`'use client'` ist im Next.js-App-Router-Sinne nominell Server,
de-facto aber Client weil sie nur im Client-Subtree gerendert wird.
Pragma-Fix: nicht in dieser Welle (Risiko fuer Build-Brueche).
Folge-Welle: pruefen, ob `'use client'` explizit gesetzt werden sollte.

**Aktion in Welle 3-I**: Bei neuen Sub-Komponenten in `file-list/`
KEINE `'use client'`-Direktive setzen, weil sie ueber den
Composer-Index importiert werden. Falls Sub-Komponente neue
Client-API verwendet (Browser-API, eigene `useState`), Direktive
explizit setzen.

## §8 Code-Review-Checkliste

Siehe Rule §8. Wird in Schritt 7 (Abnahme) als CI-Check eingefordert.

## Bezug zur Inventur (01-inventory.md)

| Inventur-Befund | Adressiert von | Aktion |
|---|---|---|
| 3 leere Catches | §2 | Schritt 4a + 4b |
| `file-list.tsx` 2.217 Zeilen, 89 Hooks | §6 | Schritt 4b (Modul-Split) |
| 0 `any` | §3 (Aufzählung erlaubter Imports inkl. Helper) | nichts |
| 0 Storage-Branches | §5 | nichts (Helper-Aufruf in `file-list.tsx:902` bleibt) |
| 13 `'use client'` | §7 | Folge-Welle (siehe Kommentar oben) |
| 0 direkte Tests | §1, §6 (Determinismus + Modul-Split) | Schritt 3 |
