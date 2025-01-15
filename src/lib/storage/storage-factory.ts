import { StorageProvider, StorageItem } from './types';
import { ClientLibrary } from '@/types/library';

class LocalStorageProvider implements StorageProvider {
  private library: ClientLibrary;

  constructor(library: ClientLibrary) {
    this.library = library;
  }

  get name() {
    return 'Local Filesystem';
  }

  get id() {
    return 'local';
  }

  async listItemsById(folderId: string): Promise<StorageItem[]> {
    const response = await fetch(`/api/storage/filesystem?action=list&itemId=${folderId}&libraryId=${this.library.id}`);
    if (!response.ok) {
      throw new Error('Failed to list items');
    }
    return response.json();
  }

  async getItemById(itemId: string): Promise<StorageItem> {
    const response = await fetch(`/api/storage/filesystem?action=get&itemId=${itemId}&libraryId=${this.library.id}`);
    if (!response.ok) {
      throw new Error('Failed to get item');
    }
    return response.json();
  }

  async createFolder(parentId: string, name: string): Promise<StorageItem> {
    const response = await fetch(`/api/storage/filesystem?action=createFolder&parentId=${parentId}&libraryId=${this.library.id}`, {
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

  async deleteItem(itemId: string): Promise<void> {
    const response = await fetch(`/api/storage/filesystem?action=delete&itemId=${itemId}&libraryId=${this.library.id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete item');
    }
  }

  async moveItem(itemId: string, newParentId: string): Promise<void> {
    const response = await fetch(`/api/storage/filesystem?action=move&itemId=${itemId}&newParentId=${newParentId}&libraryId=${this.library.id}`, {
      method: 'PATCH',
    });
    if (!response.ok) {
      throw new Error('Failed to move item');
    }
  }

  async uploadFile(parentId: string, file: File): Promise<StorageItem> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`/api/storage/filesystem?action=upload&parentId=${parentId}&libraryId=${this.library.id}`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      throw new Error('Failed to upload file');
    }
    return response.json();
  }

  async downloadFile(itemId: string): Promise<Blob> {
    const response = await fetch(`/api/storage/filesystem?action=download&itemId=${itemId}&libraryId=${this.library.id}`);
    if (!response.ok) {
      throw new Error('Failed to download file');
    }
    return response.blob();
  }

  async getBinary(itemId: string): Promise<{ blob: Blob; mimeType: string }> {
    const response = await fetch(`/api/storage/filesystem?action=binary&itemId=${itemId}&libraryId=${this.library.id}`);
    if (!response.ok) {
      throw new Error('Failed to get binary');
    }
    const blob = await response.blob();
    return {
      blob,
      mimeType: response.headers.get('Content-Type') || 'application/octet-stream',
    };
  }
}

export class StorageFactory {
  private static instance: StorageFactory;
  private libraries: ClientLibrary[] = [];
  private providers = new Map<string, StorageProvider>();

  private constructor() {}

  static getInstance(): StorageFactory {
    if (!StorageFactory.instance) {
      StorageFactory.instance = new StorageFactory();
    }
    return StorageFactory.instance;
  }

  setLibraries(libraries: ClientLibrary[]) {
    this.libraries = libraries;
    // Reset providers when libraries change
    this.providers.clear();
  }

  async getProvider(libraryId: string): Promise<StorageProvider> {
    // Check if provider already exists
    if (this.providers.has(libraryId)) {
      return this.providers.get(libraryId)!;
    }

    // Find library
    const library = this.libraries.find(lib => lib.id === libraryId);
    if (!library) {
      throw new Error(`Library ${libraryId} not found`);
    }

    // Create provider based on library type
    let provider: StorageProvider;
    switch (library.type) {
      case 'local':
        provider = new LocalStorageProvider(library);
        break;
      // Add more provider types here
      default:
        throw new Error(`Unsupported library type: ${library.type}`);
    }

    // Cache provider
    this.providers.set(libraryId, provider);
    return provider;
  }
} 