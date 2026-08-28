# Agent-Brief: Modularisierung — Welle M4e (`library-atom` → `@ks/shell/react`)

Stand: 2026-08-28. Analog [`AGENT-BRIEF-M4d.md`](AGENT-BRIEF-M4d.md).

Namensbegründung: `M5` ist im Wellenplan der Landkarte §5 für den AECED-Pilot
(`@ks/embed`) reserviert. Diese Welle setzt — wie M4b bis M4d — die
Mutter-Welle M4 fort und bekommt daher nach
[`refactor-naming-konvention.md`](../../contracts/refactor-naming-konvention.md)
R2 den Mutter-Namen mit Suffix.

Der Auftrag kam aus dem Hand-off von M4d: **`library-atom` zuerst in die
Schale, danach die TopNav prüfen.**

## Kontext (lies das ZUERST, in dieser Reihenfolge)

1. **`CLAUDE.md`** — Routing-Index, Coding-Konventionen.
2. **`AGENTS.md`** §Aktueller Fahrplan.
3. **[`migrations-strategie.md`](../../architecture/migrations-strategie.md)** — G2, G3, G4.
4. **[`modul-landkarte.md`](../../architecture/modul-landkarte.md)** §1
   (`@ks/shell`), §4 (Grenzregeln — Injection statt Rück-Import), §6
   (Jotai über Paketgrenzen).
5. **[AGENT-BRIEF-M4c.md](AGENT-BRIEF-M4c.md)** §2 — die Hook-Oberfläche, wie
   `@ks/i18n/react` sie erstmals durchgezogen hat.

## Der Befund, der die Welle bestimmt

`src/atoms/library-atom.ts` (413 Zeilen) hieß nach der Library, hielt aber
**drei Zustände** in einer Datei — und die gehören in drei verschiedene Pakete:

| Anteil | Was | Zielort |
|---|---|---|
| Auswahl | `libraries`, `activeLibraryId`, Status | `@ks/shell` (Landkarte §1, Schicht 2) |
| Ordner-Navigation | `currentFolderId`, `folderCache`, Baumzustand | später `@ks/module-archive` |
| Dateiliste + Annotationen | Items, Auswahl, Suche/Sortierung, DIVA | später `@ks/module-archive` |

Schlimmer als die Datei war das **gemeinsame Zustandsobjekt**: `LibraryState`
trug `libraries` und `activeLibraryId` neben `currentFolderId` und
`folderCache`. Wer die Auswahl extrahieren wollte, hätte den Ordner-Cache des
Archivs mit in die Schale genommen — jede Site trüge dann Archiv-Zustand, auch
wenn sie kein Archiv aktiviert.

## Die Entscheidungen der Welle

### 1. Das Zustandsobjekt wird geteilt, nicht mitgenommen

`LibraryState` → `LibrarySelectionState` (Schale) + `FolderNavigationState`
(App). Verhaltensneutral: Die kombinierten Schreibzugriffe in
`use-folder-navigation` bleiben je ein Setter-Aufruf, nur auf dem kleineren
Atom. Sieben Dateien schrieben `folderCache` über `libraryAtom` — sie schreiben
jetzt über `folderNavigationAtom`.

### 2. Hook-Oberfläche, Atome bleiben paketintern

Das ist die Fortsetzung der Entscheidung aus Landkarte §6, die M4c an
`@ks/i18n/react` erstmals durchgezogen hat. `@ks/shell/react` exportiert acht
Hooks und **kein Atom**:

`useLibraries`, `useSetLibraries`, `useActiveLibraryId`,
`useSetActiveLibraryId`, `useActiveLibrary`, `useNoLibrarySelected`,
`useLibraryStatus`, `useSetLibraryStatus`.

Getrennte Lese- und Schreib-Hooks statt eines `useAtom`-Tupels: `useSetAtom`
abonniert nicht, wer nur schreibt rendert also nicht mehr mit. Fünf Dateien
hatten genau diese Form (`const [, setActiveLibraryId] = useAtom(…)`); sie
lesen den Wert nachweislich nicht, das eingesparte Rendern ändert nichts.

### 3. Der Preis der Hook-Oberfläche: fünf abgeleitete Atome mussten weichen

**Das ist die Arbeit, die der Hand-off nicht vorhergesehen hat.** Ein Atom kann
keinen Hook lesen. Fünf abgeleitete Atome der App lasen aber die Auswahl mit:

| Atom | las | Verwender |
|---|---|---|
| `searchTermAtom`, `sortFieldAtom`, `sortOrderAtom` | `activeLibraryIdAtom` (Schlüssel der `atomFamily`) | `file-list.tsx` |
| `sortedFilteredFilesAtom` | zusätzlich `activeLibraryAtom` (DIVA-Schalter) | `file-list.tsx` |
| `currentPathAtom` | `activeLibraryAtom` (Name der Wurzel) | Breadcrumb, Batch-Dialog, Integrationstests |

Sie sind jetzt **reine Funktionen mit Hooks davor**:
`src/lib/file-list/filter-sort.ts`, `src/lib/file-list/current-path.ts`,
`src/hooks/use-file-list-view.ts`. Der Filter-Vertragstest
(`file-list-filter.test.tsx`, 9 Fälle) prüft dieselben Fälle jetzt direkt an
der reinen Funktion — ohne Jotai-Store, dafür ohne Umweg.

### 4. Der Galerie-Filter-Reset wird hereingereicht, nicht importiert

Der Setter von `activeLibraryIdAtom` setzt beim Wechsel `galleryFiltersAtom`
zurück — Facetten und `shortTitle` hängen an der Bibliothek. Ein Paket, das
dafür `@/atoms/gallery-filters` importiert, griffe zurück in die App
(Landkarte §4 verbietet das).

Also Injection, das Muster von `packages/viewers/src/logger.ts`:
`registerActiveLibraryChangeEffect()` in der Schale, `LibraryChangeBridge` in
der Provider-Kette von `layout.tsx` reicht herein, was zu tun ist.

**Der Effekt bekommt den Jotai-`set` der laufenden Schreiboperation** — das ist
kein Durchreichen des Stores, sondern die Bedingung für Verhaltensneutralität:
ein nachgelagerter `useEffect` würde einen Zwischenzustand mit neuer Bibliothek
und alten Filtern rendern.

### 5. `@ks/shell/testing` — eine Schreib-Funktion, kein Atom-Export

Neun Testdateien setzten den Zustand mit `store.set(librariesAtom, …)` vor dem
ersten Render. Das geht ausserhalb von React, ein Hook hilft dort nicht. Statt
die Atome dafür zu exportieren (und damit die Entscheidung aus §2 zu
unterlaufen) bekommt das Paket einen dritten Einstiegspunkt mit **genau einer**
Funktion: `seedLibrarySelection(store, { libraries, activeLibraryId, status })`.
Bewusst nur schreibend.

Sie läuft durch denselben Setter wie zur Laufzeit — Tests lösen die
Wechsel-Effekte also genauso aus wie der Betrieb.

## Reihenfolge (jeder Schritt eigener Commit)

1. Ordner-Navigation aus dem Zustandsobjekt lösen (Entscheidung 1).
   **Isoliert testbar**, 562 Zeilen Diff.
2. Die fünf abgeleiteten Atome in Hooks überführen (Entscheidung 3).
   Noch gegen die App-Atome — dadurch unabhängig prüfbar. 637 Zeilen.
3. Umzug nach `@ks/shell/react` samt `@ks/shell/testing`, Bridge und
   Migration von 84 App- und 8 Testdateien. 974 Zeilen.
4. Cleanup: unbenutzte `jotai`-Importe (55 Zeilen).

Schritt 3+4 wären am Stück 1.015 Zeilen gewesen und hätten das harte
1.000-Zeilen-Limit aus
[`refactor-batch-strategy.md`](../../contracts/refactor-batch-strategy.md)
gerissen; der Schnitt liegt an der Naht, die die Cleanup-Pflicht ohnehin
vorsieht.

## Definition of Done — Stand nach der Welle

- [x] `@ks/shell/react` hält den Auswahl-Zustand; **kein Atom** verlässt das Paket
- [x] `@ks/shell/testing` ist die einzige Schreib-Öffnung nach aussen
- [x] Der Galerie-Filter-Reset läuft per Injection, in derselben Transaktion
- [x] Kein App-Atom leitet mehr von Schalen-Zustand ab
- [x] `src/atoms/library-atom.ts` (413 → 148 Zeilen) hält nur noch Dateiliste
      und Annotationen; `folder-navigation.ts` (75) die Navigation
- [x] `pnpm test` (3428 grün, wie vorher), `pnpm lint` (0 Errors),
      `pnpm typecheck:packages` grün, `tsc -p tsconfig.json` unverändert
      2 Altfehler in `src/lib/mcp/tools-vorlagen.ts` (vorher wie nachher
      dieselben — nicht von dieser Welle)
- [ ] `bash scripts/welle-pre-merge-check.sh` lokal grün **vor** dem Merge
      — **offen, gehört dem Owner** (der Cloud-Agent fährt keinen Build)
- [x] Voll-App unverändert (Verhaltensneutralität, Migrationsstrategie G4)

### Was den Build betrifft

Der M4b-Fehlermodus (Client-Code im react-server-Layer) ist hier eingegrenzt,
nicht ausgeschlossen: `@ks/shell/react` und `@ks/shell/testing` sind neue
Einstiegspunkte, die Jotai ziehen — das Wurzel-Barrel `@ks/shell` bleibt
davon unberührt und weiter frei von React (die Middleware liest dort die
Host-Auflösung). Jede Datei unter `src/react/` trägt `"use client"`. Wird
`pnpm build` trotzdem rot, ist die erste Frage, ob eine Server-Datei
versehentlich `@ks/shell/react` statt `@ks/shell` importiert.

## Abweichungen vom Hand-off (bewusst, nicht übersehen)

1. **Es war nicht „der kleinste ehrliche Schritt".** Der Hand-off aus M4d
   schätzte `library-atom` als kleinen Schritt und empfahl Sonnet. Tatsächlich
   sind es 104 Dateien und vier Commits — nicht wegen der Atome selbst
   (81 Zeilen), sondern wegen der 84 Verwender und der fünf abgeleiteten Atome
   aus Entscheidung 3. Wer die nächste Welle plant, sollte die
   Hook-Oberfläche nach der Zahl der Verwender bemessen, nicht nach der Größe
   des Atoms.
2. **Die Datei ist nicht mitgewandert, nur ihr Auswahl-Anteil.** `git mv`
   (G2) war hier nicht möglich: Zwei Drittel der Datei gehören ins
   Archiv-Modul, nicht in die Schale. Wie bei der `cn`-Teilextraktion in M4b
   hält `git log --follow` das nicht.
3. **Keine Fassade am alten Pfad.** G2 erlaubt sie, hier trägt sie nicht: Eine
   Fassade kann einen Atom-Import nicht in einen Hook-Aufruf verwandeln. Die
   84 Verwender mussten in derselben Welle mit.
4. **`ClientLibrary` statt `ReturnType`-Akrobatik.** Zwei Settings-Hooks
   deklarierten ihren Rückgabetyp als
   `ReturnType<typeof useAtomValue<typeof librariesAtom>>[number]`. Ohne
   exportiertes Atom ging das nicht mehr — sie nennen den Typ jetzt beim Namen
   (er liegt seit M4d in `@ks/contracts`).
5. **`library-header.tsx` liest die aktive Bibliothek jetzt direkt.** Es baute
   sich den Namen aus `libraries.find(l => l.id === activeLibraryId)` selbst
   zusammen — genau das, was `useActiveLibrary()` tut.
6. **`useNoLibrarySelected` hat null Verwender** — wie schon das Atom davor:
   Der einzige Treffer war ein Kommentar in `storage-context.tsx`, der auf den
   Zustand als Entwurfsentscheidung verweist (kein Auto-Select der ersten
   Bibliothek). Mitgenommen und hier benannt statt still gelassen — wie
   `icons.tsx` in M4b ein Löschkandidat, kein Versehen.

## Hand-off für die nächste Welle

**Zurück zur Landkarten-Zeile M4**: die montierbare
Explorer-Wurzelkomponente. Das Fundament ist vollständig — `@ks/ui` (M4b),
`@ks/i18n` (M4c), Library-Steckbrief (M4d), Library-Auswahl (M4e).

### Die TopNav, wie sie jetzt dasteht

Der zweite Teil des Auftrags war „danach die TopNav prüfen" — geprüft, nicht
verschoben. Der Befund steht im Abschnitt „TopNav — Befund" weiter unten.
Kurzfassung: Der Auswahl-Blocker ist weg, **Clerk ist der eigentliche
Prüfstein**, und zwei der sechs Abhängigkeiten ziehen zusammen ~4.700 Zeilen
App-Code nach. Der Weg dahin ist eine Props-/Slot-Oberfläche, keine
Mitnahme — die TopNav rendert beide nur als eigenständige Elemente.

### Was diese Welle NICHT angefasst hat

- `src/lib/chat/constants.ts` (892 Zeilen) — unverändert der größte
  Contracts-Kandidat, weiterhin eine eigene Welle.
- `src/types/library.ts` (442 Zeilen) — reißt die 200-Zeilen-Regel weiter.
- `src/components/library/library.tsx` und `file-list.tsx` sind die beiden
  größten Verwender der Ordner-Navigation und damit die eigentliche Arbeit,
  wenn `@ks/module-archive` an die Reihe kommt.

**Modellempfehlung**: Opus mit hohem Thinking-Level für die Explorer-Wurzel
oder die TopNav-Props-Oberfläche (Entwurfsarbeit). Für reine Verschiebungen
reicht Sonnet — aber siehe Abweichung 1: „reine Verschiebung" ist bei einer
Hook-Oberfläche selten die ganze Wahrheit.

**Zwingend für jede weitere A-Welle** (Lehre aus M4b): `pnpm build` gehört vor
den Merge, nicht danach. `check-build` fährt den Docker-Build nicht.

## TopNav — Befund (geprüft, nicht verschoben)

`src/components/top-nav.tsx` (451 Zeilen) hat nach dieser Welle noch **neun
`@/`-Importe**. M4c hatte fünf Hindernisse gelistet; `library-atom` ist mit
dieser Welle erledigt, die anderen sind gemessen:

| Abhängigkeit | Zeilen (transitiv) | Clerk | Verschiebbarkeit |
|---|---|---|---|
| `job-monitor-panel-open-atom.ts` | 7 | nein | **leicht** — ein Atom, nur `jotai` |
| `site-logo.tsx` | 79 | nein | **leicht** — NULL `@/`-Importe, nur `fetch` auf eine öffentliche Route |
| `use-scroll-visibility.ts` | 62 | nein | **leicht** — reines React |
| `language-switcher.tsx` | 58 | nein | **leicht** — nur `@ks/i18n` + `@ks/ui` |
| `use-user-role.ts` | 58 | **ja, direkt** (`useUser`) | **mittel** — fachlich trivial, aber Clerk |
| `use-site-menu-items.ts` | 91 | nein | **mittel** — zieht über `fetchDocs` ungewollt `doc-meta-mappers` (689) + `get-localized` (259) mit; `fetchDocs` ist selbst 15 Zeilen und benutzt davon nichts |
| `library-switcher.tsx` | 202 (≈1.600) | nein | **mittel–schwer** — vier App-Atome, `StateLogger`, `create-library-dialog` (427) mit `/api/libraries` + `/api/templates` |
| `create-library-wizard.tsx` | 133 (≈3.100) | **ja, indirekt** über `use-safe-user` | **schwer** — zieht `use-library-form` (818), `content-type-section` (236), `FacetDefsEditor` (601), Detail-View-Registry (681) |

### Was daraus folgt

1. **Clerk ist der Prüfstein, nicht die Menge.** `top-nav.tsx` rendert
   `SignedIn`/`SignedOut`/`SignInButton`/`UserButton` an neun Stellen selbst,
   und `useUserRole` ruft `useUser`. `@ks/shell` ist heute Clerk-frei
   (`package.json`: nur `@ks/contracts` plus Peers `jotai`, `react`,
   `next-themes`, `react-query`). Die Landkarte §1 verlangt aber „Auth (Clerk,
   **abschaltbar**)" — die TopNav zu verschieben heißt also zuerst, das
   Auth-Modell der Schale zu entwerfen. Das ist Entwurfsarbeit, keine
   Verschiebung, und sie sollte NICHT nebenbei in einer TopNav-Welle passieren.
2. **Die beiden schweren Teile sind Slots, keine Abhängigkeiten.**
   `LibrarySwitcher` und `CreateLibraryWizard` erscheinen im JSX nur als
   eigenständige Elemente. Eine Props-Oberfläche (die Schale reicht herein, was
   die TopNav zeichnen soll) löst ~4.700 Zeilen auf, ohne sie anzufassen —
   genau die Frage, die M4c offengelassen hatte. Die Antwort lautet: **ja, die
   Props-Oberfläche trägt.**
3. **Vier Kleinteile könnten sofort mit** (Atom, `site-logo`,
   `use-scroll-visibility`, `language-switcher`, zusammen ~206 Zeilen, alle
   Clerk-frei). Sie allein zu verschieben lohnt aber nicht: Ohne die
   Auth-Entscheidung bleibt die TopNav trotzdem in der App.

### Empfehlung für die nächste Welle

Die TopNav ist **nicht** der kleinere Test, für den M4c sie hielt — sie ist
durch Clerk an eine offene Architekturfrage gekoppelt. Zwei saubere Wege:

- **Explorer-Wurzel zuerst** (Landkarten-Zeile M4, das eigentliche Ziel). Sie
  braucht kein Clerk und kann auf dem jetzt fertigen Fundament aufsetzen.
- **Oder eine eigene Welle „Auth abschaltbar in der Schale"** vor der TopNav —
  mit ADR-Charakter, nicht als Beifang.

Was NICHT zu tun ist: die TopNav verschieben und Clerk als harte Abhängigkeit
in `@ks/shell` mitnehmen. Das machte jede Site auth-pflichtig und widerspräche
Landkarte §1, Schicht 2.

## Stop-Bedingungen (zusätzlich zu AGENTS.md)

- Ein Modul will ein Atom aus `@ks/shell` ableiten → **nicht** exportieren,
  sondern den abgeleiteten Wert als Hook in der Schale anbieten oder die
  Ableitung als reine Funktion schneiden (Muster: `@/lib/file-list/`).
- `seedLibrarySelection` wird um eine Lese-Funktion erweitert → abbrechen; das
  wäre der Atom-Export durch die Hintertür.
