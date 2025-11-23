# Library Root Loading - Performance Analyse

## Use Case: Laden der Library-Root beim ersten Mal

### Potenzielle Probleme identifiziert

#### 1. Doppelte Root-Item-Ladung

**Problem:** Zwei Komponenten laden möglicherweise gleichzeitig Root-Items:

- **FileTree** (`src/components/library/file-tree.tsx:156`):
  - `loadRootItems()` ruft `provider.listItemsById('root')` auf
  - Wird beim Mount der FileTree-Komponente ausgeführt

- **Library** (`src/components/library/library.tsx:163`):
  - `loadItems()` ruft `listItems('root')` auf (wenn `currentFolderId === 'root'`)
  - Wird im `useEffect` für Initial-Load ausgeführt

**Mögliche Lösung:**
- Cache-Sharing zwischen FileTree und Library
- Oder: FileTree verwendet Library-State statt eigenen API-Call

#### 2. Mehrfache useEffect-Ausführungen

**Library-Komponente (`library.tsx:320`):**
- `useEffect` hat viele Dependencies: `[providerInstance, libraryStatus, currentFolderId, lastLoadedFolder, activeLibraryId, loadItems, searchParams]`
- `loadItems` ist ein `useCallback` mit vielen Dependencies
- Bei jeder Änderung einer Dependency könnte der Effect erneut ausgeführt werden

**Mögliche Lösung:**
- Dependencies reduzieren
- `loadInFlightRef` prüfen, aber Timing könnte problematisch sein

#### 3. StorageContext listItems

**StorageContext (`storage-context.tsx:520`):**
- `listItems` wird von mehreren Stellen aufgerufen
- Keine zentrale Cache-Verwaltung sichtbar
- Jeder Aufruf könnte einen API-Request auslösen

### Zu analysierende Logs

Nach der Anmeldung sollten folgende Logs erscheinen:

1. **Client-seitig:**
   - `[StorageContext]` - Library Loading
   - `[Library]` - Initial load triggered
   - `[FileTree]` - Root-Items laden
   - `[NAV]` - Navigation Events

2. **Server-seitig:**
   - `[API][filesystem][list]` - API-Calls für Root-Items
   - `[API][filesystem]` - Allgemeine Filesystem-Requests

### Metriken zu messen

- Anzahl der API-Calls für Root-Items
- Zeit zwischen erstem und letztem Root-Item-Call
- Anzahl der Re-Renders
- Cache-Hit-Rate

## Analyse-Ergebnisse (22.11.2025)

### 1. Doppelte Root-Item-Ladung ✅ BESTÄTIGT

**Zeitstempel:**
- `22:07:41.616Z` - FileTree startet Root-Load
- `22:07:41.619Z` - Library startet Root-Load (nur 3ms später!)

**Network-Requests:**
- Mindestens **4 separate** `GET /api/storage/filesystem?action=list&fileId=root` Calls
- Alle innerhalb weniger Millisekunden

**Problem:**
- FileTree und Library laden beide Root-Items unabhängig voneinander
- Keine Koordination zwischen den Komponenten
- Jede Komponente macht eigenen API-Call

### 2. Unnötige get-Requests

**Problem:**
- Nach dem Laden der Root-Liste werden für **jede Datei** separate `action=get` Requests gemacht
- Diese Requests holen Metadaten, die bereits in der Root-Liste enthalten sein könnten
- Beispiel: 27 Dateien = 27 zusätzliche API-Calls

**Network-Requests:**
```
[GET] .../action=get&fileId=MDEgLSBVbmJla2FubnRlIEludGVycGV0IC0gVW5iZWthbm50ZSBUaXRlbC5kZS5tZA==
[GET] .../action=get&fileId=MDEgLSBVbmJla2FubnRlIEludGVycGV0IC0gVW5iZWthbm50ZSBUaXRlbC5tcDM=
[GET] .../action=get&fileId=MjAyNTA0MjFfMTI1MTAzLmpwZw==
... (24 weitere)
```

### 3. Mehrfache useEffect-Ausführungen

**Beobachtung:**
- Library-Komponente hat `useEffect` mit vielen Dependencies
- `loadItems` wird mehrfach aufgerufen
- Cache-Check (`lastLoadedFolder !== currentFolderId`) funktioniert, aber Timing ist problematisch

### 4. Doppelte Binary-Requests

**Problem:**
- Einige Dateien werden mehrfach geladen (z.B. `Diva Shoplösungen.de.md` 3x)
- Vermutlich durch verschiedene Komponenten (Preview, FileRow, etc.)

## Gefundene Root-Item-Ladungen

**Mindestens 8 verschiedene Stellen laden Root-Items:**

1. **FileTree** (`file-tree.tsx:160`) - `loadRootItems()`
2. **Library** (`library.tsx:163`) - `loadItems('root')`
3. **MarkdownPreview** (`markdown-preview.tsx:215, 345`) - `listItems('root')` (2x!)
4. **JobReportTab** (`job-report-tab.tsx:163`) - `provider.listItemsById('root')`
5. **PdfPhaseSettings** (`pdf-phase-settings.tsx:47`) - `listItems('root')`
6. **PdfTransform** (`pdf-transform.tsx:67`) - `provider.listItemsById('root')`
7. **TransformationDialog** (`transformation-dialog.tsx:87`) - `listItems('root')`
8. **CombinedChatDialog** (`combined-chat-dialog.tsx:48`) - `provider.listItemsById('root')`

**Problem:** Jede Komponente macht eigenen API-Call, keine Koordination!

## Empfohlene Optimierungen

### 1. Zentrale Root-Item-Verwaltung (PRIORITÄT: HOCH)

**Lösung:** Gemeinsames Atom für Root-Items

```typescript
// src/atoms/library-atom.ts
export const rootItemsAtom = atom<StorageItem[] | null>(null);

// StorageContext oder Library-Komponente lädt einmal
// Alle anderen Komponenten verwenden das Atom
```

**Vorteile:**
- Nur 1 API-Call statt 8+
- Sofortige Verfügbarkeit für alle Komponenten
- Konsistente Daten

**Implementierung:**
- Root-Items in `folderItemsAtom` speichern wenn `currentFolderId === 'root'`
- FileTree verwendet `folderItemsAtom` statt eigenen Call
- Andere Komponenten verwenden `folderItemsAtom` oder dediziertes `rootItemsAtom`

### 2. Request-Deduplizierung (PRIORITÄT: MITTEL)

**Lösung:** Promise-Sharing für identische Requests

```typescript
// src/lib/storage/request-deduplicator.ts
const pendingRequests = new Map<string, Promise<StorageItem[]>>();

export function deduplicateRequest(key: string, request: () => Promise<StorageItem[]>) {
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key)!;
  }
  const promise = request().finally(() => pendingRequests.delete(key));
  pendingRequests.set(key, promise);
  return promise;
}
```

**Vorteile:**
- Mehrfache gleichzeitige Requests werden zusammengeführt
- Reduziert Server-Last

### 3. Batch-Requests für Metadaten (PRIORITÄT: NIEDRIG)

**Problem:** 27 separate `get`-Requests für Metadaten

**Lösung:** Batch-API oder Metadaten in `list`-Response

**Vorteile:**
- Reduziert 27 Requests auf 1-2 Requests
- Schnelleres Laden

### 4. useEffect-Dependencies optimieren (PRIORITÄT: MITTEL)

**Problem:** Library `useEffect` hat viele Dependencies

**Lösung:**
- Dependencies reduzieren
- Stabile Referenzen verwenden (`useRef` für Callbacks)
- `loadInFlightRef` verbessern

## Nächste Schritte

1. ✅ Analyse abgeschlossen
2. ⏳ Implementierung: Zentrale Root-Item-Verwaltung
3. ⏳ Implementierung: Request-Deduplizierung
4. ⏳ Testing: Performance-Messung vor/nach Optimierung

