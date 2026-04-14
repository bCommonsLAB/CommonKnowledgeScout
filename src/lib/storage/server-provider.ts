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
import { isCoCreatorOrOwner } from '@/lib/repositories/library-members-repo';
import type { Library } from '@/types/library';

/**
 * Erstellt einen Storage-Provider fuer serverseitige API-Routen.
 * 
 * Ablauf:
 * 1. Zuerst in eigenen Libraries des Users suchen
 * 2. Falls nicht gefunden: Library owner-unabhaengig laden und Co-Creator-Rolle pruefen
 *    (ermoeglicht kollaboratives Arbeiten auf derselben libraryId)
 */
export async function getServerProvider(userEmail: string, libraryId: string): Promise<StorageProvider> {
  const baseUrl = getSelfBaseUrl();
  const libraryService = LibraryService.getInstance();

  // 1) Eigene Libraries pruefen (Standard-Fall)
  let lib: Library | null = null;
  const ownLibraries = await libraryService.getUserLibraries(userEmail);
  lib = ownLibraries.find(l => l.id === libraryId) || null;

  // 2) Fallback: Library owner-unabhaengig laden + Co-Creator-Berechtigung pruefen
  if (!lib) {
    lib = await libraryService.getLibraryById(libraryId);
    if (!lib) {
      throw new Error('Library nicht gefunden');
    }
    
    const hasAccess = await isCoCreatorOrOwner(libraryId, userEmail);
    if (!hasAccess) {
      throw new Error('Keine Berechtigung fuer diese Library');
    }
  }

  const factory = StorageFactory.getInstance();
  factory.setApiBaseUrl(baseUrl);
  factory.setUserEmail(userEmail);
  // Server-Kontext aktivieren: Erstellt direkte Provider (z.B. WebDAV)
  // statt HTTP-Proxies, die eine Clerk-Session benoetigen wuerden.
  factory.setServerContext(true);
  factory.setLibraries([{ 
    id: lib.id,
    label: lib.label,
    type: lib.type,
    path: lib.path,
    isEnabled: lib.isEnabled,
    config: (lib.config as unknown as Record<string, unknown>) || {}
  }]);

  // Cache leeren, damit ein frischer Provider mit aktuellen DB-Credentials erstellt wird.
  // Ohne dies wuerde ein gecachter Provider mit veralteten Zugangsdaten zurueckgegeben,
  // weil setLibraries den Cache nur bei geaenderten IDs leert (nicht bei Config-Aenderungen).
  await factory.clearProvider(lib.id);

  const provider = await factory.getProvider(lib.id);
  
  // Stelle sicher, dass userEmail im Provider gesetzt ist (fuer Token-Loading)
  if ('setUserEmail' in provider && typeof provider.setUserEmail === 'function') {
    (provider as unknown as { setUserEmail?: (e: string) => void }).setUserEmail?.(userEmail);
  }
  
  const validation = await provider.validateConfiguration();
  if (!validation.isValid) throw new Error(validation.error || 'Ungueltige Provider-Konfiguration');
  return provider;
}




