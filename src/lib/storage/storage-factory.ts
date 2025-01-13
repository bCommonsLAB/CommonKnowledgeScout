import { StorageProvider, StorageValidationResult } from './types';
import { FileSystemClient } from './filesystem-client';
import { MockStorageProvider } from './mock-provider';
import { ClientLibrary, StorageProviderType } from '@/types/library';

export class StorageFactory {
  private static instance: StorageFactory;
  private providers: Map<string, StorageProvider>;
  private validationResults: Map<string, StorageValidationResult>;
  private libraries: ClientLibrary[];

  private constructor() {
    this.providers = new Map();
    this.validationResults = new Map();
    this.libraries = [];
  }

  public static getInstance(): StorageFactory {
    if (!StorageFactory.instance) {
      StorageFactory.instance = new StorageFactory();
    }
    return StorageFactory.instance;
  }

  public setLibraries(libraries: ClientLibrary[]): void {
    this.libraries = libraries;
    // Bestehende Provider zurücksetzen, da sich die Konfiguration geändert hat
    this.providers.clear();
    this.validationResults.clear();
  }

  private async createProvider(library: ClientLibrary): Promise<StorageProvider> {
    switch (library.type) {
      case 'local':
        return new FileSystemClient('/api/storage/filesystem', library.id);

      case 'mock':
        return new MockStorageProvider();

      // Weitere Provider hier hinzufügen
      default:
        throw new Error(`Unsupported storage type: ${library.type}`);
    }
  }

  public async getProvider(libraryId: string): Promise<StorageProvider> {
    const existingProvider = this.providers.get(libraryId);
    if (existingProvider) {
      return existingProvider;
    }

    const library = this.libraries.find(lib => lib.id === libraryId);
    if (!library) {
      throw new Error(`Library ${libraryId} not found`);
    }

    if (!library.isEnabled) {
      throw new Error(`Library ${libraryId} is disabled`);
    }

    const provider = await this.createProvider(library);
    const validationResult = await provider.validateConfiguration();
    
    if (!validationResult.isValid) {
      throw new Error(`Storage provider ${library.type} validation failed: ${validationResult.error}`);
    }

    this.providers.set(libraryId, provider);
    this.validationResults.set(libraryId, validationResult);
    
    return provider;
  }

  public getValidationResult(libraryId: string): StorageValidationResult | undefined {
    return this.validationResults.get(libraryId);
  }

  public getLibraries(): ClientLibrary[] {
    return this.libraries;
  }
} 