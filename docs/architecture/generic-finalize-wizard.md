# Generischer Finalize/Publish-Wizard

## Ziel

Ein generischer Wizard, der Inhalte eines Verzeichnisses zusammenführt, transformiert und publiziert. Nicht Event-spezifisch, sondern für beliebige Verzeichnisse mit Artefakten.

## Konzept

### Grundidee

Ein Verzeichnis enthält:
- **Haupt-Artefakt** (z.B. Event-Markdown)
- **Zusätzliche Artefakte** (z.B. Testimonial-Transcripte)
- Alle werden **chronologisch** zusammengeführt und mit einem **Template transformiert**

### Unterschied zu Creation-Wizard

| Aspekt | Creation-Wizard | Finalize-Wizard |
|--------|----------------|-----------------|
| **Input** | Externe Quelle (Text/URL/PDF) | Verzeichnis mit Artefakten |
| **Ziel** | Neues Artefakt erstellen | Bestehende Artefakte zusammenführen |
| **Transformation** | Template-basiert | Template-basiert (gleiche Logik) |
| **Publish** | Optional (am Ende) | Immer (letzter Schritt) |

## Wizard-Flow

### Schritt 1: Welcome
- Willkommensnachricht
- Erklärt, was zusammengeführt wird

### Schritt 2: Quellen auswählen
- Zeigt alle Artefakte im Verzeichnis
- User kann auswählen, welche verwendet werden sollen
- Chronologische Sortierung (nach `createdAt` oder Dateiname)

### Schritt 3: Transformation generieren
- Lädt Template
- Sammelt alle ausgewählten Artefakte
- Sendet an Secretary Service für Transformation
- Erzeugt finales Markdown mit Frontmatter

### Schritt 4: Review/Edit
- Zeigt generiertes Markdown
- User kann Frontmatter-Felder bearbeiten
- User kann Body bearbeiten

### Schritt 5: Preview
- Zeigt Vorschau der finalen Seite
- Verwendet `detailViewType` aus Template

### Schritt 6: Publish
- Speichert finales Artefakt
- Führt Index-Swap durch (falls Original vorhanden)
- Ingestion ins RAG-System

## Technische Umsetzung

### Generische Verzeichnis-Discovery

```typescript
interface FolderArtifact {
  fileId: string
  fileName: string
  createdAt: string
  type: 'main' | 'testimonial' | 'other'
  content: string // Markdown-Body
  metadata: Record<string, unknown> // Frontmatter
}

async function discoverFolderArtifacts(
  provider: StorageProvider,
  folderId: string
): Promise<FolderArtifact[]> {
  // 1. Finde Haupt-Artefakt (z.B. Event-Markdown)
  // 2. Finde zusätzliche Artefakte (z.B. Testimonial-Transcripte)
  // 3. Sortiere chronologisch
  // 4. Parse Frontmatter + Body
}
```

### Template-Transformation

- Verwendet bestehende `runTemplatePhase` Logik
- Input: Array von Artefakten (Haupt + zusätzliche)
- Output: Finales Markdown mit Frontmatter

### Publish-Logik

- Verwendet bestehende Shadow-Twin-Logik
- Index-Swap: Final ingestieren, Original aus Index entfernen
- Job-Worker für asynchrone Verarbeitung

## Migration von Event-spezifischer Logik

### Aktuelle Event-spezifische Endpunkte

1. `/api/library/[libraryId]/events/finalize` → Wird zu generischem Wizard
2. `/api/library/[libraryId]/events/publish-final` → Wird zu generischem Publish-Step

### Neue generische Struktur

```
/api/wizard/finalize
  - POST: Startet Wizard-Session
  - GET: Lädt Wizard-Status

/api/wizard/finalize/[sessionId]/transform
  - POST: Startet Transformation (Secretary Service)

/api/wizard/finalize/[sessionId]/publish
  - POST: Publiziert finales Artefakt (Index-Swap)
```

## Template-Struktur

### Beispiel: `event-finalize-de.md`

```yaml
---
title: {{title|Titel des finalen Events}}
teaser: {{teaser|Kurzüberblick}}

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
---
```

## Vorteile der generischen Lösung

1. **Wiederverwendbar**: Funktioniert für Events, Dialogräume, etc.
2. **Konsistent**: Gleiche Logik wie Creation-Wizard
3. **Erweiterbar**: Neue Artefakt-Typen einfach hinzufügbar
4. **Testbar**: Einheitliche Test-Strategie

## Nächste Schritte

1. ✅ Generische `discoverFolderArtifacts` Funktion erstellen
2. ✅ `selectRelatedArtifacts` Step erstellen (generisch)
3. ✅ Transformation-Logik anpassen (mehrere Artefakte als Input)
4. ✅ Publish-Step integrieren (wie Creation-Wizard)
5. ✅ Event-spezifische Endpunkte entfernen
6. ✅ Template `event-publish-final-de.md` entfernen
