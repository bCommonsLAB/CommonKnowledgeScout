import { StorageFactory } from '@/lib/storage/storage-factory';
import type { StorageProvider } from '@/lib/storage/types';
import { LibraryService } from '@/lib/services/library-service';

export async function getServerProvider(userEmail: string, libraryId: string): Promise<StorageProvider> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || '';

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
  const validation = await provider.validateConfiguration();
  if (!validation.isValid) throw new Error(validation.error || 'Ungültige Provider-Konfiguration');
  return provider;
}




