# Browser-Test Analyse: Root-Laden und Navigation

## Test-Szenario
1. Root-Verzeichnis laden (`http://localhost:3000/library`)
2. In Unterverzeichnis navigieren ("2. Wertephase")

## Identifizierte API-Calls

### Root-Laden (Initial)

**Notwendige Calls:**
- ✅ `action=list&fileId=root` (1x) - Root-Items laden
- ✅ `action=list&fileId=LmNrLW1ldGE=` (1x) - Favoriten laden
- ✅ `action=binary&fileId=LmNrLW1ldGEvZmF2b3JpdGVzLmpzb24=` (1x) - Favoriten-Datei laden
- ✅ `action=get` (27x) - Metadaten für Dateien (für Shadow-Twin-Analyse)
- ✅ `file-status` (9x) - Doc-Status für Markdown-Dateien (debounced)

**Problematische Calls:**
- ❌ `action=list&fileId=root` (2x zusätzlich) - **DOUBLETTE**
  - Zeile 194: Zweiter Root-Call während Shadow-Twin-Analyse
  - Ursache: `getPathItemsById` lädt Root-Items für Pfadaufbau

### Navigation zu Unterverzeichnis

**Notwendige Calls:**
- ✅ `action=path&fileId=Mi4gV2VydGVwaGFzZQ==` (1x) - Pfad aufbauen
- ✅ `action=list&fileId=root` (1x) - Root-Items für Pfadaufbau (notwendig, aber könnte gecacht werden)
- ✅ `action=list&fileId=Mi4gV2VydGVwaGFzZQ==` (1x) - Zielordner-Inhalt laden

**Problematische Calls:**
- ❌ `action=list&fileId=Mi4gV2VydGVwaGFzZQ==` (2x) - **DOUBLETTE**
  - Zeile 391-392: Erster Call durch `loadItems`
  - Zeile 400-401: Zweiter Call durch `loadItems` (warum?)
  - Ursache: `loadItems` wird zweimal aufgerufen (Race-Condition?)

## Identifizierte Probleme

### 1. Doppelte Root-Requests

**Problem:**
- Root wird 3x geladen statt 1x
- Zweiter Call durch `getPathItemsById` während Shadow-Twin-Analyse
- Dritter Call durch `getPathItemsById` beim Navigieren

**Ursache:**
- `getPathItemsById` lädt Root-Items für Pfadaufbau
- Root-Items sind bereits im Cache, aber `getPathItemsById` macht trotzdem API-Call

**Lösung:**
- `getPathItemsById` sollte Root-Items aus Cache verwenden, wenn verfügbar
- Oder: Root-Items werden bereits beim Initial-Load geladen und sind im Cache

### 2. Doppelte Zielordner-Requests

**Problem:**
- Zielordner wird 2x geladen statt 1x
- Beide Calls durch `loadItems` mit `cacheHit: false`

**Ursache:**
- `loadItems` wird zweimal aufgerufen (Race-Condition?)
- Cache-Check schlägt fehl oder Cache ist noch nicht aktualisiert

**Lösung:**
- Cache-Check vor API-Call verbessern
- `loadInFlightRef` sollte Race-Conditions verhindern, aber scheint nicht zu greifen

### 3. Viele Metadaten-Requests

**Problem:**
- 27+ `action=get` Requests für Metadaten
- Jeder Request lädt nur Metadaten für eine Datei

**Ursache:**
- Shadow-Twin-Analyse lädt Metadaten für jede Datei einzeln
- Kein Batching vorhanden

**Lösung:**
- Metadaten-Batching implementieren
- Oder: Metadaten bereits in `listItems` Response enthalten

### 4. Root-Items für Pfadaufbau

**Problem:**
- `getPathItemsById` lädt Root-Items, obwohl sie bereits im Cache sind
- Root-Items werden für jeden Pfadaufbau neu geladen

**Ursache:**
- `getPathItemsById` macht immer API-Call für Root-Items
- Cache wird nicht verwendet

**Lösung:**
- `getPathItemsById` sollte Root-Items aus Cache verwenden
- Oder: Root-Items werden bereits beim Initial-Load geladen und sind im Cache

## Empfohlene Optimierungen

### Priorität 1 (Höchste Impact)

1. **Doppelte Zielordner-Requests eliminieren:**
   - Cache-Check vor API-Call verbessern
   - `loadInFlightRef` sollte Race-Conditions verhindern
   - Prüfen, warum `loadItems` zweimal aufgerufen wird

2. **Root-Items für Pfadaufbau cachen:**
   - `getPathItemsById` sollte Root-Items aus Cache verwenden
   - Oder: Root-Items werden bereits beim Initial-Load geladen und sind im Cache

### Priorität 2 (Mittlere Impact)

3. **Metadaten-Batching:**
   - Metadaten bereits in `listItems` Response enthalten
   - Oder: Batch-API für Metadaten implementieren

4. **Doppelte Root-Requests eliminieren:**
   - `getPathItemsById` sollte Root-Items aus Cache verwenden
   - Oder: Root-Items werden bereits beim Initial-Load geladen und sind im Cache

### Priorität 3 (Niedrige Impact)

5. **Cache-Invalidierung optimieren:**
   - Cache wird nur bei Bedarf invalidiert
   - Cache-TTL implementieren

## Messungen

### Aktuelle Performance

**Root-Laden:**
- API-Calls: 3x Root, 1x Favoriten, 27x Metadaten, 9x file-status
- Gesamt: ~40 API-Calls
- Ladezeit: ~877ms (laut Logs)

**Navigation zu Unterverzeichnis:**
- API-Calls: 1x path, 1x root (für Pfad), 2x Zielordner (doppelt!)
- Gesamt: ~4 API-Calls (sollte 2 sein)
- Ladezeit: ~500ms (geschätzt)

### Ziel-Performance

**Root-Laden:**
- API-Calls: 1x Root, 1x Favoriten, 1x Batch-Metadaten, 1x Batch-file-status
- Gesamt: ~4 API-Calls
- Ladezeit: ~200-300ms

**Navigation zu Unterverzeichnis:**
- API-Calls: 1x Zielordner (aus Cache wenn möglich)
- Gesamt: ~1 API-Call
- Ladezeit: ~50-100ms

## Implementierte Optimierungen

### ✅ 1. Race-Condition bei loadItems behoben (Priorität 1)

**Problem:**
- `loadItems` wurde zweimal aufgerufen (Zeile 390-392 und 399-401)
- Ursache: `lastLoadedFolder` wurde erst nach dem API-Call gesetzt, aber `useEffect` lief erneut, bevor `lastLoadedFolder` aktualisiert wurde

**Lösung:**
- `setLastLoadedFolder` wird jetzt **optimistisch** gesetzt, bevor der API-Call gemacht wird
- Verhindert, dass `loadItems` zweimal aufgerufen wird
- Bei Context-Change wird `lastLoadedFolder` zurückgesetzt

**Datei:** `src/components/library/library.tsx`

**Impact:**
- Eliminiert doppelte Zielordner-Requests
- Reduziert API-Calls um ~50% bei Navigation

### ✅ 2. Root-Items für Pfadaufbau optimiert (Priorität 1)

**Problem:**
- `getPathItemsById` lädt Root-Items mit `listItemsById('root')`, das nicht dedupliziert ist
- Root-Items wurden doppelt geladen, obwohl sie bereits im Cache waren

**Lösung:**
- `useFolderNavigation` baut den Pfad jetzt **manuell** auf
- Verwendet `listItems` (dedupliziert) statt `getPathItemsById`
- Prüft Cache für Root-Items und Ordner im Pfad vor API-Calls

**Datei:** `src/hooks/use-folder-navigation.ts`

**Impact:**
- Eliminiert doppelte Root-Requests
- Reduziert API-Calls um ~33% bei Navigation
- Nutzt Cache effizienter

## Nächste Schritte

1. ✅ Doppelte Zielordner-Requests analysieren und beheben - **FERTIG**
2. ✅ Root-Items für Pfadaufbau cachen - **FERTIG**
3. ⏳ Performance messen und validieren
4. ⏳ Metadaten-Batching implementieren (optional, niedrige Priorität)

