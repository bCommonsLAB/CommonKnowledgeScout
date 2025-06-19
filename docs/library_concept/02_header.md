# Header Komponente

## 1. User Stories
- Als User möchte ich zwischen Bibliotheken wechseln können.
- Als User möchte ich auf Einstellungen zugreifen.
- Als User möchte ich den aktuellen Pfad (Breadcrumb) sehen.

## 2. Initialisierung
- Wird beim Laden der Library-Ansicht automatisch angezeigt.
- Liest initial den aktiven Bibliotheks-Status aus dem globalen State.

## 3. Features
- Bibliothekswechsel (LibrarySwitcher)
- Zugriff auf Einstellungen
- Anzeige des Breadcrumbs
- Upload-Button

## 4. Abhängigkeiten
- **Atoms:**
  - `activeLibraryIdAtom`
  - `librariesAtom`
  - `currentFolderIdAtom`
- **Contexts:**
  - StorageContext (Provider-Status)
- **Komponenten:**
  - LibrarySwitcher
  - UploadDialog
  - Breadcrumb

## 5. API Calls
- Keine direkten API-Calls im Header selbst.
- Indirekt: Trigger für Upload (UploadDialog ruft Provider.uploadFile auf)
- Indirekt: Bibliothekswechsel kann zu neuem Provider-Init führen

## 6. Auffälligkeiten & Verbesserungsmöglichkeiten
- Upload-Dialog ist eng mit Header gekoppelt (könnte ausgelagert werden)
- Breadcrumb-Logik teilweise im Header, teilweise in FileTree
- Settings-Button könnte klarer abgetrennt werden

## 7. ToDos
- Upload-Dialog als eigene Komponente auslagern
- Breadcrumb-Logik zentralisieren
- Settings-Button als eigenständige Komponente
- Testabdeckung für alle Interaktionen erhöhen 