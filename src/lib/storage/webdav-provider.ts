import { StorageProvider, StorageItem, StorageValidationResult, StorageError, StorageItemMetadata } from './types';
import { ClientLibrary } from '@/types/library';

interface WebDAVConfig {
  url: string;
  username: string;
  password: string;
  basePath?: string;
}

interface WebDAVItem {
  href: string;
  lastmodified?: string;
  getcontentlength?: string;
  getcontenttype?: string;
  resourcetype?: {
    collection?: boolean;
  };
}

interface WebDAVResponse {
  multistatus: {
    response: WebDAVItem[];
  };
}

/**
 * WebDAV Provider für Nextcloud
 * Implementiert die StorageProvider-Schnittstelle für WebDAV-Verbindungen
 */
export class WebDAVProvider implements StorageProvider {
  private library: ClientLibrary;
  private config: WebDAVConfig;
  private baseUrl: string;
  private authenticated: boolean = false;

  constructor(library: ClientLibrary, baseUrl?: string) {
    this.library = library;
    this.baseUrl = baseUrl || '';
    
    // Konfiguration aus der Library extrahieren
    this.config = {
      url: library.config?.url || '',
      username: library.config?.username || '',
      password: library.config?.password || '',
      basePath: library.config?.basePath || '/'
    };
    
    // Debug-Informationen
    console.log('[WebDAVProvider] Konstruktor aufgerufen:', {
      libraryId: library.id,
      libraryType: library.type,
      config: {
        url: this.config.url ? 'vorhanden' : 'fehlt',
        username: this.config.username ? 'vorhanden' : 'fehlt',
        password: this.config.password ? 'vorhanden' : 'fehlt',
        basePath: this.config.basePath || ''
      },
      libraryConfig: library.config
    });
  }

  get name() {
    return 'Nextcloud WebDAV';
  }

  get id() {
    return this.library.id;
  }

  /**
   * Prüft, ob der Provider authentifiziert ist.
   * Für WebDAV prüfen wir, ob die Anmeldedaten vorhanden sind.
   * @returns true wenn Anmeldedaten vorhanden sind
   */
  isAuthenticated(): boolean {
    return !!(this.config.username && this.config.password);
  }



  /**
   * Erstellt eine absolute oder relative API-URL je nach Kontext
   */
  private getApiUrl(path: string): string {
    // Wenn baseUrl leer ist, verwende die absolute URL
    if (!this.baseUrl) {
      return path;
    }
    return `${this.baseUrl}${path}`;
  }

  /**
   * Führt eine WebDAV-Anfrage über die direkte API aus
   */
  private async makeWebDAVRequest(
    method: string,
    path: string,
    body?: string,
    headers?: Record<string, string>
  ): Promise<Response> {
    // Verwende die direkte WebDAV-API-Route
    const apiUrl = this.getApiUrl('/api/storage/webdav-direct');
    const params = new URLSearchParams({
      url: String(this.config.url),
      username: String(this.config.username),
      password: String(this.config.password),
      path: path,
      method: method
    });
    
    console.log('[WebDAVProvider] makeWebDAVRequest über direkte API:', {
      method,
      apiUrl,
      path,
      hasBody: !!body,
      hasAuth: !!this.config.username && !!this.config.password
    });

    // Für PROPFIND müssen wir den XML-Body an die Proxy-API senden
    if (method === 'PROPFIND') {
      // Sende PROPFIND als POST mit XML-Body an die Proxy-API
      const propfindBody = '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:allprop/></d:propfind>';
      
      console.log('[WebDAVProvider] Sende PROPFIND als POST mit XML-Body:', {
        propfindBody,
        bodyLength: propfindBody.length
      });

      const response = await fetch(`${apiUrl}?${params.toString()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml'
        },
        body: propfindBody
      });
      
      console.log('[WebDAVProvider] Response erhalten:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        throw new StorageError(
          `WebDAV request failed: ${response.status} ${response.statusText}`,
          'WEBDAV_ERROR',
          this.id
        );
      }

      return response;
    }

    // Für andere Methoden (GET, POST, DELETE)
    const response = await fetch(`${apiUrl}?${params.toString()}`, {
      method: method === 'MKCOL' || method === 'PUT' ? 'POST' : 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: body
    });
    
    console.log('[WebDAVProvider] Response erhalten:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      throw new StorageError(
        `WebDAV request failed: ${response.status} ${response.statusText}`,
        'WEBDAV_ERROR',
        this.id
      );
    }

    return response;
  }

  /**
   * Konvertiert einen WebDAV-Pfad in eine stabile ID
   */
  private pathToId(path: string): string {
    // Verwende den vollständigen Base64-String ohne Kürzung für korrekte Dekodierung
    const id = btoa(path).replace(/[+/=]/g, (match) => {
      switch (match) {
        case '+': return '-';
        case '/': return '_';
        case '=': return '';
        default: return match;
      }
    });
    console.log('[WebDAVProvider] pathToId:', { path, id });
    return id;
  }

  /**
   * Konvertiert eine ID zurück in einen Pfad
   */
  private idToPath(id: string): string {
    // Korrigiere die URL-safe Base64-Dekodierung
    const restored = id.replace(/-/g, '+').replace(/_/g, '/');
    // Füge fehlende Padding-Zeichen hinzu
    const padded = restored + '='.repeat((4 - restored.length % 4) % 4);
    const path = atob(padded);
    console.log('[WebDAVProvider] idToPath:', { id, restored, padded, path });
    return path;
  }

  /**
   * Konvertiert ein WebDAV-Item in ein StorageItem
   */
  private webdavItemToStorageItem(item: WebDAVItem): StorageItem {
    const path = decodeURIComponent(item.href);
    const isCollection = item.resourcetype?.collection !== undefined;
    const name = path.split('/').pop() || '';
    
    const metadata: StorageItemMetadata = {
      name,
      size: parseInt(item.getcontentlength || '0'),
      modifiedAt: item.lastmodified ? new Date(item.lastmodified) : new Date(),
      mimeType: isCollection ? 'application/folder' : (item.getcontenttype || 'application/octet-stream')
    };

    return {
      id: this.pathToId(path),
      parentId: this.pathToId(path.substring(0, path.lastIndexOf('/')) || '/'),
      type: isCollection ? 'folder' : 'file',
      metadata
    };
  }

  /**
   * Validiert die WebDAV-Konfiguration
   */
  async validateConfiguration(): Promise<StorageValidationResult> {
    console.log('[WebDAVProvider] validateConfiguration aufgerufen:', {
      config: {
        url: this.config.url ? 'vorhanden' : 'fehlt',
        username: this.config.username ? 'vorhanden' : 'fehlt',
        password: this.config.password ? 'vorhanden' : 'fehlt',
        basePath: this.config.basePath
      }
    });
    
    try {
      if (!this.config.url) {
        console.log('[WebDAVProvider] Validierung fehlgeschlagen: URL fehlt');
        return {
          isValid: false,
          error: 'WebDAV URL ist erforderlich'
        };
      }

      if (!this.config.username || !this.config.password) {
        console.log('[WebDAVProvider] Validierung fehlgeschlagen: Anmeldedaten fehlen');
        return {
          isValid: false,
          error: 'Benutzername und Passwort sind erforderlich'
        };
      }

      console.log('[WebDAVProvider] Teste WebDAV-Verbindung...');
      // Teste die Verbindung durch einen PROPFIND-Request auf das konfigurierte Verzeichnis
      const testPath = this.config.basePath || '';
      console.log('[WebDAVProvider] Verwende BasePath für Test:', testPath);
      const response = await this.makeWebDAVRequest('PROPFIND', testPath);
      
      if (response.status === 200 || response.status === 207) {
        console.log('[WebDAVProvider] Validierung erfolgreich');
        return {
          isValid: true
        };
      } else {
        console.log('[WebDAVProvider] Validierung fehlgeschlagen:', response.status, response.statusText);
        return {
          isValid: false,
          error: `WebDAV-Verbindung fehlgeschlagen: ${response.status} ${response.statusText}`
        };
      }
    } catch (error) {
      console.error('[WebDAVProvider] Validierung fehlgeschlagen mit Exception:', error);
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Unbekannter Fehler bei der WebDAV-Validierung'
      };
    }
  }

  /**
   * Listet Items in einem Verzeichnis auf
   */
  async listItemsById(folderId: string): Promise<StorageItem[]> {
    try {
      const path = folderId === 'root' ? this.config.basePath || '/' : this.idToPath(folderId);
      
      const response = await this.makeWebDAVRequest('PROPFIND', path);
      const text = await response.text();
      
      // Parse XML-Response (vereinfacht)
      const items = this.parseWebDAVResponse(text);
      
      // Filtere das Root-Verzeichnis selbst heraus und konvertiere zu StorageItems
      return items
        .filter(item => item.href !== path)
        .map(item => this.webdavItemToStorageItem(item));
    } catch (error) {
      throw new StorageError(
        `Fehler beim Auflisten der Items: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
        'LIST_ERROR',
        this.id
      );
    }
  }

  /**
   * Ruft ein einzelnes Item ab
   */
  async getItemById(itemId: string): Promise<StorageItem> {
    try {
      const path = this.idToPath(itemId);
      const response = await this.makeWebDAVRequest('PROPFIND', path);
      const text = await response.text();
      
      const items = this.parseWebDAVResponse(text);
      if (items.length === 0) {
        throw new StorageError('Item nicht gefunden', 'ITEM_NOT_FOUND', this.id);
      }
      
      return this.webdavItemToStorageItem(items[0]);
    } catch (error) {
      throw new StorageError(
        `Fehler beim Abrufen des Items: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
        'GET_ITEM_ERROR',
        this.id
      );
    }
  }

  /**
   * Erstellt ein neues Verzeichnis
   */
  async createFolder(parentId: string, name: string): Promise<StorageItem> {
    try {
      const parentPath = parentId === 'root' ? this.config.basePath || '/' : this.idToPath(parentId);
      const newFolderPath = `${parentPath}${parentPath.endsWith('/') ? '' : '/'}${name}/`;
      
      // MKCOL Request für Verzeichniserstellung
      await this.makeWebDAVRequest('MKCOL', newFolderPath);
      
      // Erstelle ein StorageItem für das neue Verzeichnis
      const metadata: StorageItemMetadata = {
        name,
        size: 0,
        modifiedAt: new Date(),
        mimeType: 'application/folder'
      };

      return {
        id: this.pathToId(newFolderPath),
        parentId: this.pathToId(parentPath),
        type: 'folder',
        metadata
      };
    } catch (error) {
      throw new StorageError(
        `Fehler beim Erstellen des Verzeichnisses: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
        'CREATE_FOLDER_ERROR',
        this.id
      );
    }
  }

  /**
   * Löscht ein Item
   */
  async deleteItem(itemId: string): Promise<void> {
    try {
      const path = this.idToPath(itemId);
      await this.makeWebDAVRequest('DELETE', path);
    } catch (error) {
      throw new StorageError(
        `Fehler beim Löschen des Items: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
        'DELETE_ERROR',
        this.id
      );
    }
  }

  /**
   * Verschiebt ein Item
   */
  async moveItem(itemId: string, newParentId: string): Promise<void> {
    try {
      const sourcePath = this.idToPath(itemId);
      const targetParentPath = newParentId === 'root' ? this.config.basePath || '/' : this.idToPath(newParentId);
      const itemName = sourcePath.split('/').pop() || '';
      const targetPath = `${targetParentPath}${targetParentPath.endsWith('/') ? '' : '/'}${itemName}`;
      
      await this.makeWebDAVRequest('MOVE', sourcePath, undefined, {
        'Destination': targetPath
      });
    } catch (error) {
      throw new StorageError(
        `Fehler beim Verschieben des Items: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
        'MOVE_ERROR',
        this.id
      );
    }
  }

  /**
   * Benennt ein Item um
   */
  async renameItem(itemId: string, newName: string): Promise<StorageItem> {
    try {
      const oldPath = this.idToPath(itemId);
      const parentPath = oldPath.substring(0, oldPath.lastIndexOf('/')) || '/';
      const newPath = `${parentPath}${parentPath.endsWith('/') ? '' : '/'}${newName}`;
      
      await this.makeWebDAVRequest('MOVE', oldPath, undefined, {
        'Destination': newPath
      });
      
      // Erstelle ein aktualisiertes StorageItem
      const metadata: StorageItemMetadata = {
        name: newName,
        size: 0, // Wird beim nächsten Abruf aktualisiert
        modifiedAt: new Date(),
        mimeType: 'application/octet-stream' // Wird beim nächsten Abruf aktualisiert
      };

      return {
        id: this.pathToId(newPath),
        parentId: this.pathToId(parentPath),
        type: 'file', // Wird beim nächsten Abruf korrekt gesetzt
        metadata
      };
    } catch (error) {
      throw new StorageError(
        `Fehler beim Umbenennen des Items: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
        'RENAME_ERROR',
        this.id
      );
    }
  }

  /**
   * Lädt eine Datei hoch
   */
  async uploadFile(parentId: string, file: File): Promise<StorageItem> {
    try {
      const parentPath = parentId === 'root' ? this.config.basePath || '/' : this.idToPath(parentId);
      const filePath = `${parentPath}${parentPath.endsWith('/') ? '' : '/'}${file.name}`;
      
      console.log('[WebDAVProvider] Upload-Pfad-Debug:', {
        parentId,
        parentPath,
        filePath,
        fileName: file.name,
        fileSize: file.size,
        basePath: this.config.basePath
      });
      
      // Verwende die direkte API-Route für Upload
      const apiUrl = this.getApiUrl('/api/storage/webdav-direct');
      const params = new URLSearchParams({
        url: this.config.url,
        username: this.config.username,
        password: this.config.password,
        path: filePath,
        method: 'PUT'
      });

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${apiUrl}?${params.toString()}`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
      }

      // Erstelle ein StorageItem für die hochgeladene Datei
      const metadata: StorageItemMetadata = {
        name: file.name,
        size: file.size,
        modifiedAt: new Date(),
        mimeType: file.type || 'application/octet-stream'
      };

      return {
        id: this.pathToId(filePath),
        parentId: this.pathToId(parentPath),
        type: 'file',
        metadata
      };
    } catch (error) {
      throw new StorageError(
        `Fehler beim Hochladen der Datei: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
        'UPLOAD_ERROR',
        this.id
      );
    }
  }

  /**
   * Ruft Binärdaten einer Datei ab
   */
  async getBinary(fileId: string): Promise<{ blob: Blob; mimeType: string; }> {
    try {
      const path = this.idToPath(fileId);
      
      // Verwende die direkte API-Route für Download
      const apiUrl = this.getApiUrl('/api/storage/webdav-direct');
      const params = new URLSearchParams({
        url: this.config.url,
        username: this.config.username,
        password: this.config.password,
        path: path,
        method: 'GET'
      });

      const response = await fetch(`${apiUrl}?${params.toString()}`, {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      return {
        blob,
        mimeType: response.headers.get('content-type') || 'application/octet-stream'
      };
    } catch (error) {
      throw new StorageError(
        `Fehler beim Abrufen der Binärdaten: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
        'GET_BINARY_ERROR',
        this.id
      );
    }
  }

  /**
   * Ruft den Pfad eines Items ab
   */
  async getPathById(itemId: string): Promise<string> {
    return this.idToPath(itemId);
  }

  /**
   * Ruft die Download-URL eines Items ab
   */
  async getDownloadUrl(itemId: string): Promise<string> {
    const path = this.idToPath(itemId);
    return `${this.config.url}${path}`;
  }

  /**
   * Ruft die Streaming-URL eines Items ab
   */
  async getStreamingUrl(itemId: string): Promise<string> {
    // Für WebDAV ist die Streaming-URL identisch mit der Download-URL
    return this.getDownloadUrl(itemId);
  }

  /**
   * Ruft alle Pfad-Items von root bis zum angegebenen Item ab
   */
  async getPathItemsById(itemId: string): Promise<StorageItem[]> {
    try {
      const targetPath = this.idToPath(itemId);
      const pathParts = targetPath.split('/').filter(part => part.length > 0);
      const pathItems: StorageItem[] = [];
      
      let currentPath = this.config.basePath || '/';
      
      for (const part of pathParts) {
        currentPath = `${currentPath}${currentPath.endsWith('/') ? '' : '/'}${part}`;
        
        const response = await this.makeWebDAVRequest('PROPFIND', currentPath);
        const text = await response.text();
        const items = this.parseWebDAVResponse(text);
        
        if (items.length > 0) {
          const item = this.webdavItemToStorageItem(items[0]);
          if (item.type === 'folder') {
            pathItems.push(item);
          }
        }
      }
      
      return pathItems;
    } catch (error) {
      throw new StorageError(
        `Fehler beim Abrufen der Pfad-Items: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
        'GET_PATH_ITEMS_ERROR',
        this.id
      );
    }
  }

  /**
   * Parst eine WebDAV XML-Response (vereinfacht)
   */
  private parseWebDAVResponse(xmlText: string): WebDAVItem[] {
    // Vereinfachte XML-Parsing für WebDAV-Responses
    // In einer echten Implementierung würde man eine XML-Parser-Bibliothek verwenden
    const items: WebDAVItem[] = [];
    
    // Einfache Regex-basierte Extraktion (für Demo-Zwecke)
    const hrefMatches = xmlText.match(/<d:href>([^<]+)<\/d:href>/g);
    const lastModifiedMatches = xmlText.match(/<d:getlastmodified>([^<]+)<\/d:getlastmodified>/g);
    const contentLengthMatches = xmlText.match(/<d:getcontentlength>([^<]+)<\/d:getcontentlength>/g);
    const contentTypeMatches = xmlText.match(/<d:getcontenttype>([^<]+)<\/d:getcontenttype>/g);
    const resourceTypeMatches = xmlText.match(/<d:resourcetype>([^<]+)<\/d:resourcetype>/g);
    
    if (hrefMatches) {
      for (let i = 0; i < hrefMatches.length; i++) {
        const href = hrefMatches[i].replace(/<d:href>([^<]+)<\/d:href>/, '$1');
        const lastModified = lastModifiedMatches?.[i]?.replace(/<d:getlastmodified>([^<]+)<\/d:getlastmodified>/, '$1');
        const contentLength = contentLengthMatches?.[i]?.replace(/<d:getcontentlength>([^<]+)<\/d:getcontentlength>/, '$1');
        const contentType = contentTypeMatches?.[i]?.replace(/<d:getcontenttype>([^<]+)<\/d:getcontenttype>/, '$1');
        const resourceType = resourceTypeMatches?.[i]?.replace(/<d:resourcetype>([^<]+)<\/d:resourcetype>/, '$1');
        
        items.push({
          href,
          lastmodified: lastModified,
          getcontentlength: contentLength,
          getcontenttype: contentType,
          resourcetype: resourceType?.includes('<d:collection/>') ? { collection: true } : undefined
        });
      }
    }
    
    return items;
  }
} 