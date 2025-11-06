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




