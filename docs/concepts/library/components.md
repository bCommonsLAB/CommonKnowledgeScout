---
title: Library Komponenten
---

# Library Komponenten

Überblick über State-Management, Initialisierung und zentrale Komponenten der Library-Ansicht (FileTree, FileList, FilePreview, MarkdownPreview, MarkdownMetadata).

## State und Initialisierung (Kurzüberblick)
- Jotai-Atome: `currentFolderIdAtom`, `breadcrumbItemsAtom`, `fileTreeReadyAtom`, `activeLibraryIdAtom`
- Reihenfolge: Library mount → FileTree init → FileList render

## Komponenten-Interaktion (Mermaid)

```mermaid
graph TD
    A[Library] -->|provides| B[StorageProvider]
    A -->|manages| C[currentFolderId]
    A -->|renders| D[FileTree]
    A -->|renders| E[FileList]
    A -->|renders| F[LibraryHeader]
    D -->|updates| C
    D -->|updates| G[breadcrumbItems]
    D -->|sets| H[fileTreeReady]
    E -->|reads| C
    E -->|waits for| H
    E -->|loads items via| B
    F -->|reads| G
    F -->|reads| C
```

## Performance-Notizen
- Lazy Loading, Caching, Memoization
- Virtualisierte Listen für große Ordner


