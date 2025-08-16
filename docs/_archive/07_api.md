# API Dokumentation

## Storage API

### Dateien auflisten

```http
GET /api/storage/filesystem?action=list&fileId={fileId}&libraryId={libraryId}
```

**Parameter:**
- `fileId` (optional): ID des Ordners (default: 'root')
- `libraryId` (optional): ID der Bibliothek (default: 'local')

**Response:**
```typescript
interface StorageItem[] {
  id: string;
  parentId: string;
  type: 'file' | 'folder';
  metadata: {
    name: string;
    size: number;
    modifiedAt: Date;
    mimeType: string;
  };
}
```

**Beispiel:**
```json
[
  {
    "id": "ZG9jcw==",
    "parentId": "root",
    "type": "folder",
    "metadata": {
      "name": "docs",
      "size": 0,
      "modifiedAt": "2024-01-16T10:30:00.000Z",
      "mimeType": "folder"
    }
  }
]
```

### Datei-Details abrufen

```http
GET /api/storage/filesystem?action=get&fileId={fileId}&libraryId={libraryId}
```

**Parameter:**
- `fileId`: ID der Datei
- `libraryId` (optional): ID der Bibliothek (default: 'local')

**Response:** `StorageItem`

### Binärdaten abrufen

```http
GET /api/storage/filesystem?action=binary&fileId={fileId}&libraryId={libraryId}
```

**Parameter:**
- `fileId`: ID der Datei
- `libraryId` (optional): ID der Bibliothek (default: 'local')

**Response:** Binary data mit entsprechendem Content-Type

### Ordner erstellen

```http
POST /api/storage/filesystem?action=createFolder&fileId={parentId}&libraryId={libraryId}
```

**Parameter:**
- `parentId`: ID des Zielordners
- `libraryId` (optional): ID der Bibliothek (default: 'local')

**Body:**
```json
{
  "name": "Neuer Ordner"
}
```

**Response:** `StorageItem` des neuen Ordners

### Datei hochladen

```http
POST /api/storage/filesystem?action=upload&fileId={parentId}&libraryId={libraryId}
```

**Parameter:**
- `parentId`: ID des Zielordners
- `libraryId` (optional): ID der Bibliothek (default: 'local')

**Body:** FormData mit 'file' field

**Response:** `StorageItem` der hochgeladenen Datei

### Datei/Ordner löschen

```http
DELETE /api/storage/filesystem?fileId={fileId}&libraryId={libraryId}
```

**Parameter:**
- `fileId`: ID der Datei/des Ordners
- `libraryId` (optional): ID der Bibliothek (default: 'local')

**Response:**
```json
{
  "success": true
}
```

### Datei/Ordner verschieben

```http
PATCH /api/storage/filesystem?fileId={fileId}&newParentId={newParentId}&libraryId={libraryId}
```

**Parameter:**
- `fileId`: ID der Datei/des Ordners
- `newParentId`: ID des neuen Zielordners
- `libraryId` (optional): ID der Bibliothek (default: 'local')

**Response:**
```json
{
  "success": true
}
```

## Bibliotheks-API

### Bibliotheken abrufen

```http
GET /api/libraries
```

**Response:**
```typescript
interface ClientLibrary[] {
  id: string;
  label: string;
  type: string;
  isEnabled: boolean;
  path: string;
  config: {
    transcription?: string;
    [key: string]: unknown;
  };
}
```

**Beispiel:**
```json
[
  {
    "id": "local",
    "label": "Lokale Bibliothek",
    "type": "local",
    "isEnabled": true,
    "path": "/storage",
    "config": {
      "transcription": "shadowTwin"
    }
  }
]
```

## Fehlerbehandlung

Alle API-Endpunkte verwenden folgende HTTP-Statuscodes:

- `200`: Erfolgreiche Operation
- `400`: Ungültige Anfrage
- `404`: Ressource nicht gefunden
- `500`: Server-Fehler

Fehlerantworten haben folgendes Format:
```json
{
  "error": "Fehlerbeschreibung"
}
```
