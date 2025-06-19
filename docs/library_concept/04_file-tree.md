# FileTree Komponente

## 1. User Stories
- Als User möchte ich die Ordnerstruktur meiner Bibliothek sehen und darin navigieren.
- Als User möchte ich Ordner auf- und zuklappen können.
- Als User möchte ich Dateien und Ordner per Drag & Drop verschieben können.

## 2. Initialisierung
- Wird beim Laden der Library-Ansicht initialisiert.
- Lädt die Root-Ordner und deren Kinder bei Bedarf (Lazy Loading).

## 3. Features
- Anzeige der Ordnerstruktur (Tree View)
- Lazy Loading von Unterordnern
- Drag & Drop für Verschieben von Dateien/Ordnern
- Visuelles Feedback für Auswahl und Drag-Status

## 4. Abhängigkeiten
- **Atoms:**
  - `currentFolderIdAtom`
  - `fileTreeReadyAtom`
- **Contexts:**
  - StorageContext (Provider)
- **Komponenten:**
  - Wird im Library-Layout verwendet

## 5. API Calls
- `provider.listItemsById(folderId)` – Laden von Ordnerinhalten
- `provider.moveItem(itemId, targetFolderId)` – Verschieben von Dateien/Ordnern
- Fehlerfälle: Authentifizierungsfehler, Name bereits vorhanden, Netzwerkfehler

## 6. Auffälligkeiten & Verbesserungsmöglichkeiten
- Drag & Drop-Logik ist komplex und könnte ausgelagert werden
- Lazy Loading funktioniert, aber Caching ist verbesserungswürdig
- UX: Feedback bei Fehlern (z.B. Name existiert bereits) noch nicht optimal

## 7. ToDos
- Drag & Drop in eigene Hook/Komponente auslagern
- Caching-Strategie für geladene Ordner verbessern
- Fehler-Feedback für Drag & Drop vereinheitlichen
- Testabdeckung für Tree-Interaktionen erhöhen 