# 00-Audit: Deterministischer Cover-Image- / Medien-Flow

**Stand:** 2026-04-30
**Branch:** master
**Quellen-Diagnose:** [Cover-Image-Bug Diagnose](#) (siehe Konversation 2026-04-30)

## 0) Ausloeser

Beobachtetes Symptom (User):
- Quelldatei `pctest.md` enthaelt im Freitext: `Bilder: thinkpad-t480-front.jpg, thinkpad-t480-tastatur.jpg`
- LLM-Transformation schreibt `coverImageUrl: "thinkpad-t480-front.jpg"` ins Frontmatter
- Im Verzeichnis liegt aber `dell-optiplex-7060-sff-1665130604.webp` (vom User per Hand abgelegt)
- Story-Vorschau zeigt kein Bild, weil `thinkpad-t480-front.jpg` nicht existiert
- **Kein UI-Bug**: Wenn User aktiv im Medien-Tab das webp zuordnet, funktioniert die Uebernahme korrekt (Terminal-Log Z.139-215)

Bestaetigtes Problem:
- Das LLM erfindet/extrahiert Dateinamen aus dem Quell-Freitext und Template-Beispielen, ohne dass eine Existenz-Pruefung stattfindet
- Verstoss gegen [`media-lifecycle.mdc`](../../.cursor/rules/media-lifecycle.mdc): _"Frontmatter-Felder fuer Medien enthalten ausschliesslich Dateinamen, die sich auf Dateien im selben Verzeichnis oder in `binaryFragments` des Shadow-Twins beziehen."_

## 1) Inventory: Schreibpfade fuer Medien-Frontmatter-Felder

### 1.1 LLM-Transformation (Server)

| Datei | Zeile | Was | Bewertung |
|---|---|---|---|
| `src/lib/external-jobs/phase-template.ts` | 842-877 | Aufbau des `sourceContext` (`fileName`, `fileExtension`, `filePath`, `mimeType`, `fileModifiedAt`) als CONTEXT-Block fuer das LLM | **Liste verfuegbarer Medien fehlt** — LLM hat keinen Existenz-Kontext |
| `src/lib/external-jobs/phase-template.ts` | 901 | `runTemplateTransform({...context: sourceContext})` — eigentlicher LLM-Call | OK |
| `src/lib/external-jobs/phase-template.ts` | 902 | `metadataFromTemplate = tr.meta` — direkte Uebernahme der LLM-Antwort | **Kein Validator nachgeschaltet** — Bug-Quelle |
| `src/lib/external-jobs/phase-template.ts` | 1685-1700 | Cover-Image-Generator-Pfad (Re-Use existierendes Cover bei Re-Run) | OK, nutzt bereits existenten Wert |
| `src/lib/external-jobs/phase-template.ts` | 1879, 1914 | Cover-Image-Generator-Pfad (Generierung via DALL·E etc.) | OK, schreibt eigenen Wert |

### 1.2 UI / Client-seitig (Medien-Tab + Job-Report-Tab)

| Datei | Zeile | Was | Bewertung |
|---|---|---|---|
| `src/components/library/media-tab.tsx` | 342-462 | `handleAssignGalleryItem` — User-Auswahl im Medien-Tab | OK, nutzt `item.name` direkt |
| `src/components/library/media-tab.tsx` | 386 | `clearStaleThumb = { coverThumbnailUrl: undefined }` | Stiller Reset bei Auswahl, aber dokumentiert |
| `src/components/library/job-report-tab.tsx` | 1199-1200 | Hardcoded Fallback `\|| 'cover.jpg'` | **Verstoss gegen no-silent-fallbacks.mdc** |
| `src/components/library/job-report-tab.tsx` | 1000 | Namenskonvention `thumb_<name>.webp → <name>.png/jpg` | **`.webp` als Original wird nicht erkannt** |
| `src/components/library/job-report-tab.tsx` | 1244 | `_handleSelectExistingImage` patcht direkt `originalName` ins Frontmatter | OK, nutzt validierte binaryFragment-Paare |

### 1.3 Server-API-Routes (Schreibpfade)

| Datei | Zeile | Was | Bewertung |
|---|---|---|---|
| `src/app/api/library/[libraryId]/shadow-twins/upload-media/route.ts` | 125 | `patchValue = file.name \|| fragment.name` | OK, nutzt Original-Dateinamen |
| `src/app/api/library/[libraryId]/shadow-twins/upload-media/route.ts` | 181-220 | `buildFrontmatterPatches` — generisch fuer String / Array-Felder | OK |
| `src/app/api/library/[libraryId]/shadow-twins/upload-cover-image/route.ts` | 1-169 | Spezial-Route nur fuer Cover (Legacy) | OK, aber Duplikat zu upload-media |
| `src/lib/shadow-twin/store/shadow-twin-service.ts` | 853 | `coverImageUrl: fragment.resolvedUrl \|| fragment.name` | OK |

## 2) Inventory: Verzeichnis-Listing (was ist "vorhanden"?)

### 2.1 Sibling-Files

- API: `POST /api/library/[libraryId]/sibling-files` (sourceId, parentId)
- Server-Logik: `src/app/api/library/[libraryId]/sibling-files/route.ts`
- Liefert: Liste von `SiblingFile` mit `id`, `name`, `mimeType`, `mediaKind`, `previewUrl`
- **Verfuegbar im Server** (gleicher Provider wie phase-template) — kann im LLM-Kontext mitgegeben werden

### 2.2 Binary-Fragments

- API: `POST /api/library/[libraryId]/shadow-twins/binary-fragments` (sourceIds[])
- Server-Logik: ueber `ShadowTwinService.getBinaryFragments()`
- Liefert: Liste von Fragments mit `name`, `kind`, `variant`, `mimeType`, `resolvedUrl`
- **Verfuegbar im Server** — kann im LLM-Kontext mitgegeben werden

### 2.3 Aggregated-Media

- API: `POST /api/library/[libraryId]/aggregated-media` — kombiniert Sibling + Fragmente fuer Multi-Source-Faelle
- Verwendet im Medien-Tab fuer Verzeichnis-Anzeige
- **Kann auch im phase-template.ts wiederverwendet werden**

## 3) Inventory: Hardcoded Fallbacks und Verstoesse

### 3.1 Hardcoded `.jpg`-Annahmen

| Datei | Zeile | Code | Bewertung |
|---|---|---|---|
| `src/components/library/job-report-tab.tsx` | 1200 | `const fileName = coverImageUrl.split('/').pop() \|| 'cover.jpg'` | Verstoss `no-silent-fallbacks.mdc` |
| `src/components/library/job-report-tab.tsx` | 1201 | `const mimeType = blob.type \|| 'image/jpeg'` | Verstoss `no-silent-fallbacks.mdc` |
| `src/components/library/job-report-tab.tsx` | 1000 | Namenskonvention nur fuer `.png/jpg`, ignoriert `.webp` | Bug bei webp-Originalen |
| `src/lib/image/thumbnail-generator.ts` | 20, 151 | `THUMBNAIL_FORMAT = 'webp'` (hard) — Thumbnails immer webp | OK, dokumentiert |

### 3.2 Stille Catches (`catch {}`)

| Datei | Zeile | Bewertung |
|---|---|---|
| `src/lib/external-jobs/phase-template.ts` | 836, 864, 874 | Verstoss `no-silent-fallbacks.mdc` (Lint `no-empty`) — bereits in vorigen Wellen markiert, nicht Teil dieses Refactors |

## 4) Inventory: Vorhandene Validierung (Soll-Vergleich)

### 4.1 LLM-Antwort wird validiert

- `src/lib/secretary/response-parser.ts`: `parseSecretaryMarkdownStrict` — prueft NUR Markdown-Struktur und Frontmatter-Parsbarkeit
- **Keine semantische Validierung** der Frontmatter-Werte (keine Existenz-Pruefung von Datei-Referenzen)

### 4.2 Frontmatter-Schema

- `src/lib/templates/template-types.ts`: definiert Schema-Typen
- **Keine Validatoren fuer Medien-Felder** mit Existenz-Pruefung gegen Storage

## 5) Inventory: Medien-Felder pro DetailViewType (aus registry.ts)

| DetailViewType | coverImageUrl | galleryImageUrls | speakers_image_url | authors_image_url | attachments_url |
|---|---|---|---|---|---|
| `book` | optional | — | — | optional | — |
| `session` | required | — | required | — | optional |
| `testimonial` | optional | — | — | — | — |
| `climateAction` | required | — | — | — | — |
| `divaDocument` | required | — | — | — | — |
| `divaTexture` | required | optional | — | — | — |
| `refurbedDevice` (NEU) | required | optional | — | — | — |
| (sonstige) | siehe `src/lib/detail-view-types/registry.ts` | | | | |

**Kanonische Liste der Medien-Felder** (aus `registry.ts.coverImage / personField / galleryField / attachments`):
- `coverImageUrl` (string, single)
- `galleryImageUrls` (string[], generisch konfigurierbar via `mediaConfig.galleryField.key`)
- `speakers_image_url` / `authors_image_url` (string[], indexed, konfigurierbar via `mediaConfig.personField.imageKey`)
- `attachments_url` (string[], appended)

## 6) Bewertung & Soll-Zustand (Outlook)

| Punkt | Ist | Soll |
|---|---|---|
| LLM-CONTEXT enthaelt Medien-Liste | nein | ja, alle Sibling-Files + binaryFragments mit `name`, `mimeType` |
| Server-Validator nach LLM-Antwort | nein | ja, prueft alle Medien-Felder gegen reale Liste, setzt nicht-existente auf `null`/`[]` + Warning |
| Hardcoded `.jpg`-Fallbacks | 3 Stellen | 0 Stellen |
| `.webp`-Originale werden erkannt | nein | ja, alle Image-MIME-Typen erlaubt |
| UI-Banner bei Phantom-Datei | nein | ja, rote Warnung im Coverbild-Slot mit Hinweis "Datei nicht gefunden" |
| Tests fuer Validator | nein | ja, Unit-Tests fuer alle Medien-Felder + alle View-Typen |

## 7) Aktionen pro Bestands-Artefakt

| Artefakt | Aktion | Begruendung |
|---|---|---|
| `phase-template.ts:842-877` (CONTEXT-Aufbau) | **update** | Medien-Liste hinzufuegen |
| `phase-template.ts:901-902` (runTemplateTransform + meta-Uebernahme) | **update** | Validator-Aufruf nach Z.902 |
| `media-tab.tsx:386` (clearStaleThumb) | **keep** | Korrekt, dokumentiert |
| `job-report-tab.tsx:1199-1201` (cover.jpg / image/jpeg Fallback) | **delete** | Verstoss no-silent-fallbacks |
| `job-report-tab.tsx:1000` (.png/jpg-Konvention) | **update** | Erweitern auf alle Image-MIME-Types |
| `media-tab.tsx` Coverbild-Slot (Z.512-555) | **update** | UI-Banner bei Phantom-Datei einbauen |
| `src/lib/templates/media-existence-validator.ts` | **create** | Neuer Validator-Helper |
| `tests/unit/lib/templates/media-existence-validator.test.ts` | **create** | Neue Unit-Tests |
| `template-samples/pc-steckbrief-de.md` (Systemprompt) | **update** | Klausel: "MUSS aus CONTEXT.availableMedia sein" |
| `upload-cover-image/route.ts` (Legacy) | **keep** | Noch in Verwendung, Umstellung auf upload-media in spaeterer Welle |

## 8) Risiken & Stop-Bedingungen

- Wenn der Validator als Side-Effect bestehende Frontmatter-Werte loescht (z.B. weil ein Bild nach Transformation umbenannt wurde) → **Datenverlust** moeglich. **Mitigation:** Validator schreibt Original-Wert ins `cumulativeMeta`-Log, nicht ins Frontmatter, sodass es im UI sichtbar bleibt.
- Wenn der LLM-CONTEXT zu gross wird (sehr viele Medien-Dateien) → Token-Budget-Problem. **Mitigation:** Limit von 50 Eintraegen, dann Hinweis "und weitere".
- Migration: Bestehende Frontmatter-Werte mit Phantom-Dateinamen werden NICHT automatisch repariert (kein Migrations-Script in dieser Welle). **User-Sichtbarkeit** durch UI-Banner.
- Falls bestehende Tests in `tests/unit/external-jobs/phase-template-*.test.ts` Annahmen ueber LLM-Output-Form treffen, muessen sie erweitert werden.
