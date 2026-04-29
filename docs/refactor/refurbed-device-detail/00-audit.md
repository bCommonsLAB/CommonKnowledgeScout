# Audit: Neuer DetailViewType `refurbedDevice`

**Status:** Aktiv
**Erstellt:** 2026-04-29
**Auftraggeber:** Anwender-Anfrage (verschenkte gebrauchte PCs/Notebooks fuer Schule, Lehrer, Familien)

## Ziel

Neuer `detailViewType: refurbedDevice` fuer die Anzeige gebrauchter Tech-Geraete (PCs, Notebooks),
die an Schueler, Lehrer und Familien verschenkt werden. Zielgruppe sind Laien, daher Fokus auf:

- Wenige (8) gut verstaendliche Hardware-Parameter
- Klarer Eignungs-Text ("wofuer ist der Rechner gut?")
- Bilder vom konkreten Geraet
- Kein Preis (Verschenken-Modell, kein Verkauf)

## Kontext

Vorausgegangene Iteration (`pc-steckbrief-de.md`, Versionen 1-3) hatte irrtuemlich
`detailViewType: divaProductProfile` gesetzt. Dieser Typ existiert nicht im Code. Daher wurde
in der Galerie-Settings-UI kein passender Eintrag angezeigt (siehe Anwender-Screenshot).

## Vorbild

`divaDocument` ist die juengste DetailViewType-Erweiterung im Repo und folgt der Checkliste
[`detail-view-type-checklist.mdc`](../../.cursor/rules/detail-view-type-checklist.mdc) vollstaendig.

## Betroffene Dateien (Aktion pro Datei)

### Neu anlegen

| Datei | Aktion |
|-------|--------|
| `src/components/library/refurbed-device-detail.tsx` | **create** - Detail-Komponente + DetailData-Interface |
| `src/components/library/ingestion-refurbed-device-detail.tsx` | **create** - Mongo-Loader-Wrapper |
| `template-samples/pc-steckbrief-de.md` | **update** - `detailViewType: refurbedDevice` setzen |

### Erweitern (Pflicht-Checkliste 15 Punkte)

| Datei | Aktion | Welche Stelle |
|-------|--------|---------------|
| `src/lib/detail-view-types/registry.ts` | **update** | `DETAIL_VIEW_TYPES` Array + `VIEW_TYPE_REGISTRY` Eintrag (inkl. `translatable`-Block) |
| `src/lib/templates/template-types.ts` | **update** | `TemplatePreviewDetailViewType` Union |
| `src/lib/chat/config.ts` | **update** | `detailViewType: z.enum([...])` |
| `src/components/settings/chat-form.tsx` | **update** | 4 Stellen: Schema (Zeile 94), `validDetailViewTypes` (Zeile 248), `if-Bedingung` (Zeile 1056), `<SelectItem>` (Zeile 1073) |
| `src/lib/mappers/doc-meta-mappers.ts` | **update** | `mapToRefurbedDeviceDetail()` + Type-Import |
| `src/components/library/detail-view-renderer.tsx` | **update** | Import + if-Statement |
| `src/components/library/gallery/detail-overlay.tsx` | **update** | Import (Zeile 11), `viewType`-Union (Zeile 27), Render-Block (Zeile ~205) |
| `src/components/library/shared/ingestion-detail-panel.tsx` | **update** | Import + if-Statement (nach Zeile 96) |
| `src/components/library/job-report-tab.tsx` | **update** | `requiredFieldsByType` Record (Zeile 1779) + ggf. `<SelectItem>` |
| `src/lib/templates/detail-view-type-utils.ts` | **update** | BEIDE `validTypes` Arrays (Zeile 27, 35) |
| `src/components/library/gallery/gallery-root.tsx` | **update** | 2 Arrays (Zeile 68, 144) |
| `src/components/library/chat/chat-panel.tsx` | **update** | `validDetailViewTypes` (Zeile 222) |
| `src/types/library.ts` | **update** | `detailViewType?: '...'` Union (Zeile 151) |
| `src/hooks/gallery/use-gallery-config.ts` | **update** | `type DetailViewType` Union (Zeile 8) |
| `src/components/templates/structured-template-editor.tsx` | **update** | `<SelectItem value="refurbedDevice">` (nach Zeile 622) |

### i18n (5 Sprachen)

| Datei | Aktion |
|-------|--------|
| `src/lib/i18n/translations/de.json` | **update** - 4 Keys: `detailViewTypeRefurbedDevice` + `Description` (an 2 Stellen wie divaDocument) |
| `src/lib/i18n/translations/en.json` | **update** - 4 Keys |
| `src/lib/i18n/translations/it.json` | **update** - 4 Keys |
| `src/lib/i18n/translations/fr.json` | **update** - 4 Keys (zur Konsistenz, EN als Fallback wenn keine Uebersetzung) |
| `src/lib/i18n/translations/es.json` | **update** - 4 Keys |

### Optional / nicht betroffen

| Datei | Aktion |
|-------|--------|
| `src/lib/repositories/doc-meta-formatter.ts` | **keep** - kein Treffer fuer divaDocument-Aenderungen, vermutlich generisch |
| `src/lib/repositories/vector-repo.ts` | **keep** - keine spezifische Projection noetig (alle Felder kommen ueber generische docMetaJson) |
| `src/lib/gallery/types.ts` | **keep** - `DocCardMeta` enthaelt schon `coverImageUrl`, `tags`, `topics` etc. - keine neuen Felder noetig fuer Karten-Ansicht |

## Pflichtfelder

Nach Anwender-Wunsch nur 2 Pflichtfelder (maximale Flexibilitaet):

- `title`
- `modell`

## Optionale Felder

```ts
['summary', 'modell', 'geraetetyp', 'prozessor', 'arbeitsspeicher', 'festplatte',
 'grafik', 'gewicht', 'betriebssystem', 'coverImageUrl', 'galleryImageUrls', 'tags', 'year']
```

## Translatable-Block

Pragmatisch: alle textuellen Felder uebersetzbar, da Geraete an verschiedensprachige
Empfaenger gehen koennen (Schulen in Suedtirol mehrsprachig).

```ts
text: [
  { key: 'title', scope: 'both' },
  { key: 'shortTitle', scope: 'both' },
  { key: 'summary', scope: 'detail' },
  { key: 'markdown', scope: 'detail' },
  { key: 'wofuerGeeignet', scope: 'detail' },
],
arrayOfText: [],
topicLike: [
  { key: 'tags', scope: 'both' },
],
```

## Nicht im Scope

- Eigene Card-Layout-Komponente (`document-card.tsx`) - bleibt generisch
- Vector-Repo-Projection - keine spezifischen Felder noetig
- Eigene Facetten-Config (`pc-facets-config.json`) - kann der User spaeter manuell anlegen,
  default-Facetten reichen aus
- Tests (Char-Tests pro DetailViewType) - vorhandene Tests pruefen, ob neuer Typ
  Bestehendes bricht. Falls noetig, nachziehen.

## Risiken

- **Diff-Volumen**: ~15 Dateien aenderungen + 2 neue Komponenten + 5 i18n-Files = mit allen
  Sprachen vermutlich 800-1200 Zeilen Diff. Stop-Bedingung ueber 1000 Zeilen ist hier
  bewusst akzeptiert weil Anwender es explizit wuenscht und die Checkliste vollstaendig folgt.
- **Hardcodierte ViewType-Listen**: Wenn EINE der 5 Hardcoded-Listen vergessen wird, bricht
  der Galerie-Routing oder die Validierung. Doppelter Check vor PR-Abschluss.
