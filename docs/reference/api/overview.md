---
title: API Übersicht
---

# API Übersicht

Dies ist eine manuell kuratierte Übersicht der wichtigsten API-Endpunkte. Für Details bitte die jeweiligen Unterseiten konsultieren.

## Storage API (Filesystem)

- GET `/api/storage/filesystem?action=list&fileId={fileId}&libraryId={libraryId}`
- GET `/api/storage/filesystem?action=get&fileId={fileId}&libraryId={libraryId}`
- GET `/api/storage/filesystem?action=binary&fileId={fileId}&libraryId={libraryId}`
- POST `/api/storage/filesystem?action=createFolder&fileId={parentId}&libraryId={libraryId}`
- POST `/api/storage/filesystem?action=upload&fileId={parentId}&libraryId={libraryId}`
- DELETE `/api/storage/filesystem?fileId={fileId}&libraryId={libraryId}`
- PATCH `/api/storage/filesystem?fileId={fileId}&newParentId={newParentId}&libraryId={libraryId}`

## Bibliotheken API

- GET `/api/libraries`


