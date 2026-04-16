# Analyse: Unterstrich-Verzeichnisse werden fälschlich versteckt

## Problem

`isShadowTwinFolderName()` filtert alle Verzeichnisse mit `_` oder `.` Prefix aus der UI.
Das trifft auch "echte" Verzeichnisse wie `_tex` (Texturen), die keine Shadow-Twins sind.

## Betroffene Stellen

| Datei | Zeilen | Kontext |
|-------|--------|---------|
| `src/components/library/file-list.tsx` | ~900 | Ordner-Filter im `folders`-Memo |
| `src/components/library/file-tree.tsx` | ~110, ~587 | TreeItem children + Root items |
| `src/components/library/pdf-bulk-import-dialog.tsx` | ~118 | Rekursiver Ordner-Scan |

## 3 Lösungsvarianten

### Variante 1: An `persistToFilesystem` koppeln (EMPFOHLEN)

Wenn `persistToFilesystem === false` und `primaryStore === 'mongo'`, werden keine
Shadow-Twin-Ordner im Filesystem angelegt. Dann gibt es keinen Grund, `_`-Verzeichnisse
zu filtern.

**Pro:** Logisch korrekt, keine neue Config-Flag nötig, nutzt bestehende Infrastruktur.
**Contra:** Alte Shadow-Twin-Ordner werden sichtbar, wenn man nachträglich umstellt.

### Variante 2: Eigene Flag `showUnderscoreFolders`

Neue separate Flag in den Library-Settings, unabhängig von Shadow-Twin-Config.

**Pro:** Maximale Flexibilität.
**Contra:** Noch ein Toggle – erhöht Komplexität und Konfigurationsaufwand.

### Variante 3: Heuristik verbessern (Ordner-Inhalt prüfen)

Statt Prefix-basiert zu filtern, prüfen ob ein `_`-Ordner tatsächlich Shadow-Twin-Artefakte enthält.

**Pro:** Genaueste Lösung.
**Contra:** Erfordert zusätzliche API-Calls pro `_`-Verzeichnis → Performance-Problem.

## Entscheidung

**Variante 1** – An `persistToFilesystem` koppeln.

- Neue Hilfsfunktion `shouldFilterShadowTwinFolders(shadowTwinConfig)` in `shadow-twin-folder-name.ts`
- UI-Filter prüfen diese Funktion statt blind alle `_`-Ordner zu filtern
- Config ist bereits im Client verfügbar über `activeLibraryAtom.config.shadowTwin`

## Betroffene Dateien

1. `src/lib/storage/shadow-twin-folder-name.ts` — Neue Funktion
2. `src/components/library/file-list.tsx` — Filter anpassen
3. `src/components/library/file-tree.tsx` — Filter anpassen (2 Stellen)
4. `src/components/library/pdf-bulk-import-dialog.tsx` — Filter anpassen
5. `tests/unit/storage/shadow-twin-folder-name.test.ts` — Tests erweitern
