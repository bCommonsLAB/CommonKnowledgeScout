# Plan 1 · A4 — gemischte Galerie/Story aufpolieren (Design & Bauplan)

> Detail-Plan zu **A4** aus
> [`roadmap-formatunabhaengige-library-und-onboarding.md`](roadmap-formatunabhaengige-library-und-onboarding.md).
> Stand 2026-06-18. Sprache bewusst einfach. Code englisch, Kommentare/Commits deutsch.
>
> **Vorgelagert erledigt (auf `master`, NICHT neu bauen):** A1
> (`src/lib/library-verification/**`, Repo, SSE-Route, Veröffentlichungs-Warnung)
> und A2 (Badge/Experten-UI/Basis-Facetten-Sperre). Dieses Dokument betrifft NUR A4.

## 1) Was A4 ist (und was nicht)

A4 macht eine **themenzentrierte Library mit gemischten Inhaltstypen** (mehrere
`detailViewType` in EINER Library) in der Galerie/Story sauber bedienbar. Drei
Bausteine laut Roadmap:

- **A4a — Typ als Leitfilter, adaptive Facetten.** Der Inhaltstyp ist der erste
  Filter. Ohne Typ-Wahl zeigt die Seitenleiste nur die **gemeinsamen** Facetten
  der vorhandenen Typen; mit Typ-Wahl passen sich die übrigen Facetten an den Typ
  an, und die Liste zeigt streng nur Dokumente dieses Typs. (Entschieden
  2026-06-18 — ersetzt die frühere „OR-Vereinigung", siehe §6.)
- **A4b — Tabellen-Spalten je Typ.** Die Tabellenansicht soll Spalten passend zu
  den vorhandenen Typen führen, statt einer starren Einheits-Spaltenmenge.
- **A4c — Story-Verweise je Dokument formatgerecht.** Verweise/Anhänge in einer
  Story sollen je nach Format gerendert werden (Audio → Player, Video → Embed,
  Bild → Vorschau, PDF → Dokument-Button, Web → Link), nicht „PDF vs. Link".

A4 arbeitet auf **Dokument-Daten + Anzeige**. Es ändert NICHT die Template-/
Erfassungs-Mechanik (das ist Plan 2). A3 gehört NICHT hierher (→ Plan 2).

## 2) Bestandsaufnahme (verifizierte Fundstellen)

### Facetten-Engine
- `src/lib/chat/dynamic-facets.ts:30` — `parseFacetDefs(library)` erzeugt **eine**
  typisierte Facettenliste pro Library: Basis-Facetten (erzwungen, zuerst) +
  konfigurierte Zusatz-Facetten (`library.config.chat.gallery.facets`). Kennt die
  Dokument-Typen NICHT.
- `src/lib/chat/dynamic-facets.ts:107` — `buildFilterFromQuery` baut den
  Mongo-Filter rein additiv (`$in` je Facette, alle mit UND verknüpft).
- `src/app/api/chat/[libraryId]/facets/route.ts` + `…/docs/route.ts` — wenden
  denselben Filter library-weit an (kein Typ-Scoping).
- `src/lib/repositories/vector-repo.ts` → `aggregateFacets(...)` — `$facet`-Pipeline
  über `kind:'meta'` Dokumente; Filter als globales `$match`.

### Registry / Typ-Metadaten
- `src/lib/detail-view-types/registry.ts` — `VIEW_TYPE_REGISTRY` mit
  `requiredFields`/`optionalFields` je Typ, aber **ohne Facetten-Typ** (string vs.
  string[]). `getTableColumnsForViewType(viewType)` (Zeile 601) existiert,
  liefert Spalten je Typ — wird aber **NICHT** in der Galerie verwendet.
- `src/lib/detail-view-types/base-fields.ts` — `BASE_FACET_DEFS` (typisiert),
  `isBaseFacetField`, `missingBaseFields`. Quelle der Wahrheit für Basis-Facetten.

### Galerie-Tabelle
- `src/components/library/gallery/virtualized-items-view.tsx:257` — `tableColumns`:
  bewusste Entscheidung (Zeile 266) — ohne `showInTable`-Facetten NUR `title` +
  `upsertedAt` (plus Owner-Spalten `publication`/`languages`, plus climateAction
  `__priorityIndex`). **Spalten kommen heute aus den Galerie-Facetten, nicht aus
  dem Typ.**
- `…virtualized-items-view.tsx:322` — `getCellValue(doc, key)` liest jeden
  Spaltenwert robust (fehlend → „-"). Per-Zeilen-Inhalt ist schon typ-tolerant.
- `src/components/library/gallery/gallery-root/helpers.ts` —
  `pickFacetsForTableColumns(facets)` (Spalten aus `showInTable`),
  `resolveDetailViewTypeForDoc(...)` (per-Dokument-Typ mit Fallback).
- `src/lib/gallery/types.ts` — `DocCardMeta.detailViewType?` ist **per Dokument**
  vorhanden. Die Galerie hat die vorhandenen Typen also client-seitig (aus
  `docsByYear`) ohne Storage-Zugriff.

### Story / Verweise
- `src/components/library/shared/story-view.tsx` — dispatcht nach `detailViewType`
  auf `BookDetail`/`SessionDetail` (Testimonial/Blog noch Fallback, TODOs Zeile
  133/141).
- `src/components/library/book-detail.tsx:305` `isPdfUrl()` + `:323`
  `classifyAttachments()` — kennt nur **PDF vs. Link**. Audio/Video/Bild-Verweise
  werden nicht formatgerecht dargestellt.
- `src/components/library/file-preview/extension-map.ts` → `getFileType(fileName)` —
  fertige Format-Erkennung (markdown/video/audio/image/pdf/office/website). Plus
  `src/components/library/file-preview/views/*` als Per-Format-Renderer-Vorbild.

## 3) Design-Konflikte — durch Owner-Entscheidung 2026-06-18 aufgelöst

Die zwei früheren Konflikte sind jetzt **entschieden** (Details + Begründung in
§6). Kurzfassung des gewählten Modells:

- **Typ als Leitfilter (A4a).** Der Inhaltstyp ist der **erste** Filter. Ohne
  Typ-Wahl zeigt die Seitenleiste **nur gemeinsame Facetten**; mit Typ-Wahl
  **passen sich die übrigen Facetten an** den Typ an und die Liste zeigt
  **streng nur** Dokumente dieses Typs. → Kein „OR-über-Typen" nötig (das
  strenge Filtern macht die komplexe Server-Aggregation überflüssig).
- **Tabellen-Spalten: Owner wählt je Library (A4b).** Keine Auto-Ableitung aus
  dem Typ (die bewusste Entscheidung in `virtualized-items-view.tsx:266` bleibt
  gültig). Der Owner bestimmt die Spalten pro Library — der vorhandene
  `showInTable`-Mechanismus ist genau das. A4b wird damit klein.

## 4) Empfohlene Reihenfolge (zuerst sichtbar & konfliktfrei)

| # | Baustein | Risiko | Konflikt | PR-Größe |
|---|----------|--------|----------|----------|
| 1 | **A4c — Story-Verweise je Format** | niedrig | keiner | klein–mittel |
| 2 | **A4a — Typ-Leitfilter (adaptive Facetten)** | mittel | entschieden (§6) | mittel |
| 3 | **A4b — Tabellen-Spalten (Owner je Library)** | niedrig | entschieden (§6) | klein |

Begründung: A4c ist self-contained, sichtbar, ohne Design-Konflikt und reused
den vorhandenen Format-Dispatch — ideale erste, grün lieferbare Welle. A4a
danach: durch den „Typ als Leitfilter" + strenges Filtern wird die Engine
**einfacher** als ursprünglich gedacht (keine OR-Aggregation). A4b zuletzt und
klein, weil der Owner die Spalten ohnehin schon je Library wählt
(`showInTable`) — hier reicht Feinschliff für gemischte Ansichten.

## 5) Bauplan je Baustein

### A4c — Story-Verweise je Dokument formatgerecht (Welle 1)

**Ziel:** Ein Verweis/Anhang wird nach seinem Format dargestellt.

**Neues, reines Modul** (storage-agnostisch, <200 Z., voll unit-testbar):
`src/lib/library/reference-format.ts`
- `export type ReferenceFormat = 'pdf' | 'audio' | 'video' | 'image' | 'office' | 'web' | 'markdown'`
- `classifyReference(urlOrName: string): ReferenceFormat` — leitet aus
  Extension/MIME ab; **reused** `getFileType` aus `extension-map.ts` (kein Doppel-
  Mapping). Unbekannt → explizit `'web'` mit `console.warn` (kein stiller Default;
  `no-silent-fallbacks.mdc`).
- Reine Daten, keine React-Abhängigkeit → in `tests/unit/library/reference-format.test.ts`
  vollständig abdeckbar.

**Neue Komponente:** `src/components/library/story/reference-list.tsx`
- Nimmt `references: string[]` (oder `{ url, label }[]`), gruppiert per
  `classifyReference`, rendert je Gruppe formatgerecht:
  - `audio` → `<audio controls>` (bzw. vorhandener Audio-Pane-Baustein)
  - `video` → `<video>`/Embed
  - `image` → Thumbnail-Grid
  - `pdf`/`office` → Dokument-Button (FileText-Icon)
  - `web`/`markdown` → Link (Globe-Icon)
- Exhaustiver `switch` über `ReferenceFormat` (alle Fälle, kein `default`-Loch).

**Integration:** `book-detail.tsx` / `session-detail.tsx` ersetzen die lokale
`classifyAttachments`-Logik durch `<ReferenceList references={data.attachments_url} />`.
`isPdfUrl`/`classifyAttachments` werden entfernt (Cleanup-Commit gehört in dieselbe PR).

**DoD:** `pnpm test` + `pnpm lint` grün; Unit-Tests für `classifyReference`
(alle Formate inkl. unbekannt) + Snapshot/RTL für `ReferenceList`; Playwright-E2E:
Story mit gemischten Anhängen rendert Player/Thumbnail/Button sichtbar.

**Status (2026-06-18, Welle 1 umgesetzt):**
- ✅ `reference-format.ts` + 20 Unit-Tests (Formate, Query/Fragment, Encoding,
  Web-ohne-Warn).
- ✅ `reference-list.tsx` + 4 RTL-Tests (DOM je Format, Gruppen-Reihenfolge, Titel).
- ✅ `book-detail.tsx` umgestellt; `isPdfUrl`/`classifyAttachments`/
  `extractDisplayName` entfernt; Quell-Button nutzt `classifyReference`.
- ⏭️ **`session-detail.tsx` bewusst NICHT** umgestellt: löst Anhänge über einen
  eigenen Medien-Hook auf (`useSessionMedia`, `attachmentNames`,
  `video_url`/`galleryImageUrls` separat). Sauberer Folge-Schritt (eigene PR),
  damit die Medien-Auflösung nicht regressiert.
- ⏭️ **Playwright-E2E offen:** braucht laufende App + Clerk-Login + MongoDB +
  publizierte Story mit gemischten Anhängen (im Cloud-Agent nicht lauffähig).
  Die sichtbare Per-Format-Darstellung ist über die RTL-Tests (echtes DOM)
  abgedeckt; E2E beim User lokal nachziehen, wenn eine Test-Story bereitsteht.

### A4a — Typ als Leitfilter, adaptive Facetten (Welle 2)

**Modell (Owner-Entscheidung 2026-06-18):** Der Inhaltstyp ist der **erste**
Filter. Ohne Typ-Wahl → nur **gemeinsame** Facetten (Schnittmenge der
vorhandenen Typen; Basis-Facetten sind immer dabei). Mit Typ-Wahl → Basis +
die Facetten **dieses einen** Typs, und die Ergebnisliste zeigt **streng nur**
Dokumente dieses Typs. → Keine OR-über-Typen-Aggregation nötig.

**Server: vorhandene Typen kennen**
- Kleine Repo-Funktion `distinctViewTypes(libraryKey, libraryId): string[]` in
  `vector-repo.ts` (distinct `detailViewType` über `kind:'meta'`). Liefert die
  Typen, die als Leitfilter-Optionen angeboten werden.

**Neues, reines Modul:** `src/lib/chat/facet-scope.ts` (<200 Z., unit-testbar)
- `commonFacetDefs(library, presentTypes): FacetDef[]` — Basis-Facetten + die
  konfigurierten Facetten, deren `metaKey` in **allen** vorhandenen Typen
  vorkommt (Schnittmenge via `getOptionalFields`/`getRequiredFields`).
- `facetDefsForType(library, viewType): FacetDef[]` — Basis + konfigurierte
  Facetten, deren `metaKey` zum gewählten Typ gehört (Registry-Felder dieses
  Typs). Unbekannter Typ → `console.warn`, nur Basis (kein stiller Default).
- Liefert je nach „Typ gewählt?" das passende Set für Sidebar UND Filter.

**Server-Wiring (klein, kein OR):**
- `facets/route.ts` + `docs/route.ts`: Liest den optionalen Leitfilter
  `detailViewType` aus der Query. Gesetzt → Filter erhält `detailViewType: <typ>`
  (strenges Filtern, AND wie bisher) und nutzt `facetDefsForType`. Nicht gesetzt
  → `commonFacetDefs`. Die bestehende `buildFilterFromQuery`/`aggregateFacets`
  bleiben unverändert (nur die Facetten-Liste + ein zusätzliches AND-Kriterium).

**UI:** Seitenleiste setzt den Typ-Leitfilter an die erste Stelle (Liste aus
`distinctViewTypes`); bei Wechsel laden die übrigen Facetten neu. Storage-
agnostisch (rein über die Facetten-API, kein `library.type`).

**DoD:** Unit-Tests (`commonFacetDefs`: Schnittmenge korrekt; `facetDefsForType`:
Typ-Felder + unbekannter Typ); `pnpm test`+`pnpm lint` grün; E2E: Typ wählen →
Facetten passen sich an, Liste zeigt nur diesen Typ; Typ abwählen → gemeinsame
Facetten + alle Dokumente.

**Status (2026-06-18, umgesetzt):**
- ✅ `facet-scope.ts` (Engine) + 14 Unit-Tests (Schnittmenge, Typ-Scoping,
  Default-Einbezug, custom-global, Einzeltyp-Regressionsschutz).
- ✅ `distinctViewTypes()` in `vector-repo.ts`.
- ✅ `facets/route.ts` + `docs/route.ts`: `?detailViewType`-Leitfilter
  (ungültig → 400), `resolveFacetScope`, strenger Typ-Filter per `$and`.
  Facets-Route liefert `viewTypes` für die UI.
- ✅ `ViewTypeLeadFilter` (UI) + `useGalleryFacets` reicht `viewTypes` durch;
  in `gallery-root` als erster Filter verdrahtet. Erscheint NUR bei ≥2 Typen.
- ⚠️ **Wichtig (Regressionsschutz):** `commonFacetDefs` scoped erst ab **2**
  vorhandenen Typen. Einzeltyp-Libraries (die Mehrheit) behalten exakt die
  heutige volle Facettenliste — es ändert sich für sie nichts.
- ⏭️ **Mobile:** Der Leitfilter ist aktuell in der **Desktop**-Filterspalte. Für
  den mobilen Filter-Sheet (`MobileFiltersSheet`) als kleiner Folge-Schritt
  nachziehen (Slot/Prop ergänzen).
- ⏭️ **E2E offen** (lokal): Typ wählen → Facetten passen sich an + Liste nur
  dieser Typ; „Alle" → gemeinsame Facetten + alle Dokumente.

### A4b — Tabellen-Spalten: Owner wählt je Library (Welle 3, klein)

**Modell (Owner-Entscheidung 2026-06-18):** Keine Auto-Ableitung aus dem Typ.
Der Owner bestimmt die Spalten pro Library — der vorhandene `showInTable`-
Mechanismus (`pickFacetsForTableColumns`, `gallery-root/helpers.ts`) ist genau
das. Damit bleibt die Tabelle schmal und vorhersehbar.

**Was bleibt zu tun (Feinschliff, nicht Neubau):**
- Sicherstellen, dass `showInTable`-Spalten + `getCellValue` mit gemischten
  Typen sauber funktionieren (fehlendes Feld → „-", schon vorhanden).
- Wenn der Typ-Leitfilter (A4a) aktiv ist, dürfen die Owner-Spalten dieses Typs
  gezeigt werden (Spaltenwahl bleibt Owner-Sache, passt sich aber an den
  gewählten Typ an).
- Doku/Settings-Hinweis: „Spalten der Tabellenansicht = Facetten mit
  ‚In Tabelle zeigen'."

**DoD:** Unit-Tests für die Spalten-Auswahl bei gemischten Typen; `pnpm test`
+ `pnpm lint` grün; E2E: Owner-konfigurierte Spalten erscheinen, keine
überbreite Tabelle.

**Status (2026-06-18): durch die Owner-Entscheidung BEREITS ERFÜLLT — kein
Code nötig.** Der Owner wählt die Tabellen-Spalten je Library über den
`showInTable`-Schalter im Facetten-Editor (`FacetDefsEditor.tsx:470`, echter
`<Switch>`); `pickFacetsForTableColumns` (`gallery-root/helpers.ts`) liest ihn.
`getCellValue` (`virtualized-items-view.tsx:322`) rendert fehlende Felder schon
robust als „-", funktioniert also mit gemischten Typen. Auto-Ableitung aus dem
Typ wäre der Entscheidung zuwider (Tabelle würde zu breit). Offen höchstens ein
Settings-Hilfetext „Spalten = Facetten mit ‚In Tabelle zeigen'".

## 6) Entschieden (Owner, 2026-06-18)

1. **Tabellen-Spalten (A4b):** **Owner wählt je Library.** Keine Auto-Ableitung
   aus dem Typ; der vorhandene `showInTable`-Mechanismus bleibt die Quelle der
   Spalten. → A4b wird klein (Feinschliff statt Neubau).
2. **Filter-Quelle / Per-Typ-Facetten (A4a):** **Typ als Leitfilter.** Der
   Inhaltstyp ist der erste Filter; die übrigen Facetten **passen sich an** den
   gewählten Typ an. Ohne Typ-Wahl → nur **gemeinsame** Facetten. Die Facetten
   bleiben library-konfiguriert; gescoped wird über die Registry-Felder des Typs
   (keine neue Datenstruktur nötig).
3. **Filter-Semantik (A4a):** **Streng filtern.** Ein gewählter Typ zeigt nur
   Dokumente dieses Typs (AND mit `detailViewType`). → Kein OR-über-Typen, die
   Server-Aggregation bleibt unverändert.

> Folge: A4a wird **einfacher** als zunächst geplant (keine OR-Aggregation,
> kein neues Facetten-Datenmodell), A4b **kleiner** (Owner-Mechanismus existiert).

## 7) Konventionen & Leitplanken (für jede Welle)

- Dateien ≤200 Z.; kein `any`, kein leeres `catch`; **keine stillen Fallbacks**
  (`no-silent-fallbacks.mdc`) — unbekannte Typen/Formate explizit loggen/werfen.
- **UI kennt kein Storage-Backend** (`storage-abstraction.mdc`): Format-/Typ-Logik
  rein aus Metadaten/Dateiname, nie aus `library.type`.
- Reine Engine-Module zuerst + voll unit-getestet, dann minimal-invasive Wiring.
- Pro Welle EINE PR, ≤5.000 Z. Brutto-Diff; Cleanup (entfernte `classifyAttachments`
  etc.) in die PR der Ursache.
- DoD je Welle: `pnpm test` + `pnpm lint` grün; sichtbare Story als Playwright-E2E
  wo sinnvoll.
- **Publish-Sperre NICHT** hier — bleibt die A1-Warnung bzw. der spätere
  Promote-Schritt (ADR-0004).

## 8) Empfohlener Start (nächste Session)

Welle 1 = **A4c**. Reihenfolge der Commits:
1. `feat(gallery): A4c-1 reference-format Klassifizierer (rein) + Tests`
2. `feat(gallery): A4c-2 ReferenceList Komponente (formatgerecht) + Tests`
3. `refactor(gallery): A4c-3 book/session-detail auf ReferenceList umstellen
   (classifyAttachments entfernen)`
4. `test(e2e): A4c-4 Story mit gemischten Anhängen`

Danach Welle 2 = **A4a** (Typ-Leitfilter), Welle 3 = **A4b** (Spalten-Feinschliff).

Modell-Empfehlung: Sonnet (UI-Wiring) für A4c/A4b; **Opus** für A4a
(Facetten-Scope-Engine). Agent-Typ: neuer Agent je Welle.

## 9) Stand der Cloud-Session 2026-06-18 (für lokalen Umzug)

**In dieser Session umgesetzt + grün (`pnpm test` 2270, `pnpm lint` 0 Fehler):**
- **A4c** (BookDetail): `reference-format.ts`, `ReferenceList`, BookDetail
  umgestellt. (session-detail = Folge-Schritt, s. A4c-Status.)
- **A4a** (vollständig): `facet-scope.ts`-Engine, `distinctViewTypes`,
  facets/docs-Routen-Wiring, `ViewTypeLeadFilter`-UI in der Galerie.
- **A4b**: durch Owner-Entscheidung erfüllt (bestehender `showInTable`-Schalter).

**Branch:** `claude/library-verification-status-a1-cgg7qv` (PR noch nicht erstellt).

**Lokal manuell zu prüfen (geht im Cloud-Agent nicht — App + Mongo + Daten):**
1. **Gemischte Library** (≥2 detailViewTypes) öffnen → Galerie zeigt oben den
   **Inhaltstyp-Leitfilter**. Einzeltyp-Library → KEIN Leitfilter, alles wie bisher.
2. Typ wählen → Facetten-Seitenleiste **passt sich an** (typ-spezifische
   erscheinen, fremde verschwinden), Liste zeigt **nur** diesen Typ. Default-Typ
   schließt Dokumente **ohne** `detailViewType` mit ein.
3. „Alle" → gemeinsame Facetten + alle Dokumente.
4. **Story/BookDetail** mit gemischten Anhängen → Bild=Vorschau, Audio/Video=
   Player, PDF/Datei=Knopf, Link=Globe.

**Playwright-E2E (lokal nachziehen):**
- `e2e/…` Galerie: Leitfilter klicken → Facetten/Liste ändern sich (Selektoren:
  `[data-testid="view-type-lead-filter"]`).
- Story-Anhänge je Format (`[data-format="image|video|audio"]` in `ReferenceList`).

**Offene Folge-Schritte (klein):**
- A4c: `session-detail.tsx` auf `ReferenceList` umstellen (eigene Medien-Auflösung
  beachten).
- A4a: Leitfilter auch in den **mobilen** Filter-Sheet hängen.
- A4b: optionaler Settings-Hilfetext zu „In Tabelle zeigen".
