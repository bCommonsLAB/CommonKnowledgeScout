import { StorageProvider, StorageItem, StorageValidationResult, StorageError, StorageItemMetadata } from './types';
import { ClientLibrary } from '@/types/library';
import { WebDAVProviderLogger } from './storage-logger';

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
      url: (library.config?.url as string) || '',
      username: (library.config?.username as string) || '',
      password: (library.config?.password as string) || '',
      basePath: (library.config?.basePath as string) || '/'
    };
    
    // Debug-Informationen - detailliert für Konfigurationsprobleme
    WebDAVProviderLogger.info('Konstruktor aufgerufen', {
      libraryId: library.id,
      libraryType: library.type,
      config: {
        url: this.config.url ? 'vorhanden' : 'fehlt',
        username: this.config.username ? 'vorhanden' : 'fehlt',
        password: this.config.password ? 'vorhanden' : 'fehlt',
        basePath: this.config.basePath || ''
      },
      // Debug: Zeige rohe Library-Konfiguration
      rawLibraryConfig: JSON.stringify(library.config, null, 2),
      extractedConfig: {
        url: library.config?.url,
        username: library.config?.username,
        password: library.config?.password ? '***masked***' : undefined,
        basePath: library.config?.basePath
      }
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
    body?: string
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
    
    WebDAVProviderLogger.debug('makeWebDAVRequest über direkte API', {
      method,
      apiUrl,
      path,
      hasBody: !!body,
      hasAuth: !!this.config.username && !!this.config.password,
      // DEBUG: Zeige die tatsächlich verwendeten Credentials
      actualCredentials: {
        url: this.config.url,
        username: this.config.username,
        password: this.config.password ? `${this.config.password.substring(0, 5)}***${this.config.password.substring(this.config.password.length - 5)}` : 'fehlt'
      }
    });

    // Für PROPFIND müssen wir den XML-Body an die Proxy-API senden
    if (method === 'PROPFIND') {
      // Sende PROPFIND als POST mit XML-Body an die Proxy-API
      const propfindBody = '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:allprop/></d:propfind>';
      
      WebDAVProviderLogger.debug('Sende PROPFIND als POST mit XML-Body', {
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
      
      WebDAVProviderLogger.debug('Response erhalten', {
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

    // Für andere Methoden (MKCOL, PUT, DELETE)
    const response = await fetch(`${apiUrl}?${params.toString()}`, {
      method: 'POST', // Alle anderen Methoden werden als POST an die API gesendet
      headers: body ? {
        'Content-Type': 'application/json'
      } : {},
      body: body
    });
    
    WebDAVProviderLogger.debug('Response erhalten', {
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
    WebDAVProviderLogger.info('validateConfiguration aufgerufen', {
      config: {
        url: this.config.url ? 'vorhanden' : 'fehlt',
        username: this.config.username ? 'vorhanden' : 'fehlt',
        password: this.config.password ? 'vorhanden' : 'fehlt',
        basePath: this.config.basePath
      }
    });
    
    try {
      if (!this.config.url) {
        WebDAVProviderLogger.warn('Validierung fehlgeschlagen: URL fehlt');
        return {
          isValid: false,
          error: 'WebDAV URL ist erforderlich'
        };
      }

      if (!this.config.username || !this.config.password) {
        WebDAVProviderLogger.warn('Validierung fehlgeschlagen: Anmeldedaten fehlen');
        return {
          isValid: false,
          error: 'Benutzername und Passwort sind erforderlich'
        };
      }

      WebDAVProviderLogger.info('Teste WebDAV-Verbindung');
      // Teste die Verbindung durch einen PROPFIND-Request auf das konfigurierte Verzeichnis
      const testPath = this.config.basePath || '';
      WebDAVProviderLogger.debug('Verwende BasePath für Test', { testPath });
      const response = await this.makeWebDAVRequest('PROPFIND', testPath);
      
      if (response.status === 200 || response.status === 207) {
        WebDAVProviderLogger.info('Validierung erfolgreich');
        return {
          isValid: true
        };
      } else {
        WebDAVProviderLogger.error('Validierung fehlgeschlagen', { status: response.status, statusText: response.statusText });
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
      
      await this.makeWebDAVRequest('MOVE', sourcePath);
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
      
      await this.makeWebDAVRequest('MOVE', oldPath);
      
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
      
      WebDAVProviderLogger.debug('Upload-Pfad-Debug', {
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
   * Parst eine WebDAV XML-Response (robust für verschiedene Server)
   */
  private parseWebDAVResponse(xmlText: string): WebDAVItem[] {
    WebDAVProviderLogger.debug('Parsing WebDAV XML Response', { xmlLength: xmlText.length });
    
    const items: WebDAVItem[] = [];
    
    // Debug: Log rohe XML-Response für FileTree-Debugging
    if (xmlText.length < 2000) {
      WebDAVProviderLogger.debug('WebDAV XML Response (komplett)', { xmlText });
    } else {
      WebDAVProviderLogger.debug('WebDAV XML Response (gekürzt)', { 
        xmlStart: xmlText.substring(0, 500),
        xmlEnd: xmlText.substring(xmlText.length - 500)
      });
    }
    
    // Robuste Regex mit case-insensitive und flexiblen Namespaces
    const hrefMatches = xmlText.match(/<[^:]*:?href[^>]*>([^<]+)<\/[^:]*:?href>/gi);
    const lastModifiedMatches = xmlText.match(/<[^:]*:?getlastmodified[^>]*>([^<]+)<\/[^:]*:?getlastmodified>/gi);
    const contentLengthMatches = xmlText.match(/<[^:]*:?getcontentlength[^>]*>([^<]+)<\/[^:]*:?getcontentlength>/gi);
    const contentTypeMatches = xmlText.match(/<[^:]*:?getcontenttype[^>]*>([^<]+)<\/[^:]*:?getcontenttype>/gi);
    const resourceTypeMatches = xmlText.match(/<[^:]*:?resourcetype[^>]*>(.*?)<\/[^:]*:?resourcetype>/gis);
    
    WebDAVProviderLogger.debug('XML Parsing Results', {
      hrefCount: hrefMatches?.length || 0,
      lastModifiedCount: lastModifiedMatches?.length || 0,
      contentLengthCount: contentLengthMatches?.length || 0,
      contentTypeCount: contentTypeMatches?.length || 0,
      resourceTypeCount: resourceTypeMatches?.length || 0
    });
    
    if (hrefMatches) {
      for (let i = 0; i < hrefMatches.length; i++) {
        const href = hrefMatches[i].replace(/<[^:]*:?href[^>]*>([^<]+)<\/[^:]*:?href>/i, '$1');
        const lastModified = lastModifiedMatches?.[i]?.replace(/<[^:]*:?getlastmodified[^>]*>([^<]+)<\/[^:]*:?getlastmodified>/i, '$1');
        const contentLength = contentLengthMatches?.[i]?.replace(/<[^:]*:?getcontentlength[^>]*>([^<]+)<\/[^:]*:?getcontentlength>/i, '$1');
        const contentType = contentTypeMatches?.[i]?.replace(/<[^:]*:?getcontenttype[^>]*>([^<]+)<\/[^:]*:?getcontenttype>/i, '$1');
        const resourceTypeRaw = resourceTypeMatches?.[i]?.replace(/<[^:]*:?resourcetype[^>]*>(.*?)<\/[^:]*:?resourcetype>/is, '$1');
        
        // Verbesserte Collection-Detection - mehrere Varianten prüfen
        const isCollection = resourceTypeRaw ? (
          resourceTypeRaw.includes('<d:collection') ||
          resourceTypeRaw.includes('<D:collection') ||
          resourceTypeRaw.includes('<collection') ||
          resourceTypeRaw.includes('collection/') ||
          href.endsWith('/')
        ) : href.endsWith('/');
        
        const item: WebDAVItem = {
          href,
          lastmodified: lastModified,
          getcontentlength: contentLength,
          getcontenttype: contentType,
          resourcetype: isCollection ? { collection: true } : undefined
        };
        
        WebDAVProviderLogger.debug('Parsed WebDAV Item', {
          href,
          isCollection,
          resourceTypeRaw: resourceTypeRaw?.substring(0, 100),
          contentType,
          contentLength
        });
        
        items.push(item);
      }
    }
    
    // Detaillierte Ordner-Analyse für FileTree-Debugging
    const folders = items.filter(item => item.resourcetype?.collection);
    const files = items.filter(item => !item.resourcetype?.collection);
    
    WebDAVProviderLogger.info('WebDAV XML Response parsed', {
      totalItems: items.length,
      folders: folders.length,
      files: files.length
    });
    
    // Debug: Zeige alle gefundenen Ordner für FileTree-Debugging
    WebDAVProviderLogger.debug('WebDAV Ordner-Details für FileTree', {
      folderCount: folders.length,
      folderPaths: folders.map(f => f.href).slice(0, 10), // Erste 10 Ordner
      allFolders: folders.map(f => ({ 
        href: f.href, 
        name: this.extractNameFromPath(f.href), 
        isCollection: !!f.resourcetype?.collection 
      }))
    });
    
    return items;
  }
} 