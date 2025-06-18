# FileList Komponente

## 1. User Stories
- Als User möchte ich alle Dateien im aktuellen Ordner sehen und durchsuchen können.
- Als User möchte ich Dateien auswählen, um deren Vorschau zu sehen.
- Als User möchte ich Dateien sortieren, gruppieren, umbenennen, löschen und per Batch-Operationen verarbeiten können.

## 2. Initialisierung
- Wird geladen, sobald ein Ordner im FileTree ausgewählt wird.
- Nutzt den globalen Atom `currentFolderIdAtom` und lädt die Dateien über den Provider.

## 3. Features
- Tabellarische Dateiansicht mit Sortierung und Gruppierung (Shadow-Twins)
- Inline-Umbenennung, Löschen, Drag & Drop
- Batch-Operationen (z.B. Batch-Transkription)
- Checkbox-Auswahl für Mehrfachaktionen

## 4. Abhängigkeiten
- **Atoms:**
  - `currentFolderIdAtom`
  - `selectedItemAtom`
  - `selectedBatchItemsAtom`
  - `fileTreeReadyAtom`
- **Contexts:**
  - StorageContext (Provider)
- **Komponenten:**
  - FilePreview
  - TranscriptionDialog

## 5. API Calls
- `provider.listItemsById(folderId)` – Laden der Dateien
- `provider.renameItem(itemId, newName)` – Umbenennen
- `provider.deleteItem(itemId)` – Löschen
- Indirekt: Batch-Transkription (API-Call über BatchTransformService)
- Fehlerfälle: Authentifizierungsfehler, Name existiert, Netzwerkfehler

## 6. Auffälligkeiten & Verbesserungsmöglichkeiten
- Gruppierungslogik (Shadow-Twins) ist komplex und schwer testbar
- Batch-Operationen könnten besser gekapselt werden
- Drag & Drop und Rename-Logik sind eng mit UI verknüpft

## 7. ToDos
- Gruppierungs- und Sortierlogik in eigene Utilities auslagern
- Batch-Operationen als eigene Hooks/Komponenten
- Drag & Drop und Rename-Logik modularisieren
- Testabdeckung für alle Interaktionen erhöhen 