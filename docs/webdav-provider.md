# WebDAV Provider für Nextcloud

Der WebDAV-Provider ermöglicht die Integration von Nextcloud-Instanzen in das Knowledge Scout System. Er implementiert das einheitliche StorageProvider-Interface und bietet vollständige CRUD-Operationen für Dateien und Ordner.

## Features

### ✅ Implementierte Funktionen

- **Authentifizierung**: Basic Auth mit Benutzername/Passwort
- **Datei-Operationen**: 
  - Auflisten von Verzeichnissen
  - Abrufen einzelner Dateien/Ordner
  - Hochladen von Dateien
  - Erstellen von Ordnern
  - Löschen von Dateien/Ordnern
  - Verschieben von Items
  - Umbenennen von Items
- **Metadaten**: 
  - Dateigröße
  - Änderungsdatum
  - MIME-Typ
  - Pfad-Informationen
- **Fehlerbehandlung**: Umfassende Fehlerbehandlung mit spezifischen Fehlercodes
- **Validierung**: Konfigurationsvalidierung vor Verwendung

### 🔄 WebDAV-spezifische Implementierungen

- **PROPFIND**: Auflisten von Verzeichnissen und Abrufen von Metadaten
- **MKCOL**: Erstellen von Ordnern
- **PUT**: Hochladen von Dateien
- **DELETE**: Löschen von Items
- **MOVE**: Verschieben und Umbenennen von Items
- **GET**: Abrufen von Binärdaten

## Konfiguration

### Admin-Panel Einstellungen

Im Storage-Einstellungsbereich können folgende Parameter konfiguriert werden:

```typescript
interface WebDAVConfig {
  url: string;        // WebDAV-URL (z.B. https://your-nextcloud.com/remote.php/dav/files/username/)
  username: string;   // Nextcloud-Benutzername
  password: string;   // Nextcloud-Passwort oder App-Passwort
  basePath?: string;  // Optionaler Basis-Pfad (Standard: /)
}
```

### URL-Format

Die WebDAV-URL sollte folgendem Format entsprechen:
```
https://your-nextcloud.com/remote.php/dav/files/username/
```

**Wichtige Hinweise:**
- Die URL muss mit einem Slash enden
- Verwenden Sie App-Passwörter für bessere Sicherheit
- Der `username` in der URL muss mit dem konfigurierten Benutzernamen übereinstimmen

## Integration in das System

### 1. Storage Factory Integration

Der WebDAV-Provider ist in die StorageFactory integriert:

```typescript
// In storage-factory.ts
case 'webdav':
  provider = new WebDAVProvider(library, this.apiBaseUrl || undefined);
  console.log(`StorageFactory: WebDAVProvider erstellt`);
  break;
```

### 2. TypeScript Typen

WebDAV ist als StorageProviderType verfügbar:

```typescript
export type StorageProviderType = 'local' | 'onedrive' | 'gdrive' | 'webdav';
```

### 3. Formular-Integration

Das Storage-Formular unterstützt WebDAV-Konfiguration:

- **WebDAV URL**: Eingabefeld für die Nextcloud-WebDAV-URL
- **Benutzername**: Nextcloud-Benutzername
- **Passwort**: Passwort oder App-Passwort
- **Basis-Pfad**: Optionaler Unterordner-Pfad

## API-Endpunkte

### GET /api/storage/webdav

**Parameter:**
- `action`: Operationstyp (`list`, `get`, `validate`)
- `libraryId`: Bibliotheks-ID
- `fileId`: Datei/Ordner-ID (für list/get)
- `url`: WebDAV-URL
- `username`: Benutzername
- `password`: Passwort
- `basePath`: Basis-Pfad

**Beispiele:**
```bash
# Verzeichnis auflisten
GET /api/storage/webdav?action=list&libraryId=test&fileId=root&url=https://nextcloud.com/remote.php/dav/files/user/&username=user&password=pass

# Konfiguration validieren
GET /api/storage/webdav?action=validate&libraryId=test&url=https://nextcloud.com/remote.php/dav/files/user/&username=user&password=pass
```

### POST /api/storage/webdav

**Parameter:**
- `action`: Operationstyp (`createFolder`, `upload`)
- `libraryId`: Bibliotheks-ID
- `fileId`: Parent-Ordner-ID

**Beispiele:**
```bash
# Ordner erstellen
POST /api/storage/webdav?action=createFolder&libraryId=test&fileId=root
Content-Type: application/json
{"name": "Neuer Ordner"}

# Datei hochladen
POST /api/storage/webdav?action=upload&libraryId=test&fileId=root
Content-Type: multipart/form-data
file: [Datei-Daten]
```

### DELETE /api/storage/webdav

**Parameter:**
- `libraryId`: Bibliotheks-ID
- `fileId`: Zu löschende Datei/Ordner-ID

## Sicherheitsaspekte

### Authentifizierung
- **Basic Auth**: Benutzername/Passwort werden Base64-kodiert übertragen
- **HTTPS**: Verwendung von HTTPS für alle WebDAV-Kommunikation
- **App-Passwörter**: Empfohlen für bessere Sicherheit

### Datenschutz
- **Passwort-Maskierung**: Passwörter werden im Admin-Panel maskiert angezeigt
- **Keine Logs**: Passwörter werden nicht in Logs gespeichert
- **Temporäre Tokens**: Keine persistenten Token-Speicherung

## Fehlerbehandlung

### Häufige Fehlercodes

```typescript
// WebDAV-spezifische Fehler
'WEBDAV_ERROR'           // Allgemeiner WebDAV-Fehler
'LIST_ERROR'             // Fehler beim Auflisten
'GET_ITEM_ERROR'         // Fehler beim Abrufen eines Items
'CREATE_FOLDER_ERROR'    // Fehler beim Erstellen eines Ordners
'DELETE_ERROR'           // Fehler beim Löschen
'MOVE_ERROR'             // Fehler beim Verschieben
'RENAME_ERROR'           // Fehler beim Umbenennen
'UPLOAD_ERROR'           // Fehler beim Hochladen
'GET_BINARY_ERROR'       // Fehler beim Abrufen von Binärdaten
'GET_PATH_ITEMS_ERROR'   // Fehler beim Abrufen von Pfad-Items
```

### Validierung

Der Provider validiert automatisch:
- Vorhandensein der WebDAV-URL
- Vorhandensein von Benutzername und Passwort
- Erreichbarkeit der Nextcloud-Instanz
- Korrekte Authentifizierung

## Performance-Optimierungen

### Caching
- **Pfad-ID-Mapping**: Stabile IDs basierend auf WebDAV-Pfaden
- **Bidirektionales Caching**: Pfad ↔ ID Mapping
- **Automatische Cache-Invalidierung**: Bei Änderungen

### Streaming
- **Direkte Downloads**: WebDAV-URLs für Streaming
- **Chunk-basierte Uploads**: Für große Dateien
- **Progress-Tracking**: Upload-Fortschritt

## Testing

### Automatische Tests
Der Storage-Formular-Test führt automatisch folgende Tests durch:

1. **Konfigurationsvalidierung**: Prüft WebDAV-Verbindung
2. **Root-Verzeichnis**: Listet Root-Verzeichnis auf
3. **Ordner-Erstellung**: Erstellt Test-Ordner
4. **Datei-Upload**: Lädt Test-Datei hoch
5. **Verzeichnis-Auflistung**: Listet Ordner-Inhalt auf
6. **Datei-Abruf**: Ruft hochgeladene Datei ab
7. **Binärdaten**: Testet Binärdaten-Abruf
8. **Pfad-Abruf**: Testet Pfad-Funktionen
9. **Aufräumen**: Löscht Test-Ordner

### Manuelle Tests
```bash
# Verbindung testen
curl -X GET "https://your-nextcloud.com/remote.php/dav/files/username/" \
  -u "username:password" \
  -H "Depth: 1"

# Ordner erstellen
curl -X MKCOL "https://your-nextcloud.com/remote.php/dav/files/username/test-folder/" \
  -u "username:password"

# Datei hochladen
curl -X PUT "https://your-nextcloud.com/remote.php/dav/files/username/test.txt" \
  -u "username:password" \
  -d "Test content"
```

## Troubleshooting

### Häufige Probleme

1. **401 Unauthorized**
   - Prüfen Sie Benutzername und Passwort
   - Verwenden Sie App-Passwörter statt regulärer Passwörter

2. **404 Not Found**
   - Prüfen Sie die WebDAV-URL
   - Stellen Sie sicher, dass der Pfad existiert

3. **403 Forbidden**
   - Prüfen Sie die Berechtigungen in Nextcloud
   - Stellen Sie sicher, dass der Benutzer Schreibrechte hat

4. **500 Internal Server Error**
   - Prüfen Sie die Nextcloud-Logs
   - Stellen Sie sicher, dass WebDAV aktiviert ist

### Debugging

```typescript
// Debug-Logging aktivieren
console.log('[WebDAVProvider] Request:', {
  method,
  url: `${this.config.url}${path}`,
  headers: requestHeaders
});
```

## Zukünftige Erweiterungen

### Geplante Features
- **OAuth 2.0**: Unterstützung für OAuth-basierte Authentifizierung
- **Token-Refresh**: Automatische Token-Erneuerung
- **Batch-Operationen**: Mehrere Operationen in einer Anfrage
- **Delta-Sync**: Nur geänderte Dateien synchronisieren
- **WebSocket**: Echtzeit-Updates für Dateiänderungen

### Performance-Verbesserungen
- **Connection Pooling**: Wiederverwendung von HTTP-Verbindungen
- **Request Batching**: Mehrere Anfragen zusammenfassen
- **Lazy Loading**: Verzögertes Laden von Ordner-Inhalten
- **Background Sync**: Hintergrund-Synchronisation

## Beispiele

### Bibliothek erstellen
```typescript
const webdavLibrary: ClientLibrary = {
  id: 'nextcloud-library',
  label: 'Meine Nextcloud',
  type: 'webdav',
  path: '/',
  isEnabled: true,
  config: {
    url: 'https://my-nextcloud.com/remote.php/dav/files/username/',
    username: 'username',
    password: 'app-password',
    basePath: '/Documents'
  }
};
```

### Provider verwenden
```typescript
const factory = StorageFactory.getInstance();
const provider = await factory.getProvider('nextcloud-library');

// Verzeichnis auflisten
const items = await provider.listItemsById('root');

// Datei hochladen
const file = new File(['content'], 'test.txt', { type: 'text/plain' });
const uploadedFile = await provider.uploadFile('root', file);
``` 