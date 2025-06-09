import { StorageProvider, StorageItem, StorageValidationResult } from './types';
import { ClientLibrary } from '@/types/library';
import { OneDriveProvider } from './onedrive-provider';

interface LibraryPathProvider {
  _libraryPath?: string;
}

class LocalStorageProvider implements StorageProvider {
  private library: ClientLibrary;
  private baseUrl: string;
  private userEmail: string | null = null;

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
    console.log(`[LocalStorageProvider] User E-Mail gesetzt: ${email}`);
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
    const url = this.getApiUrl(`/api/storage/filesystem?action=list&fileId=${folderId}&libraryId=${this.library.id}`);
    console.log(`[LocalStorageProvider] Calling API:`, url);
    
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[LocalStorageProvider] API call failed:`, {
        status: response.status,
        statusText: response.statusText,
        url
      });
      throw new Error('Failed to list items');
    }
    return response.json();
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

  async validateConfiguration(): Promise<StorageValidationResult> {
    return { isValid: true };
  }
}

export class StorageFactory {
  private static instance: StorageFactory;
  private libraries: ClientLibrary[] = [];
  private providers = new Map<string, StorageProvider>();
  private apiBaseUrl: string | null = null;

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
    console.log(`StorageFactory: API-Basis-URL gesetzt auf ${baseUrl}`);
  }

  setLibraries(libraries: ClientLibrary[]) {
    console.log(`StorageFactory: setLibraries aufgerufen mit ${libraries.length} Bibliotheken`);
    
    if (libraries.length === 0) {
      console.warn(`StorageFactory: Warnung - Leere Bibliotheksliste übergeben!`);
      // Bibliotheksliste nicht leeren, wenn eine neue leere Liste übergeben wird
      // Dies verhindert Probleme, wenn die Komponente mit einer leeren Liste initialisiert wird
      return;
    }
    
    // Bibliotheksdaten protokollieren
    console.log(`StorageFactory: Bibliotheksdaten:`, libraries.map(lib => ({
      id: lib.id,
      label: lib.label,
      path: lib.path || 'kein Pfad'
    })));
    
    this.libraries = libraries;
    
    // Die Provider nur zurücksetzen, wenn sich die IDs der Bibliotheken geändert haben
    // Dies verhindert unnötiges Neuladen bei redundanten setLibraries-Aufrufen
    const currentProviderIds = Array.from(this.providers.keys());
    const newLibraryIds = libraries.map(lib => lib.id);
    
    const hasChanges = currentProviderIds.some(id => !newLibraryIds.includes(id)) ||
                       newLibraryIds.some(id => !currentProviderIds.includes(id));
    
    if (hasChanges) {
      console.log(`StorageFactory: Bibliotheksliste hat sich geändert, setze Provider zurück`);
      this.providers.clear();
    } else {
      console.log(`StorageFactory: Bibliotheksliste unverändert, behalte bestehende Provider`);
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
    console.log(`StorageFactory: getProvider aufgerufen für Bibliothek ${libraryId}`);
    
    // Check if provider already exists
    if (this.providers.has(libraryId)) {
      console.log(`StorageFactory: Verwende existierenden Provider für Bibliothek ${libraryId}`);
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

    console.log(`StorageFactory: Erstelle neuen Provider für Bibliothek:`, {
      id: library.id,
      label: library.label,
      path: library.path,
      type: library.type
    });

    // Create provider based on library type
    let provider: StorageProvider;
    switch (library.type) {
      case 'local':
        provider = new LocalStorageProvider(library, this.apiBaseUrl || undefined);
        console.log(`StorageFactory: LocalStorageProvider erstellt für "${library.path}"`);
        break;
      case 'onedrive':
        provider = new OneDriveProvider(library, this.apiBaseUrl || undefined);
        console.log(`StorageFactory: OneDriveProvider erstellt`);
        break;
      // Add more provider types here
      default:
        console.error(`StorageFactory: Nicht unterstützter Bibliothekstyp: ${library.type}`);
        throw new Error(`Unsupported library type: ${library.type}`);
    }

    // Cache provider
    this.providers.set(libraryId, provider);
    return provider;
  }
} 