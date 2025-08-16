/**
 * Zentrale Definition der unterstützten Bibliothekstypen
 * Wird von StorageFactory und StorageContext verwendet
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
