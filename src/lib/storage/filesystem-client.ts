import { StorageProvider, StorageItem, StorageFile, StorageFolder, StorageValidationResult } from './types';

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

  private getCacheKey(action: string, path: string): string {
    return `${action}:${path}:${this.libraryId}`;
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
      await this.listItems('/');
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
      throw new Error(error.error || 'Network error');
    }
    
    return response;
  }

  private ensureProviderReference(items: StorageItem | StorageItem[]): void {
    if (Array.isArray(items)) {
      items.forEach(item => {
        item.provider = this;
      });
    } else {
      items.provider = this;
    }
  }

  async listItems(path: string): Promise<StorageItem[]> {
    const cacheKey = this.getCacheKey('list', path);
    const cached = this.getFromCache<StorageItem[]>(cacheKey);
    if (cached) {
      this.ensureProviderReference(cached);
      return cached;
    }

    const url = `${this.baseUrl}?action=list&path=${encodeURIComponent(path)}`;
    const response = await this.fetchWithError(url);
    const data = await response.json();
    this.ensureProviderReference(data);
    this.setCache(cacheKey, data);
    return data;
  }

  async getItem(path: string): Promise<StorageItem> {
    const cacheKey = this.getCacheKey('get', path);
    const cached = this.getFromCache<StorageItem>(cacheKey);
    if (cached) {
      this.ensureProviderReference(cached);
      return cached;
    }

    const url = `${this.baseUrl}?action=get&path=${encodeURIComponent(path)}`;
    const response = await this.fetchWithError(url);
    const data = await response.json();
    this.ensureProviderReference(data);
    this.setCache(cacheKey, data);
    return data;
  }

  async createFolder(path: string, name: string): Promise<StorageFolder> {
    this.invalidateCache();
    const url = `${this.baseUrl}?action=createFolder&path=${encodeURIComponent(path)}`;
    const response = await this.fetchWithError(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return response.json();
  }

  async deleteItem(path: string): Promise<void> {
    this.invalidateCache();
    const url = `${this.baseUrl}?path=${encodeURIComponent(path)}`;
    await this.fetchWithError(url, { method: 'DELETE' });
  }

  async moveItem(fromPath: string, toPath: string): Promise<void> {
    this.invalidateCache();
    const url = this.baseUrl;
    await this.fetchWithError(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromPath, toPath }),
    });
  }

  async uploadFile(path: string, file: File): Promise<StorageFile> {
    this.invalidateCache();
    const url = `${this.baseUrl}?action=upload&path=${encodeURIComponent(path)}`;
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await this.fetchWithError(url, {
      method: 'POST',
      body: formData,
    });
    return response.json();
  }

  async downloadFile(path: string): Promise<Blob> {
    const url = `${this.baseUrl}?action=download&path=${encodeURIComponent(path)}`;
    const response = await this.fetchWithError(url);
    return response.blob();
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