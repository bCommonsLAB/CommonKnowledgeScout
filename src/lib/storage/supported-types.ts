/**
 * @fileoverview Supported Library Types - Storage Provider Type Definitions
 * 
 * @description
 * Central definition of supported library types for storage providers. Used by
 * StorageFactory and StorageContext to validate and create appropriate providers.
 * Currently supports 'local' and 'onedrive' types.
 * 
 * @module storage
 * 
 * @exports
 * - SUPPORTED_LIBRARY_TYPES: Array of supported library types
 * - SupportedLibraryType: Type for supported library types
 * - isSupportedLibraryType: Type guard function
 * - getSupportedLibraryTypesString: Helper function for UI display
 * 
 * @usedIn
 * - src/lib/storage/storage-factory.ts: Factory uses types for validation
 * - src/contexts/storage-context.tsx: Context uses types for validation
 * - src/hooks/use-storage-provider.tsx: Hook uses types for validation
 * 
 * @dependencies
 * - None (pure type definitions and utilities)
 */

export const SUPPORTED_LIBRARY_TYPES = ['local', 'onedrive'] as const;
export type SupportedLibraryType = typeof SUPPORTED_LIBRARY_TYPES[number];

/**
 * Hilfsfunktion zur Überprüfung ob ein Bibliothekstyp unterstützt ist
 */
export const isSupportedLibraryType = (type: string): type is SupportedLibraryType => {
  return SUPPORTED_LIBRARY_TYPES.includes(type as SupportedLibraryType);
};

/**
 * Gibt eine benutzerfreundliche Liste der unterstützten Typen zurück
 */
export const getSupportedLibraryTypesString = (): string => {
  return SUPPORTED_LIBRARY_TYPES.join(', ');
};
