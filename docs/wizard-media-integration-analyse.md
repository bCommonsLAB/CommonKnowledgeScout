# Analyse: Medien-Integration im Wizard vs. Transformationsdialog

## Ziel

Beide Flows (Creation Wizard für Laien, Transformationsdialog für Fachleute) sollen identische Ergebnisse produzieren. Die Story-Vorschau nutzt bereits dieselbe Komponente (`DetailViewRenderer` → `SessionDetail`). Bei der Bild-Verwaltung gibt es jedoch Unterschiede.

## Ist-Zustand: Zwei unterschiedliche Pfade

### Transformationsdialog (MediaTab)

| Aspekt | Umsetzung |
|--------|-----------|
| Upload-API | `POST /api/library/.../shadow-twins/upload-media` |
| Binary-Tracking | Azure + `binaryFragments` in MongoDB |
| Array-Felder | `arrayIndex` + `arrayAppend` (Sprecher-Bilder, Anhänge) |
| Galerie-Quelle | Siblings (Verzeichnis) + binaryFragments |
| Frontmatter-Update | `patchFrontmatterField()` → `updateShadowTwinMarkdown()` |

### Creation Wizard (uploadImages-Step)

| Aspekt | Umsetzung |
|--------|-----------|
| Upload-API | `POST /api/creation/upload-image` |
| Binary-Tracking | Nur Azure (keine `binaryFragments`) |
| Array-Felder | **Nicht unterstützt** (1 Bild pro Feld-Key) |
| Galerie-Quelle | Nur lokale Datei-Auswahl |
| Frontmatter-Update | Im `handleSave()` beim Speichern |

## Identifizierte Lücken

### Lücke 1: Unterschiedliche Upload-APIs

- **Wizard**: `/api/creation/upload-image` → Azure, aber keine `binaryFragments`
- **MediaTab**: `/api/library/.../shadow-twins/upload-media` → Azure + `binaryFragments`

**Auswirkung**: Wizard-Bilder fehlen in `binaryFragments`. Die Galerie im MediaTab zeigt sie nicht. Die URLs im Frontmatter funktionieren trotzdem, weil sie direkte Azure-URLs sind.

### Lücke 2: Kein Array-Support im Wizard

`upload-images-step.tsx` speichert `Record<string, string>` – ein Wert pro Feld. Das reicht für:
- `coverImageUrl` (einzelnes Bild) ✅

Es reicht **nicht** für:
- `authors_image_url` (Index-paralleles Array) ❌
- `galleryImageUrls` (beliebig viele Bilder) ❌

### Lücke 3: Scope-Unterschied

- **Wizard**: `scope` basierend auf `detailViewType` (`books`/`sessions`)
- **MediaTab**: `scope` fest `'books'` in `shadow-twin-service.ts`

## Lösungsvorschläge

### Variante A: MediaTab-Komponente im Wizard wiederverwenden

Die `MediaTab`-Komponente aus `src/components/library/media-tab.tsx` direkt im Wizard als Step einbetten. 

**Vorteile**: 
- Identische Upload-Logik (gleiche API, gleiche `binaryFragments`)
- Array-Support sofort verfügbar (Sprecher-Bilder, Anhänge)
- Galerie mit Siblings + Fragments funktioniert
- Keine doppelte Logik

**Nachteile**: 
- MediaTab benötigt `effectiveMdId` (Shadow-Twin muss bereits existieren)
- Im Wizard existiert das Shadow-Twin aber erst nach dem Speichern
- MediaTab ist für den Transformationsdialog gestaltet (UX nicht Wizard-optimiert)

**Bewertung**: Erfordert erhebliche Refactoring-Arbeit, da der Wizard beim Medien-Step noch kein gespeichertes Shadow-Twin hat.

### Variante B: uploadImages-Step erweitern (empfohlen)

Den bestehenden `uploadImages`-Step schrittweise erweitern:

1. **Array-Support**: `Record<string, string>` → `Record<string, string | string[]>`
2. **Multi-Image-UI**: Für Felder mit `multiple: true` oder Array-Typ ein Multi-Upload-Widget
3. **Upload-API vereinheitlichen**: `/api/creation/upload-image` um `binaryFragments`-Tracking erweitern (oder auf `upload-media` umstellen)
4. **Galerie-Grid** (optional): Verfügbare Bilder aus dem Verzeichnis anzeigen (wie MediaTab)

**Vorteile**:
- Inkrementell implementierbar
- Wizard-UX bleibt sauber (geführter Prozess)
- Kann nach und nach an MediaTab-Funktionalität heranwachsen

**Nachteile**:
- Doppelte Logik, die synchron gehalten werden muss
- Galerie-Grid müsste separat implementiert werden

### Variante C: Shared Medien-Logik extrahieren (langfristig ideal)

Gemeinsame Medien-Verwaltungslogik in einen Hook oder Service extrahieren, der von beiden Flows genutzt wird:

```
useMediaAssignment({
  libraryId, fileId, frontmatter,
  onFrontmatterUpdate
})
```

**Vorteile**: Single Source of Truth für alle Medien-Operationen
**Nachteile**: Größter initialer Aufwand

## Empfohlene Reihenfolge

1. **Template fertigstellen** (erledigt) – `authors`, `authors_image_url`, `galleryImageUrls`
2. **Variante B, Schritt 1**: `uploadImages`-Step um Array-Support erweitern
3. **Variante B, Schritt 2**: Multi-Image-Upload-Widget für `galleryImageUrls`
4. **Variante B, Schritt 3**: Upload-API vereinheitlichen (binaryFragments)
5. **Langfristig**: Variante C (Shared Hook)

## Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `src/components/creation-wizard/steps/upload-images-step.tsx` | Array-Support + Multi-Image UI |
| `src/components/creation-wizard/creation-wizard.tsx` | `wizardState.imageUrls` → `string \| string[]` |
| `src/lib/templates/template-types.ts` | `TemplateCreationImageField.multiple` aktivieren |
| `src/lib/detail-view-types/registry.ts` | `galleryField` zu `ViewTypeMediaConfig` hinzufügen |
| `src/components/library/media-tab.tsx` | Galerie-Sektion für `galleryField` (Transformationsdialog) |
| `template-samples/off-aktionsbericht-de.md` | Template-Definition (erledigt) |
