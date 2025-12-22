/**
 * @fileoverview File System Client - Client-side Filesystem Storage Provider
 * 
 * @description
 * Client-side implementation of StorageProvider for filesystem operations.
 * Uses fetch API to communicate with server-side filesystem API routes.
 * Implements caching for improved performance and reduces redundant API calls.
 * 
 * @module storage
 * 
 * @exports
 * - FileSystemClient: Client-side filesystem storage provider
 * 
 * @usedIn
 * - src/lib/storage/storage-factory.ts: Created by factory for client-side operations
 * - src/components/library: Components may use client directly
 * 
 * @dependencies
 * - @/lib/storage/types: StorageProvider interface and types
 */

import { StorageProvider, StorageItem, StorageValidationResult, StorageError } from './types';

export class FileSystemClient implements StorageProvider {
  name = 'Local FileSystem';
  id = 'filesystem';
  private baseUrl: string;
  private libraryId: string;
  private cache: Map<string, { data: unknown; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 5000; // 5 Sekunden Cache

  constructor(baseUrl: string = '/api/storage/filesystem', libraryId?: string) {
    this.baseUrl = baseUrl;
    this.libraryId = libraryId || '';
  }

  isAuthenticated(): boolean {
    // Lokale Dateisysteme benötigen keine Authentifizierung
    return true;
  }

  private getCacheKey(action: string, id: string): string {
    return `${action}:${id}:${this.libraryId}`;
  }

  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > this.CACHE_DURATION) {
      this.cache.delete(key);
      return null;
    }

    console.log('[FileSystemClient] Cache Hit:', key);
    return cached.data as T;
  }

  private setCache(key: string, data: unknown): void {
    console.log('[FileSystemClient] Cache Set:', key);
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  private getUrlWithLibrary(url: string): string {
    return `${url}${url.includes('?') ? '&' : '?'}libraryId=${this.libraryId}`;
  }

  async validateConfiguration(): Promise<StorageValidationResult> {
    try {
      await this.listItemsById('root');
      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async fetchWithError(url: string, options?: RequestInit): Promise<Response> {
    console.log('[FileSystemClient] fetchWithError:', { 
      url, 
      method: options?.method || 'GET',
      libraryId: this.libraryId 
    });
    
    const urlWithLibrary = this.getUrlWithLibrary(url);
    const response = await fetch(urlWithLibrary, options);
    
    if (!response.ok) {
      let errorData: { error?: string; errorCode?: string; errorDetails?: unknown } = {};
      try {
        errorData = await response.json();
      } catch {
        // Wenn JSON-Parsing fehlschlägt, verwende Status-Text
        errorData = { error: response.statusText || 'Network error' };
      }
      
      console.error('[FileSystemClient] HTTP Fehler:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData.error || 'Network error',
        errorCode: errorData.errorCode
      });
      
      const error = new StorageError(
        errorData.error || 'Network error',
        errorData.errorCode || 'HTTP_ERROR',
        this.id
      );
      
      // Füge zusätzliche Fehlerdetails hinzu, die später extrahiert werden können
      (error as unknown as { httpStatus?: number; httpStatusText?: string; errorDetails?: unknown }).httpStatus = response.status;
      (error as unknown as { httpStatus?: number; httpStatusText?: string; errorDetails?: unknown }).httpStatusText = response.statusText;
      (error as unknown as { httpStatus?: number; httpStatusText?: string; errorDetails?: unknown }).errorDetails = errorData.errorDetails;
      
      throw error;
    }
    
    return response;
  }

  async listItemsById(folderId: string): Promise<StorageItem[]> {
    const cacheKey = this.getCacheKey('list', folderId);
    const cached = this.getFromCache<StorageItem[]>(cacheKey);
    if (cached) return cached;

    const url = `${this.baseUrl}?action=list&fileId=${encodeURIComponent(folderId)}`;
    const response = await this.fetchWithError(url);
    const data = await response.json();
    this.setCache(cacheKey, data);
    return data;
  }

  async getItemById(itemId: string): Promise<StorageItem> {
    const cacheKey = this.getCacheKey('get', itemId);
    const cached = this.getFromCache<StorageItem>(cacheKey);
    if (cached) return cached;

    const url = `${this.baseUrl}?action=get&fileId=${encodeURIComponent(itemId)}`;
    const response = await this.fetchWithError(url);
    const data = await response.json();
    this.setCache(cacheKey, data);
    return data;
  }

  async createFolder(parentId: string, name: string): Promise<StorageItem> {
    this.invalidateCache();
    const url = `${this.baseUrl}?action=createFolder&fileId=${encodeURIComponent(parentId)}`;
    const response = await this.fetchWithError(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return response.json();
  }

  async deleteItem(itemId: string): Promise<void> {
    this.invalidateCache();
    const url = `${this.baseUrl}?fileId=${encodeURIComponent(itemId)}`;
    await this.fetchWithError(url, { method: 'DELETE' });
  }

  async moveItem(itemId: string, newParentId: string): Promise<void> {
    this.invalidateCache();
    const url = `${this.baseUrl}?fileId=${encodeURIComponent(itemId)}&newParentId=${encodeURIComponent(newParentId)}`;
    await this.fetchWithError(url, { method: 'PATCH' });
  }

  async renameItem(itemId: string, newName: string): Promise<StorageItem> {
    this.invalidateCache();
    const url = `${this.baseUrl}?action=rename&fileId=${encodeURIComponent(itemId)}`;
    const response = await this.fetchWithError(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    });
    return response.json();
  }

  async uploadFile(parentId: string, file: File): Promise<StorageItem> {
    this.invalidateCache();
    const url = `${this.baseUrl}?action=upload&fileId=${encodeURIComponent(parentId)}`;
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await this.fetchWithError(url, {
      method: 'POST',
      body: formData,
    });
    return response.json();
  }

  /**
   * Performance-Optimierung (filesystem):
   * ZIP wird in einem Request übertragen und serverseitig entpackt.
   *
   * Hinweis: Nicht Teil des StorageProvider-Interfaces. Nutzung via Feature-Detection.
   */
  async saveAndExtractZipInFolder(parentId: string, zipBase64: string): Promise<StorageItem[]> {
    this.invalidateCache()
    if (!zipBase64) return []
    const url = `${this.baseUrl}?action=saveAndExtractZipInFolder&fileId=${encodeURIComponent(parentId)}`
    const response = await this.fetchWithError(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zipBase64 }),
    })
    const data = await response.json().catch(() => ({})) as { savedItems?: StorageItem[] }
    return Array.isArray(data.savedItems) ? data.savedItems : []
  }

  async getBinary(fileId: string): Promise<{ blob: Blob; mimeType: string; }> {
    console.log('[FileSystemClient] getBinary aufgerufen mit fileId:', fileId);
    const url = `${this.baseUrl}?action=binary&fileId=${encodeURIComponent(fileId)}`;
    console.log('[FileSystemClient] Sende Request an URL:', url);
    
    try {
      const response = await this.fetchWithError(url);
      const blob = await response.blob();
      const mimeType = response.headers.get('Content-Type') || 'application/octet-stream';
      console.log('[FileSystemClient] Antwort erhalten:', {
        mimeType,
        size: blob.size,
        status: response.status
      });
      return { blob, mimeType };
    } catch (error) {
      console.error('[FileSystemClient] Fehler beim Abrufen der Binärdaten:', error);
      throw error;
    }
  }



  async getDownloadUrl(fileId: string): Promise<string> {
    return `${this.baseUrl}?action=binary&fileId=${encodeURIComponent(fileId)}`;
  }

  async getStreamingUrl(fileId: string): Promise<string> {
    return `${this.baseUrl}?action=binary&fileId=${encodeURIComponent(fileId)}`;
  }

  async getPathById(itemId: string): Promise<string> {
    console.log('[FileSystemClient] getPathById aufgerufen mit itemId:', itemId);
    const url = `${this.baseUrl}?action=path&fileId=${encodeURIComponent(itemId)}`;
    
    try {
      const response = await this.fetchWithError(url);
      const path = await response.text();
      console.log('[FileSystemClient] Pfad erhalten:', path);
      return path;
    } catch (error) {
      console.error('[FileSystemClient] Fehler beim Abrufen des Pfads:', error);
      throw error;
    }
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

  // Cache invalidieren bei Änderungen
  private invalidateCache(): void {
    console.log('[FileSystemClient] Cache invalidiert');
    this.cache.clear();
  }
} 