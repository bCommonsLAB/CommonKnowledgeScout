# Implementierungsplan: Generischer Finalize/Publish-Wizard

## Übersicht

Transformiere den Event-spezifischen Finalize-Wizard in einen generischen Wizard, der Inhalte eines Verzeichnisses zusammenführt, transformiert und publiziert.

## Aktuelle Situation

### Event-spezifische Endpunkte (werden entfernt)
- `/api/library/[libraryId]/events/finalize` - Erstellt Final-Datei
- `/api/library/[libraryId]/events/publish-final` - Index-Swap

### Event-spezifische Templates (werden angepasst)
- `event-finalize-de.md` - Wird generisch (funktioniert für beliebige Verzeichnisse)
- `event-publish-final-de.md` - Wird entfernt (Publish-Step integriert)

## Implementierungsschritte

### Phase 1: Generische Discovery-Funktion

**Datei**: `src/lib/creation/folder-artifact-discovery.ts` (neu)

```typescript
interface FolderArtifact {
  fileId: string
  fileName: string
  createdAt: string
  type: 'main' | 'testimonial' | 'other'
  content: string // Markdown-Body
  metadata: Record<string, unknown> // Frontmatter
}

/**
 * Entdeckt alle Artefakte in einem Verzeichnis
 * - Haupt-Artefakt (z.B. Event-Markdown)
 * - Zusätzliche Artefakte (z.B. Testimonial-Transcripte)
 * - Sortiert chronologisch
 */
export async function discoverFolderArtifacts(
  provider: StorageProvider,
  folderId: string,
  options?: {
    mainArtifactPattern?: RegExp // z.B. /^event.*\.md$/i
    testimonialPattern?: RegExp // z.B. /testimonial/i
  }
): Promise<FolderArtifact[]>
```

**Aufgaben**:
1. ✅ Verzeichnis durchsuchen
2. ✅ Haupt-Artefakt identifizieren (Pattern-basiert)
3. ✅ Testimonial-Artefakte finden (via `discoverTestimonials`)
4. ✅ Chronologisch sortieren
5. ✅ Frontmatter + Body parsen

### Phase 2: Generischer Select-Step

**Datei**: `src/components/creation-wizard/steps/select-related-artifacts-step.tsx` (neu)

Generische Version von `select-related-testimonials-step.tsx`:
- Funktioniert für beliebige Artefakte (nicht nur Testimonials)
- Verwendet `discoverFolderArtifacts`
- Zeigt chronologische Liste
- User kann auswählen, welche verwendet werden sollen

**Aufgaben**:
1. ✅ Generische `FolderArtifact`-Liste anzeigen
2. ✅ Checkboxen für Auswahl
3. ✅ Chronologische Sortierung
4. ✅ Zusammenfassung pro Artefakt (Name, Datum, Text-Ausschnitt)

### Phase 3: Template anpassen

**Datei**: `template-samples/event-finalize-de.md` (anpassen)

```yaml
creation:
  supportedSources:
    - id: folder
      type: folder
      label: "Verzeichnis mit Artefakten"
  flow:
    steps:
      - id: Welcome
        preset: welcome
      - id: Select
        preset: selectRelatedArtifacts  # Generisch!
      - id: Generate
        preset: generateDraft
      - id: Review
        preset: editDraft
      - id: Preview
        preset: previewDetail
      - id: Publish
        preset: publish  # Immer am Ende
```

**Aufgaben**:
1. ✅ `selectRelatedTestimonials` → `selectRelatedArtifacts`
2. ✅ `publish` Step hinzufügen
3. ✅ `event-publish-final-de.md` entfernen

### Phase 4: Creation-Wizard erweitern

**Datei**: `src/components/creation-wizard/creation-wizard.tsx`

**Neue Presets**:
- `selectRelatedArtifacts` - Generische Artefakt-Auswahl
- `publish` - Bereits vorhanden, aber für Finalize-Wizard anpassen

**Aufgaben**:
1. ✅ `selectRelatedArtifacts` Preset hinzufügen
2. ✅ `publish` Preset für Finalize-Wizard anpassen
3. ✅ Index-Swap-Logik integrieren (aus `publish-final` Route)

### Phase 5: Publish-Logik integrieren

**Datei**: `src/components/creation-wizard/creation-wizard.tsx` (onPublish)

**Index-Swap-Logik**:
```typescript
// 1. Final ingestieren
await IngestionService.upsertMarkdown(...)

// 2. Original aus Index löschen
await deleteVectorsByFileId(libraryKey, originalFileId)
```

**Aufgaben**:
1. ✅ Index-Swap-Logik in `onPublish` integrieren
2. ✅ Fehlerbehandlung (falls Ingestion fehlschlägt, Original nicht löschen)
3. ✅ Progress-Anzeige

### Phase 6: Alte Endpunkte entfernen

**Dateien**:
- `src/app/api/library/[libraryId]/events/finalize/route.ts` - Entfernen
- `src/app/api/library/[libraryId]/events/publish-final/route.ts` - Entfernen
- `template-samples/event-publish-final-de.md` - Entfernen

**Aufgaben**:
1. ✅ Endpunkte entfernen
2. ✅ Template entfernen
3. ✅ Referenzen im Code entfernen

## Migration

### Bestehende Final-Dateien

Bestehende Final-Dateien (erstellt via `/events/finalize`) bleiben erhalten. Der neue Wizard kann sie als "Resume" öffnen und direkt publizieren.

### Neue Final-Dateien

Werden über den generischen Wizard erstellt:
1. User startet Wizard aus Event-Verzeichnis
2. Wizard entdeckt automatisch Event + Testimonials
3. User wählt aus, welche verwendet werden sollen
4. Wizard transformiert → Final-Datei
5. User publiziert → Index-Swap

## Vorteile

1. **Generisch**: Funktioniert für Events, Dialogräume, etc.
2. **Konsistent**: Gleiche Logik wie Creation-Wizard
3. **Einfacher**: Ein Wizard statt zwei (Finalize + Publish)
4. **Wartbar**: Weniger Code-Duplikation

## Offene Fragen

1. **Wie identifizieren wir das Haupt-Artefakt?**
   - Option A: Pattern-basiert (z.B. `/^event.*\.md$/i`)
   - Option B: Erste Markdown-Datei im Verzeichnis
   - Option C: Konfigurierbar im Template

2. **Wie sortieren wir chronologisch?**
   - Option A: Nach `createdAt` aus Frontmatter
   - Option B: Nach Dateiname (falls Datum enthalten)
   - Option C: Nach Datei-Erstellungsdatum

3. **Wie behandeln wir Transformation-Artefakte?**
   - Option A: Immer Transformation-Artefakt verwenden (falls vorhanden)
   - Option B: Transcript-Artefakt verwenden (roher Text)
   - Option C: User kann wählen

## Nächste Schritte

1. ✅ `discoverFolderArtifacts` implementieren
2. ✅ `selectRelatedArtifacts` Step erstellen
3. ✅ Template anpassen
4. ✅ Creation-Wizard erweitern
5. ✅ Publish-Logik integrieren
6. ✅ Alte Endpunkte entfernen
7. ✅ Tests schreiben
