import { StorageProvider, StorageItem, StorageValidationResult, StorageError } from './types';

export class FileSystemClient implements StorageProvider {
  name = 'Local FileSystem';
  id = 'filesystem';
  private baseUrl: string;
  private libraryId: string;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 5000; // 5 Sekunden Cache

  constructor(baseUrl: string = '/api/storage/filesystem', libraryId: string = 'local') {
    this.baseUrl = baseUrl;
    this.libraryId = libraryId;
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

  private setCache(key: string, data: any): void {
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
      const error = await response.json();
      console.error('[FileSystemClient] HTTP Fehler:', {
        status: response.status,
        error: error.error || 'Network error'
      });
      throw new StorageError(
        error.error || 'Network error',
        'HTTP_ERROR',
        this.id
      );
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

  // Cache invalidieren bei Änderungen
  private invalidateCache(): void {
    console.log('[FileSystemClient] Cache invalidiert');
    this.cache.clear();
  }
} 