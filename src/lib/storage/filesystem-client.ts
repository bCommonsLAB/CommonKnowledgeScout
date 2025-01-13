import { StorageProvider, StorageItem, StorageFile, StorageFolder, StorageValidationResult } from './types';

export class FileSystemClient implements StorageProvider {
  name = 'Local FileSystem';
  id = 'filesystem';
  private baseUrl: string;
  private libraryId: string;

  constructor(baseUrl: string = '/api/storage/filesystem', libraryId: string = 'local') {
    this.baseUrl = baseUrl;
    this.libraryId = libraryId;
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
    const urlWithLibrary = this.getUrlWithLibrary(url);
    const response = await fetch(urlWithLibrary, options);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Network error');
    }
    return response;
  }

  async listItems(path: string): Promise<StorageItem[]> {
    const url = `${this.baseUrl}?action=list&path=${encodeURIComponent(path)}`;
    const response = await this.fetchWithError(url);
    return response.json();
  }

  async getItem(path: string): Promise<StorageItem> {
    const url = `${this.baseUrl}?action=get&path=${encodeURIComponent(path)}`;
    const response = await this.fetchWithError(url);
    return response.json();
  }

  async createFolder(path: string, name: string): Promise<StorageFolder> {
    const url = `${this.baseUrl}?action=createFolder&path=${encodeURIComponent(path)}`;
    const response = await this.fetchWithError(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name }),
    });
    return response.json();
  }

  async deleteItem(path: string): Promise<void> {
    const url = `${this.baseUrl}?path=${encodeURIComponent(path)}`;
    await this.fetchWithError(url, {
      method: 'DELETE',
    });
  }

  async moveItem(fromPath: string, toPath: string): Promise<void> {
    const url = this.baseUrl;
    await this.fetchWithError(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fromPath, toPath }),
    });
  }

  async uploadFile(path: string, file: File): Promise<StorageFile> {
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
} 