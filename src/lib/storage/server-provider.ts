/**
 * @fileoverview Server Provider Helper - Server-side Storage Provider Creation
 * 
 * @description
 * Helper function for creating storage providers in server-side contexts (API routes).
 * Handles library loading, factory configuration, and provider validation. Ensures
 * proper user email and base URL configuration for server-to-server operations.
 * 
 * @module storage
 * 
 * @exports
 * - getServerProvider: Creates and validates a storage provider for server-side use
 * 
 * @usedIn
 * - src/app/api: API routes use this helper for server-side storage access
 * - src/lib/external-jobs: External jobs use server providers
 * 
 * @dependencies
 * - @/lib/storage/storage-factory: Storage provider factory
 * - @/lib/services/library-service: Library service for loading libraries
 * - @/lib/env: Environment helpers for base URL
 */

import { StorageFactory } from '@/lib/storage/storage-factory';
import type { StorageProvider } from '@/lib/storage/types';
import { LibraryService } from '@/lib/services/library-service';
import { getSelfBaseUrl } from '../env'

export async function getServerProvider(userEmail: string, libraryId: string): Promise<StorageProvider> {
  const baseUrl = getSelfBaseUrl();

  const libraryService = LibraryService.getInstance();
  const libraries = await libraryService.getUserLibraries(userEmail);
  const lib = libraries.find(l => l.id === libraryId);
  if (!lib) throw new Error('Library nicht gefunden');

  const factory = StorageFactory.getInstance();
  factory.setApiBaseUrl(baseUrl);
  factory.setUserEmail(userEmail);
  factory.setLibraries([{ 
    id: lib.id,
    label: lib.label,
    type: lib.type,
    path: lib.path,
    isEnabled: lib.isEnabled,
    config: (lib.config as unknown as Record<string, unknown>) || {}
  }]);

  const provider = await factory.getProvider(lib.id);
  
  // Stelle sicher, dass userEmail im Provider gesetzt ist (für Token-Loading)
  if ('setUserEmail' in provider && typeof provider.setUserEmail === 'function') {
    (provider as unknown as { setUserEmail?: (e: string) => void }).setUserEmail?.(userEmail);
  }
  
  const validation = await provider.validateConfiguration();
  if (!validation.isValid) throw new Error(validation.error || 'Ungültige Provider-Konfiguration');
  return provider;
}




