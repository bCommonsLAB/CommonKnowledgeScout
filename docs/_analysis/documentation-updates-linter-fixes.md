# Dokumentationsaktualisierungen - Linter-Fehler Behebung

**Datum:** 2025-01-XX  
**Kontext:** Systematische Behebung aller Linter-Fehler im Build-Prozess

## Zusammenfassung

Im Rahmen der Linter-Fehler-Behebung wurden mehrere API-Signaturen geändert, Import-Pfade korrigiert und unbenutzte Exporte entfernt. Diese Änderungen müssen in der Dokumentation reflektiert werden.

## Kritische API-Änderungen

### 1. `useRootItems` Hook - Signatur geändert

**Datei:** `src/hooks/use-root-items.ts`

**Änderung:**
- **Vorher:** `useRootItems(provider?: StorageProvider | null)`
- **Nachher:** `useRootItems()`

**Grund:** Provider wird jetzt intern aus `useStorage()` Context geladen, kein Parameter mehr nötig.

**Betroffene Dokumentation:**
- `docs/reference/modules/library.md` - Falls `useRootItems` dort dokumentiert ist
- `docs/reference/file-index.md` - Falls dort erwähnt
- Alle Use-Cases die `useRootItems` verwenden

**Aktualisierung erforderlich:**
```typescript
// ❌ ALT (falsch)
const getRootItems = useRootItems(provider);

// ✅ NEU (korrekt)
const getRootItems = useRootItems();
```

### 2. `getVectorIndexForLibrary` - Parameter entfernt

**Datei:** `src/lib/chat/config.ts`

**Änderung:**
- **Vorher:** `getVectorIndexForLibrary(library, chatConfig?, userEmail?)`
- **Nachher:** `getVectorIndexForLibrary(library, chatConfig?)`

**Grund:** `userEmail` Parameter wurde nicht verwendet und entfernt.

**Betroffene Dokumentation:**
- `docs/reference/modules/chat.md` - Falls dort dokumentiert
- `docs/reference/file-index.md` - Zeile 50 erwähnt die Funktion

**Aktualisierung erforderlich:**
```typescript
// ❌ ALT (falsch)
const index = getVectorIndexForLibrary(library, config, userEmail);

// ✅ NEU (korrekt)
const index = getVectorIndexForLibrary(library, config);
```

### 3. `getFilteredDocumentCount` - Signatur erweitert

**Datei:** `src/lib/db/queries-repo.ts`

**Änderung:**
- **Vorher:** `getFilteredDocumentCount(library: Library, filter: Record<string, unknown>)`
- **Nachher:** `getFilteredDocumentCount(libraryOrId: Library | string, filter: Record<string, unknown>)`

**Grund:** Funktion akzeptiert jetzt auch `libraryId` (string) direkt, um flexibler zu sein.

**Betroffene Dokumentation:**
- `docs/reference/file-index.md` - Falls dort dokumentiert
- `docs/reference/modules/chat.md` - Falls dort erwähnt

**Aktualisierung erforderlich:**
```typescript
// ✅ Beide Varianten sind jetzt möglich:
const count1 = await getFilteredDocumentCount(library, filter);
const count2 = await getFilteredDocumentCount(libraryId, filter);
```

### 4. `findOrCreateShadowTwinFolder` - Rückgabetyp geändert

**Datei:** `src/lib/external-jobs/shadow-twin-helpers.ts`

**Änderung:**
- **Vorher:** Rückgabetyp war `Promise<StorageItem | undefined>` (implizit)
- **Nachher:** Rückgabetyp ist explizit `Promise<string | undefined>` (nur ID)

**Grund:** Funktion gibt jetzt nur die Folder-ID zurück, nicht das komplette StorageItem-Objekt.

**Betroffene Dokumentation:**
- `docs/architecture/shadow-twin.md` - Falls dort Usage-Beispiele vorhanden
- `docs/reference/file-index.md` - Falls dort erwähnt

**Aktualisierung erforderlich:**
```typescript
// ❌ ALT (falsch)
const folder = await findOrCreateShadowTwinFolder(...);
if (folder) {
  const folderId = folder.id;
  const folderName = folder.metadata.name;
}

// ✅ NEU (korrekt)
const folderId = await findOrCreateShadowTwinFolder(...);
if (folderId) {
  // Verwende folderId direkt
}
```

## Import-Pfad-Korrekturen

### 5. `ShadowTwinState` Import-Pfad

**Änderung:**
- **Vorher:** `import { ShadowTwinState } from '@/atoms/shadow-twin-atom'`
- **Nachher:** `import { ShadowTwinState } from '@/lib/shadow-twin/shared'`

**Betroffene Dateien:**
- `src/hooks/use-shadow-twin-analysis.ts`

**Dokumentation:** Keine direkte Aktualisierung nötig, da dies interne Implementierungsdetails sind.

### 6. `ExternalJob` Import-Pfad

**Änderung:**
- **Vorher:** `import type { ExternalJob } from '@/types/external-jobs'`
- **Nachher:** `import type { ExternalJob } from '@/types/external-job'`

**Betroffene Dateien:**
- `src/lib/external-jobs/shadow-twin-helpers.ts`

**Dokumentation:** Keine direkte Aktualisierung nötig, da dies interne Implementierungsdetails sind.

### 7. `toMongoShadowTwinState` Import-Pfad

**Änderung:**
- **Vorher:** `import { toMongoShadowTwinState } from '@/lib/shadow-twin/analyze-shadow-twin'`
- **Nachher:** `import { toMongoShadowTwinState } from '@/lib/shadow-twin/shared'`

**Betroffene Dateien:**
- `src/lib/external-jobs/extract-only.ts`

**Dokumentation:** Falls in `docs/architecture/shadow-twin.md` Code-Referenzen vorhanden sind, sollten diese aktualisiert werden.

## Entfernte Exporte

### 8. `maybeProcessImages` entfernt

**Datei:** `src/lib/external-jobs/images.ts`

**Änderung:** Export `maybeProcessImages` wurde entfernt, da unbenutzt.

**Betroffene Dokumentation:**
- `docs/reference/file-index.md` - Zeile 71 erwähnt `maybeProcessImages` als Export

**Aktualisierung erforderlich:**
```markdown
| `src/lib/external-jobs/images.ts` | external-jobs | Image archive extraction | `processAllImageSources` | Job callback |
```

### 9. Unbenutzte Parameter entfernt

**Betroffene Funktionen:**
- `TransformSaveOptions` - `defaultIncludeOcrImages` und `defaultIncludePageImages` Parameter hinzugefügt (waren in Interface definiert, aber nicht in Funktionssignatur)

**Dokumentation:** Keine direkte Aktualisierung nötig, da dies interne Implementierungsdetails sind.

## Type-Assertions hinzugefügt

### 10. `indexOverride` Type-Assertions

**Datei:** `src/lib/chat/loader.ts`

**Änderung:** `indexOverride` existiert nicht mehr im Typ `LibraryChatConfig.vectorStore`, wird aber für Migration noch verwendet. Type-Assertions hinzugefügt.

**Dokumentation:** Keine direkte Aktualisierung nötig, da dies interne Migrations-Logik ist.

## Empfohlene Dokumentationsaktualisierungen

### Priorität: HOCH

1. **`docs/reference/file-index.md`**
   - Zeile 50: `getVectorIndexForLibrary` - Parameter-Liste aktualisieren
   - Zeile 71: `maybeProcessImages` entfernen, durch `processAllImageSources` ersetzen

2. **`docs/reference/modules/library.md`**
   - Falls `useRootItems` dort dokumentiert ist: Signatur aktualisieren

3. **`docs/reference/modules/chat.md`**
   - Falls `getVectorIndexForLibrary` dort dokumentiert ist: Signatur aktualisieren

### Priorität: MITTEL

4. **`docs/architecture/shadow-twin.md`**
   - Usage-Beispiele für `findOrCreateShadowTwinFolder` aktualisieren (falls vorhanden)
   - Code-Referenzen für `toMongoShadowTwinState` Import-Pfad prüfen

5. **`docs/reference/modules/storage.md`**
   - Falls `getFilteredDocumentCount` dort dokumentiert ist: Signatur aktualisieren

### Priorität: NIEDRIG

6. **Use-Case Dokumentation**
   - Alle Use-Cases prüfen, die `useRootItems` verwenden
   - Code-Beispiele aktualisieren

## Nicht dokumentationsrelevant

Folgende Änderungen sind rein intern und benötigen keine Dokumentationsaktualisierung:

- Entfernung unbenutzter Variablen (`UILogger`, `startupT0Ref`, `NavigationLogger`, etc.)
- `prefer-const` Korrekturen
- Unescaped Entities in JSX
- React Hook Dependencies Warnungen (sind Warnungen, keine Fehler)

## Nächste Schritte

1. ✅ Build erfolgreich - alle kritischen Fehler behoben
2. ✅ Dokumentationsdateien aktualisieren (siehe oben)
3. ✅ Code-Beispiele in Dokumentation aktualisiert
4. ⏳ Changelog aktualisieren (falls vorhanden)

## Durchgeführte Aktualisierungen

### ✅ Aktualisiert (2025-01-XX)

1. **`docs/reference/file-index.md`**
   - ✅ `getVectorIndexForLibrary` - Signatur mit Parameter-Liste aktualisiert
   - ✅ `maybeProcessImages` → `processAllImageSources` korrigiert
   - ✅ `getFilteredDocumentCount` - Signatur mit `libraryOrId` dokumentiert
   - ✅ `findOrCreateShadowTwinFolder` - Hinzugefügt mit korrektem Rückgabetyp

2. **`docs/reference/modules/chat.md`**
   - ✅ `getVectorIndexForLibrary` zu Exports hinzugefügt
   - ✅ Usage-Beispiel für `getVectorIndexForLibrary` hinzugefügt

3. **`docs/reference/modules/library.md`**
   - ✅ Usage-Beispiel für `useRootItems` und `useRootItemsSync` hinzugefügt

4. **`docs/architecture/shadow-twin.md`**
   - ✅ Usage-Beispiel für `findOrCreateShadowTwinFolder` hinzugefügt
   - ✅ Rückgabetyp (`string | undefined`) dokumentiert

### ⏳ Nicht erforderlich

- Use-Cases enthalten keine Code-Beispiele mit den geänderten Funktionen
- `docs/reference/modules/storage.md` - enthält keine Referenz zu `getFilteredDocumentCount`

