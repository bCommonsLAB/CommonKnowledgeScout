/**
 * @fileoverview Storage Factory - Creates and manages storage provider instances
 * 
 * @description
 * The StorageFactory is responsible for creating and caching storage provider
 * instances based on library configuration. It supports multiple storage backends
 * (local filesystem, OneDrive) and provides a unified interface for file operations.
 * Uses singleton pattern to maintain a single factory instance across the application.
 * 
 * @module storage
 * 
 * @exports
 * - StorageFactory: Main factory class for creating storage providers
 * - LocalStorageProvider: Local filesystem provider implementation
 * 
 * @usedIn
 * - src/contexts/storage-context.tsx: Creates providers for React context
 * - src/app/api/storage: Server-side storage operations
 * - src/components/library/library.tsx: Client-side storage access
 * - src/lib/storage/server-provider.ts: Server-side provider creation
 * 
 * @dependencies
 * - @/lib/storage/types: StorageProvider interface and types
 * - @/lib/storage/filesystem-provider: Local filesystem implementation
 * - @/lib/storage/onedrive-provider: OneDrive implementation
 * - @/types/library: ClientLibrary type definition
 * - @/lib/debug/logger: Authentication logging
 */

import { StorageProvider, StorageItem, StorageValidationResult } from './types';
import { ClientLibrary } from '@/types/library';
import { OneDriveProvider } from './onedrive-provider';
import { getSupportedLibraryTypesString } from './supported-types';
import { AuthLogger } from '@/lib/debug/logger';

interface LibraryPathProvider {
  _libraryPath?: string;
}

class LocalStorageProvider implements StorageProvider {
  private library: ClientLibrary;
  private baseUrl: string;
  private userEmail: string | null = null;
  // Deduplizierung paralleler Ordner-Listings pro Bibliothek/Ordner
  private pendingRequests: Map<string, Promise<StorageItem[]>> = new Map();

  constructor(library: ClientLibrary, baseUrl?: string) {
    this.library = library;
    // Im Server-Kontext kann baseUrl übergeben werden, sonst relative URL verwenden
    this.baseUrl = baseUrl || '';
  }

  /**
   * Prüft, ob der Provider authentifiziert ist.
   * Für das lokale Dateisystem ist dies immer true, da keine Authentifizierung erforderlich ist.
   * @returns Immer true für das lokale Dateisystem
   */
  isAuthenticated(): boolean {
    return true;
  }

  // Setzt die Benutzer-E-Mail für Server-zu-Server API-Calls
  setUserEmail(email: string) {
    this.userEmail = email;
    //console.log(`[LocalStorageProvider] User E-Mail gesetzt: ${email}`);
  }

  get name() {
    return 'Local Filesystem';
  }

  get id() {
    return this.library.id;
  }

  private getApiUrl(path: string): string {
    const url = `${this.baseUrl}${path}`;
    // E-Mail als Parameter anhängen, wenn im Server-Kontext
    if (this.userEmail) {
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}email=${encodeURIComponent(this.userEmail)}`;
    }
    return url;
  }

  async listItemsById(folderId: string): Promise<StorageItem[]> {
    const requestKey = `${this.library.id}:${folderId}`;
    const existing = this.pendingRequests.get(requestKey);
    if (existing) {
      // Gleichzeitige Anfragen für denselben Ordner zusammenführen
      return existing;
    }

    const requestPromise = (async (): Promise<StorageItem[]> => {
      const url = this.getApiUrl(`/api/storage/filesystem?action=list&fileId=${folderId}&libraryId=${this.library.id}`);
      //console.log(`[LocalStorageProvider] Calling API:`, url);
      /*
      AuthLogger.debug('LocalStorageProvider', 'Starting listItemsById API call', {
        folderId,
        libraryId: this.library.id,
        hasUserEmail: !!this.userEmail,
        userEmail: this.userEmail ? `${this.userEmail.split('@')[0]}@...` : null,
        url: url.replace(/email=[^&]+/, 'email=***')
      });
      */
      try {
        const response = await fetch(url);
        
        if (!response.ok) {
          console.error(`[LocalStorageProvider] API call failed:`, {
            status: response.status,
            statusText: response.statusText,
            url,
            libraryId: this.library.id,
            folderId,
            userEmail: this.userEmail
          });
          
          // Versuche, die spezifische Fehlermeldung aus der Response zu extrahieren
          let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          
          try {
            const errorData = await response.json();
            if (errorData.error) {
              errorMessage = errorData.error;
            }
            if (errorData.errorCode) {
              console.error(`[LocalStorageProvider] Error code:`, errorData.errorCode);
            }
          } catch (parseError) {
            console.warn(`[LocalStorageProvider] Konnte Fehlermeldung nicht parsen:`, parseError);
          }
          
          // Spezifische Behandlung für verschiedene HTTP-Status-Codes
          if (response.status === 404) {
            throw new Error(`Bibliothek nicht gefunden. Bitte überprüfen Sie die Bibliothekskonfiguration.`);
          } else if (response.status === 400) {
            throw new Error(`Ungültige Anfrage: ${errorMessage}`);
          } else if (response.status === 500) {
            throw new Error(`Server-Fehler beim Laden der Bibliothek. Bitte überprüfen Sie, ob der Bibliothekspfad existiert und zugänglich ist.`);
          } else {
            throw new Error(`Fehler beim Laden der Bibliothek: ${errorMessage}`);
          }
          
          // AuthLogger für Fehler
          AuthLogger.error('LocalStorageProvider', 'API call failed', {
            status: response.status,
            statusText: response.statusText,
            errorMessage,
            folderId,
            libraryId: this.library.id,
            hasUserEmail: !!this.userEmail
          });
        }
        
        const data = await response.json();
        //console.log(`[LocalStorageProvider] Successfully loaded ${data.length} items`);
        
        // API call successful Log entfernt (zu viele Logs bei jedem erfolgreichen Call)
        
        return data as StorageItem[];
        
      } catch (error) {
        console.error(`[LocalStorageProvider] Exception in listItemsById:`, {
          error: error instanceof Error ? {
            message: error.message,
            name: error.name,
            stack: error.stack?.split('\n').slice(0, 3)
          } : error,
          libraryId: this.library.id,
          folderId,
          userEmail: this.userEmail,
          libraryPath: this.library.path
        });
        
        AuthLogger.error('LocalStorageProvider', 'Exception in listItemsById', error);
        
        // Re-throw den Fehler mit zusätzlichem Kontext
        if (error instanceof Error) {
          throw new Error(`Fehler beim Laden der Bibliothek "${this.library.label}": ${error.message}`);
        } else {
          throw new Error(`Unbekannter Fehler beim Laden der Bibliothek "${this.library.label}"`);
        }
      }
    })();

    this.pendingRequests.set(requestKey, requestPromise);
    try {
      return await requestPromise;
    } finally {
      this.pendingRequests.delete(requestKey);
    }
  }

  async getItemById(fileId: string): Promise<StorageItem> {
    const url = this.getApiUrl(`/api/storage/filesystem?action=get&fileId=${fileId}&libraryId=${this.library.id}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to get item');
    }
    return response.json();
  }

  async createFolder(parentId: string, name: string): Promise<StorageItem> {
    const url = this.getApiUrl(`/api/storage/filesystem?action=createFolder&fileId=${parentId}&libraryId=${this.library.id}`);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      throw new Error('Failed to create folder');
    }
    return response.json();
  }

  async deleteItem(fileId: string): Promise<void> {
    const url = this.getApiUrl(`/api/storage/filesystem?fileId=${fileId}&libraryId=${this.library.id}`);
    const response = await fetch(url, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete item');
    }
  }

  async moveItem(fileId: string, newParentId: string): Promise<void> {
    const url = this.getApiUrl(`/api/storage/filesystem?fileId=${fileId}&newParentId=${newParentId}&libraryId=${this.library.id}`);
    const response = await fetch(url, {
      method: 'PATCH',
    });
    if (!response.ok) {
      throw new Error('Failed to move item');
    }
  }

  async renameItem(itemId: string, newName: string): Promise<StorageItem> {
    const url = this.getApiUrl(`/api/storage/filesystem?action=rename&fileId=${itemId}&libraryId=${this.library.id}`);
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: newName }),
    });
    if (!response.ok) {
      throw new Error('Failed to rename item');
    }
    return response.json();
  }

  async uploadFile(parentId: string, file: File): Promise<StorageItem> {
    console.log('Preparing upload:', {
      parentId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    });

    const formData = new FormData();
    formData.append('file', file, file.name);

    const url = this.getApiUrl(`/api/storage/filesystem?action=upload&fileId=${parentId}&libraryId=${this.library.id}`);
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || 'Failed to upload file');
    }

    return response.json();
  }

  async downloadFile(fileId: string): Promise<Blob> {
    const url = this.getApiUrl(`/api/storage/filesystem?action=download&fileId=${fileId}&libraryId=${this.library.id}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to download file');
    }
    return response.blob();
  }

  async getBinary(fileId: string): Promise<{ blob: Blob; mimeType: string }> {
    const url = this.getApiUrl(`/api/storage/filesystem?action=binary&fileId=${fileId}&libraryId=${this.library.id}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to get binary');
    }
    const blob = await response.blob();
    return {
      blob,
      mimeType: response.headers.get('Content-Type') || 'application/octet-stream',
    };
  }



  async getPathById(itemId: string): Promise<string> {
    const url = this.getApiUrl(`/api/storage/filesystem?action=path&fileId=${itemId}&libraryId=${this.library.id}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to get path');
    }
    return response.text();
  }

  async getPathItemsById(itemId: string): Promise<StorageItem[]> {
    if (itemId === 'root') {
      // Root-Item erzeugen
      return [
        {
          id: 'root',
          parentId: '',
          type: 'folder',
          metadata: {
            name: 'root',
            size: 0,
            modifiedAt: new Date(),
            mimeType: 'application/folder'
          }
        }
      ];
    }
    const path = await this.getPathById(itemId); // z.B. /foo/bar/baz
    const segments = path.split('/').filter(Boolean);
    let parentId = 'root';
    const pathItems: StorageItem[] = [];
    for (const segment of segments) {
      const children = await this.listItemsById(parentId);
      const folder = children.find(child => child.metadata.name === segment && child.type === 'folder');
      if (!folder) break;
      pathItems.push(folder);
      parentId = folder.id;
    }
    
    // PERFORMANCE-OPTIMIERUNG: Füge Zielordner hinzu, wenn er ein Ordner ist
    // (verhindert zusätzlichen getItemById-Call in useFolderNavigation)
    if (itemId !== 'root' && pathItems.length > 0) {
      const lastPathItem = pathItems[pathItems.length - 1];
      // Wenn der letzte Pfad-Ordner nicht der Zielordner ist, lade ihn
      if (lastPathItem.id !== itemId) {
        try {
          const targetItem = await this.getItemById(itemId);
          if (targetItem.type === 'folder') {
            pathItems.push(targetItem);
          }
        } catch {
          // Ignore - Zielordner konnte nicht geladen werden
        }
      }
    }
    
    return [{
      id: 'root',
      parentId: '',
      type: 'folder',
      metadata: {
        name: 'root',
        size: 0,
        modifiedAt: new Date(),
        mimeType: 'application/folder'
      }
    }, ...pathItems];
  }

  async validateConfiguration(): Promise<StorageValidationResult> {
    return { isValid: true };
  }

  async getStreamingUrl(itemId: string): Promise<string> {
    // Für lokale Dateien verwenden wir die filesystem API-Route mit action=binary
    return this.getApiUrl(`/api/storage/filesystem?action=binary&fileId=${encodeURIComponent(itemId)}&libraryId=${this.library.id}`);
  }

  async getDownloadUrl(itemId: string): Promise<string> {
    // Für lokale Dateien ist die Download-URL identisch mit der Streaming-URL
    return this.getStreamingUrl(itemId);
  }
}

export class StorageFactory {
  private static instance: StorageFactory;
  private libraries: ClientLibrary[] = [];
  private providers = new Map<string, StorageProvider>();
  private apiBaseUrl: string | null = null;
  private userEmail: string | null = null;

  private constructor() {}

  static getInstance(): StorageFactory {
    if (!StorageFactory.instance) {
      StorageFactory.instance = new StorageFactory();
    }
    return StorageFactory.instance;
  }

  // Setzt die Basis-URL für API-Anfragen, wichtig für serverseitige Aufrufe
  setApiBaseUrl(baseUrl: string) {
    this.apiBaseUrl = baseUrl;
  }

  /**
   * Setzt die Benutzer-E-Mail für alle Provider
   * Wichtig für Client-zu-Server API-Aufrufe
   */
  setUserEmail(email: string) {
    this.userEmail = email;
    // Update existing providers
    this.providers.forEach((provider) => {
      if ('setUserEmail' in provider && typeof provider.setUserEmail === 'function') {
        (provider as unknown as { setUserEmail?: (e: string) => void }).setUserEmail?.(email);
      }
    });
  }

  setLibraries(libraries: ClientLibrary[]) {
    if (libraries.length === 0) {
      // Bibliotheksliste nicht leeren, wenn eine neue leere Liste übergeben wird
      // Dies verhindert Probleme, wenn die Komponente mit einer leeren Liste initialisiert wird
      return;
    }
    
    this.libraries = libraries;
    
    // Die Provider nur zurücksetzen, wenn sich die IDs der Bibliotheken geändert haben
    // Dies verhindert unnötiges Neuladen bei redundanten setLibraries-Aufrufen
    const currentProviderIds = Array.from(this.providers.keys());
    const newLibraryIds = libraries.map(lib => lib.id);
    
    const hasChanges = currentProviderIds.some(id => !newLibraryIds.includes(id)) ||
                       newLibraryIds.some(id => !currentProviderIds.includes(id));
    
    if (hasChanges) {
      this.providers.clear();
    }
  }

  // Löscht einen bestimmten Provider aus dem Cache, um eine Neuinitialisierung zu erzwingen
  async clearProvider(libraryId: string): Promise<void> {
    console.log(`StorageFactory: Lösche Provider für Bibliothek ${libraryId} aus dem Cache`);
    
    // Zusätzliche Debugging-Informationen
    const existingProvider = this.providers.get(libraryId);
    const library = this.libraries.find(lib => lib.id === libraryId);
    
    if (existingProvider) {
      console.log(`StorageFactory: Lösche Provider-Details:`, {
        providerId: libraryId,
        providerName: existingProvider.name,
        cachedLibraryPath: (existingProvider as LibraryPathProvider)._libraryPath || 'nicht verfügbar',
        aktuelleBibliothekPath: library?.path || 'nicht verfügbar',
        zeitpunkt: new Date().toISOString()
      });
    } else {
      console.log(`StorageFactory: Kein Provider im Cache für Bibliothek ${libraryId}`);
    }
    
    this.providers.delete(libraryId);
    console.log(`StorageFactory: Provider für ${libraryId} wurde aus dem Cache entfernt`);
  }

  async getProvider(libraryId: string): Promise<StorageProvider> {
    // Check if provider already exists
    if (this.providers.has(libraryId)) {
      return this.providers.get(libraryId)!;
    }

    // Find library
    const library = this.libraries.find(lib => lib.id === libraryId);
    if (!library) {
      console.error(`StorageFactory: Bibliothek ${libraryId} nicht gefunden!`);
      console.log(`StorageFactory: Verfügbare Bibliotheken:`, this.libraries.map(lib => ({
        id: lib.id,
        label: lib.label
      })));
      
      // Spezifischen Fehler werfen, den wir später abfangen können
      const error = new Error(`Bibliothek ${libraryId} nicht gefunden`);
      error.name = 'LibraryNotFoundError';
      interface LibraryNotFoundError extends Error {
        errorCode: string;
        libraryId: string;
      }
      const typedError = error as LibraryNotFoundError;
      typedError.errorCode = 'LIBRARY_NOT_FOUND';
      typedError.libraryId = libraryId;
      throw typedError;
    }

    // Create provider based on library type
    let provider: StorageProvider;
    switch (library.type) {
      case 'local':
        provider = new LocalStorageProvider(library, this.apiBaseUrl || undefined);
        //console.log(`StorageFactory: LocalStorageProvider erstellt für "${library.path}"`);
        // Set user email if available
        if (this.userEmail && 'setUserEmail' in (provider as unknown as { setUserEmail?: (e: string) => void })) {
          (provider as unknown as { setUserEmail?: (e: string) => void }).setUserEmail?.(this.userEmail);
          //console.log(`StorageFactory: User-Email an LocalStorageProvider gesetzt`);
        }
        break;
      case 'onedrive':
        provider = new OneDriveProvider(library, this.apiBaseUrl || undefined);
        //console.log(`StorageFactory: OneDriveProvider erstellt`);
        // Set user email if available
        if (this.userEmail && 'setUserEmail' in (provider as unknown as { setUserEmail?: (e: string) => void })) {
          (provider as unknown as { setUserEmail?: (e: string) => void }).setUserEmail?.(this.userEmail);
          //console.log(`StorageFactory: User-Email an OneDriveProvider gesetzt`);
        }
        break;
      // Add more provider types here
      default:
        console.warn(`StorageFactory: Nicht unterstützter Bibliothekstyp "${library.type}" für Bibliothek "${library.label}"`);
        console.info(`StorageFactory: Unterstützte Typen: ${getSupportedLibraryTypesString()}`);
        
        // Spezifischen Fehler werfen, den wir graceful handhaben können
        const error = new Error(`Bibliothekstyp "${library.type}" wird noch nicht unterstützt. Unterstützte Typen: ${getSupportedLibraryTypesString()}`);
        error.name = 'UnsupportedLibraryTypeError';
        interface UnsupportedLibraryTypeError extends Error {
          errorCode: string;
          libraryType: string;
          libraryId: string;
        }
        const typedError = error as UnsupportedLibraryTypeError;
        typedError.errorCode = 'UNSUPPORTED_LIBRARY_TYPE';
        typedError.libraryType = library.type;
        typedError.libraryId = library.id;
        throw typedError;
    }

    // Cache provider
    this.providers.set(libraryId, provider);
    return provider;
  }
} 