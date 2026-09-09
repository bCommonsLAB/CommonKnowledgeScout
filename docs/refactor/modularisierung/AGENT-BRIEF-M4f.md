# AGENT-BRIEF M4f — Die Galerie wird Paket: der Weg zur npm-Komponente

Stand: 2026-09-09. Owner-Entscheidung: **Die Galerie wird zuerst als
npm-React-Komponente gebaut, dann eingebettet (AECED), danach P8. Ein iframe
ist keine Option.**

Nachfolger von M4e. M4 hat die Wurzelkomponente ins Paket gebracht und die
Galerie als Slot hereingereicht; dieses Brief beschreibt, wie der Slot
verschwindet. M5 (`@ks/embed`) beginnt erst, wenn `GalleryRoot` aus
`@ks/module-explorer/react` kommt.

## 1. Die Messung (Stand `master` 66ef1f3e)

Der Galerie-Kegel — das, was umziehen soll:

| Ordner | Dateien | Zeilen |
|---|---:|---:|
| `src/components/library/gallery/` | 74 | 12.520 |
| `src/hooks/gallery/` | 17 | 2.262 |
| `src/lib/gallery/` | 9 | 755 |
| `contexts/gallery-*` (3), `atoms/{gallery-*,chat-references,story-context}` (4) | 7 | ~600 |
| **Summe** | **107** | **16.143** |

Was der Kegel **transitiv** aus der App zieht: **82 Dateien, 15.581 Zeilen.**
Alles mitzunehmen waere das Doppelte des Kegels — nein. Der Schnitt liegt bei
den **27 direkt importierten** App-Dateien (Tiefe 1):

| Klasse | Dateien | Zeilen (+ eigener Kegel) | Wird |
|---|---:|---:|---|
| Detail-Renderer (`book-detail`, `session-detail`, 7× `ingestion-*-detail`, `website-landing-live`) | 10 | 1.700 (+ ~5.300) | **Slot** — `Record<DetailViewType, DetailRenderer>` als Prop |
| `chat/chat-panel` (per `next/dynamic`) | 1 | 1.221 | **Slot** `storyPanel` — *in M4f erledigt* |
| `filter-context-bar` (importiert 7 Galerie-Teile, nur `gallery-root` braucht sie) | 1 | 435 | **zieht in den Kegel** — *in M4f erledigt* |
| `story/story-mode-header`, `view-type-badge` | 2 | 109 | ziehen in den Kegel |
| `library-verification-badge` | 1 | 42 (+272) | Slot |
| Helfer: `detail-view-types/registry` 679, `mappers/doc-meta-mappers` 690, `i18n/get-localized` 260, `lib/chat/constants` 817 (ueber `story-context-atom`), `types/item` 228, `utils/document-slug-navigation` 114, `utils/document-navigation` 129, `documents/stakeholder-meta` 59, `templates/detail-view-type-utils` 42, `detail-view-types/view-type-display` 47, `lib/utils` 80, `use-session-headers` 46 | 12 | 3.191 | Paket (`@ks/contracts`/`@ks/util`) oder Kegel — je Posten |

Die Messung nahm beide Anfuehrungszeichen-Formen (`'@/…'` und `"@/…"`) — die
Zusammenfassung der Vorsession hatte doppelt gequotete Importe uebersehen
(`session-detail.tsx` importiert so).

**Next-Bindung im Kegel** vor M4f (das Paket hat kein `next` in den
Abhaengigkeiten): `next/image` in 5 Dateien, `next/navigation` in 3
(`gallery-root`, `switch-to-story-mode-button`, `use-gallery-mode`) plus
`filter-context-bar`, `next/dynamic` in `gallery-root`.
`utils/document-navigation` zieht einen Typ aus `next/dist` — bleibt in der
App, es ist die Bruecke.

**Adress-Vokabular** der Galerie, gezaehlt: `doc`, `mode`, `view`, `sort`,
`starred`, `favorites`, `commented`. Drei Schreib-Formen, abgelesen:
`replace` (Story-Wechsel aus der Detailansicht), `push` (Filter-Knoepfe),
Moduswechsel (`replace` auf `/explore`, `push` auf `/library/gallery`).

**41 `fetch('/api/…')`** mit relativen Pfaden. `@ks/api-client` kennt bereits
`ApiClientConfig.baseUrl`; die Galerie nutzt ihn nicht. Das ist M5, nicht M4.

**Was AECED inhaltlich braucht** (Steckbrief 9, Owner 2026-09-09):
Musterkarten und Methoden sind PDFs, gerendert als `book`, mit eigenen
Frontmatter-Feldern. Eigene Felder sind ueber Facetten filterbar, sortierbar
und als Tabellenspalte sichtbar; die Buch-Detailansicht zeigt nur ihre festen
Felder. Kein neuer `detailViewType` noetig. Story-Modus (ebenfalls gewuenscht):
8 Dateien, 1.317 Zeilen, zieht 3.153 Zeilen Chat-UI und `lib/chat/constants`;
`use-story-context` kennt Clerk. Eigene Welle nach M4i.

## 2. Die Wellen

| Welle | Inhalt | Beweis-Ziel |
|---|---|---|
| **M4f** (dieses Brief) | **Next raus.** Adressierung Teil B, Bilder ueber den Gastgeber, Story-Panel-Slot, `filter-context-bar` in den Kegel | Test: kein `next/*` im Kegel |
| M4g | **Fremde Bausteine als Slots.** Detail-Renderer-Tabelle als Prop, `renderSite`, Verifikations-Badge; Header/Badge ziehen mit | Test: der Kegel importiert nichts aus `components/library/*` ausser sich selbst |
| M4h | **Vokabular in Pakete.** Die 12 Helfer, je nach Messwert nach `@ks/contracts`, `@ks/util` oder in den Kegel. Vermutlich zwei PRs (`registry` und `types/item` sind eigene Posten) | Test: der Kegel importiert nur `@ks/*` und eigene Ordner |
| M4i | **Der Umzug.** `git mv` nach `packages/module-explorer/src/gallery/`; `GalleryRoot` aus `@ks/module-explorer/react`; `client.tsx` wird reiner Montagepunkt | `pnpm typecheck:packages` isoliert gruen; Voll-App unveraendert |
| M5 | **`@ks/embed`.** Basis-URL ueber einen Host-Kontext an alle 41 Fetches, CORS auf den oeffentlichen Lese-Routen, Embed-Adressierung im Speicher (Gast fasst die Wirts-URL nicht an), Bundle mit CSS-Scoping, i18n als Prop | `KnowledgeScoutExplorer` in einer fremden Vite-Seite gegen die Instanz |
| M5b | Story-Modus ins Paket; P8 Headless-API (MCP-Konto-Schluessel) | — |

Jede Welle eine PR unter Budget. Garantien G2 (`git mv`), G4
(Verhaltensneutralitaet) und G5 (Revert) gelten unveraendert.

## 3. M4f — Next raus (umgesetzt)

### Adressierung Teil B

`GalleryNavigation` (`contexts/gallery-navigation-context.tsx`) ist um das
gewachsen, was die drei Dateien vorher direkt vom Router holten:

- `params` — die aktuellen Adress-Parameter, nur lesen
- `replaceParams(next)` — ohne Verlaufseintrag (Story-Wechsel)
- `pushParams(next)` — mit Verlaufseintrag (Filter-Knoepfe)
- `applyModeParams(next)` — Ansichtswechsel; push/replace entscheidet die App nach Route
- `openPerspective(libraryId)` — Sprung zur Perspektiven-Wahl; die App weiss, ob es von der aktuellen Seite aus etwas zu springen gibt

Die **Vokabular-Logik** (`?mode=story` raeumt `doc` und `view` weg …) liegt
jetzt in `lib/gallery/mode-params.ts` — reine Funktionen, 17 Tabellenfaelle.
`NextGalleryNavigation` traegt jede Routenregel mit ihrer Herkunft im
Kommentar; `next-gallery-navigation.test.tsx` haelt sie je Route fest (12
Faelle). `openDocumentBySlug`/`closeDocument` laufen unveraendert (16
Char-Tests).

### Bilder — ohne Verhaltensaenderung

Der Owner wollte die Next-Bildoptimierung behalten. Deshalb kein `<img>` in
der Galerie, sondern eine zweite Frage an den Gastgeber: `GalleryHost.Bild`
ist die Komponente, mit der Bilder gerendert werden. `AppGalleryHost` reicht
`next/image` herein (Prop fuer Prop, `unoptimized` inklusive) — die Voll-App
optimiert exakt wie vorher, auch die Sprecher-Avatare. `STILLER_GASTGEBER`
rendert `SchlichtesBild`, ein `<img>` mit derselben `fill`-Geometrie.

### Slots und Umzug

- Das Chat-Panel kommt als `storyPanel` herein; `client.tsx` laedt es dort
  weiter per `next/dynamic`. Fehlt der Slot, steht „Kein Story-Panel
  montiert." — kein stiller Leerraum.
- `LazyDocGraph` per `React.lazy` + `Suspense`, gleicher Ladehinweis.
- `filter-context-bar.tsx` per `git mv` nach `gallery/`, schreibt ueber `pushParams`.

### Ein Anbieter fuer alles: `GalleryAppProviders`

Lehre aus #248 (oldiesforfuture.org zehn Tage kaputt, weil nach #234 an zwei
Stellen der Adressierungs-Anbieter fehlte): Wer eine Galerie-Karte irgendwo
zeigt, setzt **eine** Huelle — `GalleryAppProviders` (Adressierung +
Gastgeber). Montagepunkte: `client.tsx`, `page.tsx` (Root-Landingpage),
`gallery-teaser-card.tsx`. `karte-ausserhalb-galerie.test.ts` prueft, dass
jede Aufrufstelle sie wirklich montiert.

### Beweis-Ziele — erreicht

1. `galerie-schnitt.test.ts`: „der Galerie-Kegel importiert kein `next/*`"
   ueber alle 107 Dateien. Gegenprobe gelaufen: eine `next/image`-Zeile im
   Kegel macht ihn rot.
2. `mode-params.test.ts`: die Moduswechsel als Tabelle.
3. `next-gallery-navigation.test.tsx`: die Bruecke je Route.
4. Die Slot-Ausnahme fuer den Chat im Schnitt-Test ist weg — die Galerie
   nennt den Chat an keiner Stelle mehr.

### Nicht-Ziele

Keine Detail-Renderer, kein Vokabular-Umzug, kein Byte in `packages/`. Keine
Basis-URL. Kein Story-Modus.

## 4. M4g — fremde Bausteine als Slots (umgesetzt, 2026-09-09)

Der Kegel importiert aus `src/components/library/*` nur noch sich selbst.
Test in `galerie-schnitt.test.ts`, Gegenprobe gelaufen.

**Die Renderer-Tabelle ist eine Prop.** `DETAIL_RENDERERS` liegt jetzt in
`src/components/library/gallery-detail-renderers.tsx` (App) und kommt als
`detailRenderers: Record<DetailViewType, DetailRenderer>` herein — die
Typgrenze ist umgezogen, nicht aufgeweicht. Die Galerie laedt die Doc-Meta,
lokalisiert sie und reicht sie dem Renderer als `docMeta`; das Mapping in
`BookDetailData`/`SessionDetailData` macht der Renderer selbst. Damit sind
auch `lib/mappers/doc-meta-mappers` (690 Zeilen) und die zwei Detail-Typen
aus dem Kegel verschwunden — der M4h-Posten wird kleiner.

**Renderer sind Komponenten, keine Funktionen.** `IngestionBookDetail` und
`IngestionSessionDetail` haengen `initialData` in einen Effekt; ein bei jedem
Render neu gemapptes Objekt wuerde ihn endlos feuern. Die App-Renderer
memoisieren deshalb ueber der Doc-Meta.

**Drei weitere Slots**: `siteView` (Website-Landingpage), `storyHeader`
(Story-Kopf — er zieht `story-header` und `perspective-display` nach sich,
also Story-Glue, das mit dem Story-Modus umzieht), `verifikationsAbzeichen`
(liest Rolle und Verifikations-API der App). `view-type-badge` ist per
`git mv` in den Kegel gezogen.

**Was die Seiten der Voll-App noch mitgeben duerfen**, sagt
`GalleryClientProps` in `client.tsx` — alle Slots setzt der Montagepunkt
selbst.

Stand des Kegels nach M4g: kein `next/*`, kein fremder Baustein aus
`components/library`. Was bleibt, sind die Helfer (M4h).

## 5. Hand-off fuer M4h — Vokabular in Pakete

- **Welle**: M4h. Branch `claude/modularisierung-m4h-<suffix>`. Vermutlich
  zwei PRs.
- **Posten** (Stand nach M4g, neu zu messen): `detail-view-types/registry`
  679, `detail-view-types/view-type-display` 47, `i18n/get-localized` 260,
  `lib/chat/constants` 817 (ueber `story-context-atom`), `types/item` 228,
  `utils/document-slug-navigation` 114, `utils/document-navigation` 129 (nur
  die Bruecke, bleibt App), `documents/stakeholder-meta` 59,
  `templates/detail-view-type-utils` 42, `lib/utils` 80 (`cn` → `@ks/util`),
  `use-session-headers` 46. `doc-meta-mappers` ist erledigt.
- **Je Posten entscheiden**: nach `@ks/contracts` (persistiertes Vokabular),
  nach `@ks/util` (rahmenneutrale Helfer) oder in den Kegel (nur die Galerie
  nutzt es). Messwert: Wer importiert es sonst?
- **Beweis**: ein Fall in `galerie-schnitt.test.ts` — der Kegel importiert
  aus `@/` nur noch seine eigenen Ordner (`components/library/gallery`,
  `hooks/gallery`, `lib/gallery`, `contexts/gallery-*`, die vier Atome).
- **Stop**: `types/item` hat 444 Nutzer. Wenn die Galerie nur `Item` als Typ
  braucht, gehoert der Typ nach `@ks/contracts` — NICHT alle 444 Nutzer
  umstellen. Und `registry` ist mit Einstellungen, Vorlagen und Chat
  geteilt; beide sind eigene Posten, keine Nebenarbeit.
- **Modell**: `claude-opus`, Thinking medium. Neuer Agent; dieses Brief und
  `00-audit-galerie.md` genuegen.
