import { StorageProvider } from './types';

let globalStorageProvider: StorageProvider | null = null;

export function setStorageProvider(provider: StorageProvider) {
  globalStorageProvider = provider;
}

export function useStorageProvider(): StorageProvider {
  if (!globalStorageProvider) {
    throw new Error('Storage Provider wurde nicht initialisiert');
  }
  return globalStorageProvider;
} 