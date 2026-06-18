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

- **A4a — Filter als Vereinigung über Typen.** Die Facetten-Seitenleiste (und die
  Filter-Anwendung) sollen die **Vereinigung** der relevanten Facetten der
  *tatsächlich vorhandenen* Typen zeigen, statt nur die eine, library-weite Liste.
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

## 3) Design-Konflikte (NICHT still entscheiden)

1. **Tabellen-Breite (A4b).** Der Code entscheidet bewusst gegen
   Auto-Spalten-Ableitung aus dem Typ („sonst wird die Tabelle viel zu breit",
   `virtualized-items-view.tsx:266`). „Spalten je Typ" naiv als Vereinigung
   ALLER `optionalFields` würde genau das wieder einführen. → A4b braucht eine
   **Begrenzungs-Regel** (Owner-Entscheidung), siehe §6 Offene Punkte.
2. **Per-Typ-Facetten-Datenmodell (A4a).** Die Registry führt Feld-Keys, aber
   keine Facetten-Typen. Eine echte Typ-Facette braucht `type`/`multi`. Drei
   Optionen (siehe §6) — bis dahin ist A4a nicht eindeutig baubar.
3. **Filter-Semantik (A4a).** „Vereinigung" heißt server-seitig OR über Typen
   (`(typ=A ∧ f) ∨ (typ=B ∧ f)`), nicht nur eine größere Sidebar. Das berührt
   `aggregateFacets` + `findDocs(Grouped)`. Eigene PR-Größe.

## 4) Empfohlene Reihenfolge (zuerst sichtbar & konfliktfrei)

| # | Baustein | Risiko | Konflikt | PR-Größe |
|---|----------|--------|----------|----------|
| 1 | **A4c — Story-Verweise je Format** | niedrig | keiner | klein–mittel |
| 2 | **A4b — Tabellen-Spalten je Typ** | mittel | Tabellen-Breite | mittel |
| 3 | **A4a — Facetten-Union + Filter** | hoch | Datenmodell + Filter-Semantik | groß (ggf. 2 PRs) |

Begründung: A4c ist self-contained, sichtbar, ohne Design-Konflikt und reused
den vorhandenen Format-Dispatch — ideale erste, grün lieferbare Welle. A4b danach
(eine Owner-Entscheidung). A4a zuletzt, weil es zwei offene Entscheidungen und die
größte Server-Fläche hat; ggf. in „Sidebar-Union" (read) und „Filter-Union"
(query) splitten.

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

### A4b — Tabellen-Spalten je Typ (Welle 2)

**Neues, reines Modul:** `src/lib/gallery/type-columns.ts`
- `presentViewTypes(docs: Pick<DocCardMeta,'detailViewType'>[], libraryFallback: string): string[]`
  — distinkte, validierte Typen in der aktuellen Ansicht (nutzt
  `resolveDetailViewTypeForDoc`). Storage-agnostisch.
- `unionTableColumnsForTypes(types: string[], cap: number): TableColumnDef[]`
  — Vereinigung von `getTableColumnsForViewType(t)` je Typ, dedupliziert, mit
  **Begrenzung** `cap` (Owner-Regel, §6) und deterministischer Reihenfolge
  (Basis zuerst). Unbekannter Typ → übersprungen + `console.warn`.
- Voll unit-getestet in `tests/unit/gallery/type-columns.test.ts`.

**Integration:** `virtualized-items-view.tsx` `tableColumns`-Memo erweitern:
- Reihenfolge der Quellen: (1) explizite `showInTable`-Facetten (Bestand, hat
  Vorrang), sonst (2) **wenn >1 Typ vorhanden** → `unionTableColumnsForTypes`,
  sonst (3) Bestands-Default (`title`+`upsertedAt`). Owner-/climateAction-Spalten
  bleiben unverändert.

**DoD:** Unit-Tests (1 Typ, mehrere Typen, Cap greift, unbekannter Typ);
`pnpm test`+`pnpm lint` grün; E2E: gemischte Library zeigt sinnvolle Spalten,
keine überbreite Tabelle.

### A4a — Facetten-Union + Filter (Welle 3, ggf. 2 PRs)

**Voraussetzung:** Owner-Entscheidung zum Per-Typ-Facetten-Datenmodell (§6).

**3a (read — Sidebar-Union):**
- Neues reines Modul `src/lib/chat/facet-union.ts`:
  `unionFacetDefsForTypes(library, presentTypes): FacetDef[]` = Basis-Facetten +
  konfigurierte + (je nach §6-Entscheidung) typ-spezifische — dedupliziert,
  deterministisch. Voll unit-testbar.
- Verbraucht serverseitig die distinkten `detailViewType`-Werte (neue kleine
  Repo-Funktion `distinctViewTypes(libraryKey, libraryId)` in `vector-repo.ts`).
- `facets/route.ts` nutzt die Union statt `parseFacetDefs` pur.

**3b (query — Filter-Union/OR):**
- `buildFilterFromQuery` um Typ-bewusste OR-Verknüpfung erweitern (bzw. neuer
  `buildUnionFilter`), sodass typ-spezifische Facetten Dokumente anderer Typen
  nicht fälschlich ausschließen. `aggregateFacets`/`findDocs` entsprechend.
- Harte Tests gegen die OR-Semantik (Doku A Typ X + Doku B Typ Y).

**DoD:** Unit + Integration grün; E2E: Filtern nach einer typ-spezifischen
Facette schließt fremd-typische Dokumente nicht aus.

## 6) Offene Punkte (Owner-Entscheidung nötig)

1. **A4b Spalten-Begrenzung:** feste Obergrenze (z. B. max. 5 Spalten) ODER
   „nur Felder, die in ≥2 vorhandenen Typen vorkommen" ODER Owner wählt je
   Library? *Empfehlung:* feste, kleine Obergrenze + Basis-Felder zuerst.
2. **A4a Per-Typ-Facetten-Datenmodell:**
   - (i) Facetten bleiben rein library-konfiguriert; „Union" = nur OR-Filter +
     Sidebar zeigt alle konfigurierten (kleinster Eingriff). *Empfehlung.*
   - (ii) Registry um optionale `facetFields` (typisiert) je ViewType erweitern.
   - (iii) Per-Typ-Facetten in die Library-Config (`facetsByType`).
3. **A4a Filter-Semantik bei gemischten Selektionen:** Basis-Facetten weiter UND,
   typ-spezifische als OR je Typ? (Empfehlung: ja.)

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

Modell-Empfehlung: Sonnet (UI-Wiring) für A4c/A4b; **Opus** für A4a
(Architektur/Filter-Engine). Agent-Typ: neuer Agent je Welle.
