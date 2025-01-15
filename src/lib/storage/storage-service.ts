import { StorageProvider } from './types';
import { MockStorageProvider } from './mock-provider';
import { FileSystemClient } from './filesystem-client';

export class StorageService {
  private static instance: StorageService;
  private providers = new Map<string, StorageProvider>();

  private constructor() {
    const filesystemProvider = new FileSystemClient();
    this.providers.set(filesystemProvider.id, filesystemProvider);
  }

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  public registerProvider(provider: StorageProvider): void {
    this.providers.set(provider.id, provider);
  }

  public getProvider(id: string): StorageProvider {
    const provider = this.providers.get(id);
    if (!provider) {
      throw new Error(`Provider ${id} not found`);
    }
    return provider;
  }

  public listProviders(): StorageProvider[] {
    return Array.from(this.providers.values());
  }
} 