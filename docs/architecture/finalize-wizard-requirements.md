# Finalize-Wizard: Anforderungen

## Wichtige Anforderungen

### 1. Index-Swap (nicht Datei-Ersetzung)

**Was passiert:**
- ✅ Der ursprüngliche Event wird **im MongoDB-Index ersetzt** (nicht die Datei im Storage)
- ✅ Final-Datei wird mit **demselben `slug`** ingestiert
- ✅ Original-Datei bleibt im Storage erhalten
- ✅ Original wird aus Index gelöscht (nur Vektoren/Metadaten)

**Zweck:**
- Explorer/Gallery zeigt Final-Version (gleicher "Platz")
- Original bleibt für Nachvollziehbarkeit erhalten

### 2. Status-Änderung

**Status-Übergänge:**
- `eventStatus: 'open'` → `'closed'` (beim Finalisieren)
- `eventStatus: 'finalDraft'` → `'finalPublished'` (beim Publizieren)

**Zweck:**
- Klare Unterscheidung zwischen offenem Event und finalisiertem Event
- UI kann Status anzeigen (z.B. "Event abgeschlossen")

### 3. Wiederholte Finalisierungen

**Problem:**
- Bei wiederholten Finalisierungen würden vorherige Final-Dateien als Quellen verwendet werden
- Das führt zu Duplikaten und falschen Zusammenführungen

**Lösung:**
- ✅ **Nur ursprünglicher Event** wird als Haupt-Quelle verwendet
- ✅ **Nur Testimonials** werden als zusätzliche Quellen verwendet
- ✅ **`finals/` Ordner wird ignoriert** (Namenskonvention)
- ✅ Bei Index-Swap wird **immer derselbe Eintrag überschrieben** (gleicher `slug`)

**Namenskonvention:**
```
events/<eventSlug>/
  event.md                    ← Haupt-Quelle (wird verwendet)
  testimonials/               ← Zusätzliche Quellen (werden verwendet)
    <testimonialId>/
      ...
  finals/                     ← WIRD IGNORIERT (nicht als Quelle verwendet)
    run-<timestamp>/
      event-final.md
```

### 4. Determinismus durch Defaults

**Wizard-Verhalten:**
1. ✅ Automatisch alle Testimonials finden (aus `testimonials/` Ordner)
2. ✅ Automatisch alle auswählen (Default)
3. ✅ Automatisch Transformation generieren (wenn Template LLM verwendet)
4. ✅ User kann optional anpassen (aber muss nicht)

**Zweck:**
- Einfachheit für Standard-Fall (ein Klick → fertig)
- Flexibilität für Spezial-Fälle (User kann anpassen)

## Technische Umsetzung

### Discovery-Logik

```typescript
async function discoverFolderArtifacts(
  provider: StorageProvider,
  folderId: string
): Promise<FolderArtifact[]> {
  const items = await provider.listItemsById(folderId)
  
  // 1. Finde Haupt-Artefakt (Event-Markdown)
  // IGNORIERE: Dateien in `finals/` Unterordnern
  const mainArtifact = items.find(
    it => it.type === 'file' && 
    it.metadata?.name?.endsWith('.md') &&
    !it.metadata?.name?.includes('final') &&
    !it.parentId?.includes('finals')
  )
  
  // 2. Finde Testimonials (aus testimonials/ Ordner)
  const testimonialsFolder = items.find(
    it => it.type === 'folder' && it.metadata?.name === 'testimonials'
  )
  
  // 3. IGNORIERE: finals/ Ordner komplett
  // (wird nicht als Quelle verwendet)
  
  return artifacts
}
```

### Index-Swap-Logik

```typescript
async function publishFinal(
  finalFileId: string,
  originalFileId: string,
  slug: string
) {
  // 1. Final ingestieren (mit gleichem slug)
  await IngestionService.upsertMarkdown(
    userEmail,
    libraryId,
    finalFileId,
    fileName,
    markdown,
    { 
      docType: 'event',
      slug, // Gleicher slug wie Original
      eventStatus: 'closed' // Status ändern
    }
  )
  
  // 2. Original aus Index löschen (nur Vektoren, nicht Datei)
  await deleteVectorsByFileId(libraryKey, originalFileId)
  
  // WICHTIG: Bei wiederholten Publizierungen wird derselbe Eintrag überschrieben
  // (gleicher slug = Update statt Duplikat)
}
```

### Status-Management

**Frontmatter im Final:**
```yaml
---
eventStatus: closed  # Beim Finalisieren
originalFileId: <eventFileId>  # Referenz auf Original
slug: <originalSlug>  # Gleicher slug wie Original
---
```

**Nach Publizieren:**
- Index-Eintrag hat `eventStatus: 'closed'`
- Original-Datei bleibt mit `eventStatus: 'open'` (im Storage)

## Migration

### Bestehende Final-Dateien

- Werden nicht als Quellen verwendet (werden ignoriert)
- Können als "Resume" geöffnet werden (direkt publizieren)
- Werden beim nächsten Finalisieren überschrieben (gleicher slug)

### Neue Final-Dateien

- Werden in `finals/run-<timestamp>/` gespeichert
- Werden beim nächsten Finalisieren ignoriert
- Nur eine Final-Datei wird im Index sein (mit `slug`)

## Vorteile

1. ✅ **Deterministisch**: Immer gleiche Quellen (Event + Testimonials)
2. ✅ **Keine Duplikate**: Vorherige Final-Dateien werden ignoriert
3. ✅ **Einfach**: User muss nichts wissen (Defaults)
4. ✅ **Flexibel**: User kann optional anpassen
5. ✅ **Konsistent**: Gleicher slug = Update statt Duplikat
