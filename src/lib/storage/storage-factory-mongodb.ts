/**
 * @fileoverview MongoDB Storage Factory - MongoDB-based Storage Provider Factory
 * 
 * @description
 * MongoDBStorageFactory provides storage provider creation with MongoDB integration.
 * Used for server-side operations where library data is stored in MongoDB. Creates
 * providers that can access MongoDB-stored library configurations.
 * 
 * @module storage
 * 
 * @exports
 * - MongoDBStorageFactory: MongoDB-based storage factory class
 * - LocalStorageProvider: Local filesystem provider for MongoDB context
 * 
 * @usedIn
 * - src/app/api: API routes use MongoDB factory for server-side operations
 * - src/lib/services/library-service.ts: Library service may use MongoDB factory
 * 
 * @dependencies
 * - @/lib/storage/types: StorageProvider interface and types
 * - @/types/library: Library type definitions
 * - @/lib/services/library-service: Library service for MongoDB access
 */

import { StorageProvider, StorageItem, StorageValidationResult } from './types';
import { Library, ClientLibrary } from '@/types/library';
import { LibraryService } from '@/lib/services/library-service';

/**
 * Lokaler Dateisystem-Provider
 * Implementiert die StorageProvider-Schnittstelle für das lokale Dateisystem
 */
class LocalStorageProvider implements StorageProvider {
  private library: Library | ClientLibrary;

  constructor(library: Library | ClientLibrary) {
    this.library = library;
  }

  get name() {
    return 'Local Filesystem';
  }

  get id() {
    return this.library.id;
  }

  async listItemsById(folderId: string): Promise<StorageItem[]> {
    const response = await fetch(`/api/storage/filesystem?action=list&fileId=${folderId}&libraryId=${this.library.id}`);
    if (!response.ok) {
      throw new Error('Failed to list items');
    }
    return response.json();
  }

  async getItemById(fileId: string): Promise<StorageItem> {
    const response = await fetch(`/api/storage/filesystem?action=get&fileId=${fileId}&libraryId=${this.library.id}`);
    if (!response.ok) {
      throw new Error('Failed to get item');
    }
    return response.json();
  }

  async createFolder(parentId: string, name: string): Promise<StorageItem> {
    const response = await fetch(`/api/storage/filesystem?action=createFolder&fileId=${parentId}&libraryId=${this.library.id}`, {
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
    const response = await fetch(`/api/storage/filesystem?action=delete&fileId=${fileId}&libraryId=${this.library.id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete item');
    }
  }

  async moveItem(fileId: string, newParentId: string): Promise<void> {
    const response = await fetch(`/api/storage/filesystem?action=move&fileId=${fileId}&newParentId=${newParentId}&libraryId=${this.library.id}`, {
      method: 'PATCH',
    });
    if (!response.ok) {
      throw new Error('Failed to move item');
    }
  }

  async renameItem(itemId: string, newName: string): Promise<StorageItem> {
    const response = await fetch(`/api/storage/filesystem?action=rename&fileId=${itemId}&libraryId=${this.library.id}`, {
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

    const response = await fetch(`/api/storage/filesystem?action=upload&fileId=${parentId}&libraryId=${this.library.id}`, {
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
    const response = await fetch(`/api/storage/filesystem?action=download&fileId=${fileId}&libraryId=${this.library.id}`);
    if (!response.ok) {
      throw new Error('Failed to download file');
    }
    return response.blob();
  }

  async getBinary(fileId: string): Promise<{ blob: Blob; mimeType: string }> {
    const response = await fetch(`/api/storage/filesystem?action=binary&fileId=${fileId}&libraryId=${this.library.id}`);
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
    const response = await fetch(`/api/storage/filesystem?action=path&fileId=${itemId}&libraryId=${this.library.id}`);
    if (!response.ok) {
      throw new Error('Failed to get path');
    }
    return response.text();
  }

  async getDownloadUrl(itemId: string): Promise<string> {
    return `/api/storage/filesystem?action=binary&fileId=${encodeURIComponent(itemId)}&libraryId=${this.library.id}`;
  }

  async getStreamingUrl(itemId: string): Promise<string> {
    return `/api/storage/filesystem?action=binary&fileId=${encodeURIComponent(itemId)}&libraryId=${this.library.id}`;
  }

  async getPathItemsById(itemId: string): Promise<StorageItem[]> {
    if (itemId === 'root') {
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
      }];
    }
    
    const path = await this.getPathById(itemId);
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

  /**
   * Prüft, ob der Provider authentifiziert ist.
   * Für das lokale Dateisystem ist dies immer true, da keine Authentifizierung erforderlich ist.
   * @returns Immer true für das lokale Dateisystem
   */
  isAuthenticated(): boolean {
    return true;
  }
}

/**
 * StorageFactory mit MongoDB-Integration
 * Verwaltet die Storage-Provider für verschiedene Bibliothekstypen
 */
export class MongoDBStorageFactory {
  private static instance: MongoDBStorageFactory;
  private providers = new Map<string, StorageProvider>();
  private libraryService: LibraryService;
  private currentUserId: string = 'default';
  private cachedLibraries: Library[] = [];

  private constructor() {
    this.libraryService = LibraryService.getInstance();
  }

  static getInstance(): MongoDBStorageFactory {
    if (!MongoDBStorageFactory.instance) {
      MongoDBStorageFactory.instance = new MongoDBStorageFactory();
    }
    return MongoDBStorageFactory.instance;
  }

  /**
   * Aktuellen Benutzer setzen
   */
  async setCurrentUser(userId: string) {
    if (this.currentUserId !== userId) {
      console.log(`Wechsel zu Benutzer: ${userId}`);
      this.currentUserId = userId;
      // Cache leeren, wenn der Benutzer wechselt
      this.providers.clear();
      // Neue Bibliotheken laden
      this.cachedLibraries = await this.libraryService.getUserLibraries(userId);
    }
  }

  /**
   * Aktuelle Bibliotheken in MongoDB speichern (Initial)
   */
  async saveInitialLibraries(libraries: Library[]): Promise<boolean> {
    return this.libraryService.saveCurrentLibraries(libraries);
  }

  /**
   * Für die Kompatibilität mit der bestehenden Library-Komponente
   */
  setLibraries(): void {
    // Diese Methode leert nur den Cache, lädt aber keine Libraries
    this.providers.clear();
  }

  /**
   * Gibt die Libraries des aktuellen Benutzers zurück
   */
  async getClientLibraries(): Promise<ClientLibrary[]> {
    if (!this.cachedLibraries.length) {
      console.log(`Lade Bibliotheken für Benutzer: ${this.currentUserId}`);
      this.cachedLibraries = await this.libraryService.getUserLibraries(this.currentUserId);
    }
    
    return this.libraryService.toClientLibraries(this.cachedLibraries);
  }

  /**
   * Provider für eine Bibliothek abrufen
   */
  async getProvider(libraryId: string): Promise<StorageProvider> {
    // Prüfen, ob Provider bereits erstellt wurde
    const cacheKey = `${this.currentUserId}:${libraryId}`;
    if (this.providers.has(cacheKey)) {
      return this.providers.get(cacheKey)!;
    }

    // Bibliothekskonfiguration vom Service laden
    const library = await this.libraryService.getLibrary(this.currentUserId, libraryId);
    if (!library) {
      throw new Error(`Bibliothek ${libraryId} für Benutzer ${this.currentUserId} nicht gefunden`);
    }

    // Provider basierend auf Bibliothekstyp erstellen
    const provider: StorageProvider = new LocalStorageProvider(library);

    // Provider im Cache speichern
    this.providers.set(cacheKey, provider);
    return provider;
  }
} 