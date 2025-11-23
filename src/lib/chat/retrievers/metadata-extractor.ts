import { getTopLevelValue, type FacetDef } from '@/lib/chat/dynamic-facets'

/**
 * Extrahiert Metadaten aus einem Metadaten-Objekt basierend auf Facetten-Definitionen.
 * Nutzt die gleiche Logik wie getTopLevelValue() für konsistente Typ-Konvertierung.
 * 
 * @param meta - Das Metadaten-Objekt (z.B. aus Pinecone oder MongoDB)
 * @param facetDefs - Array von Facetten-Definitionen aus der Library-Config
 * @returns Record mit extrahierten Metadaten (metaKey -> Wert), nur Felder mit vorhandenen Werten
 */
export function extractFacetMetadata(
  meta: Record<string, unknown> | undefined,
  facetDefs: FacetDef[]
): Record<string, unknown> {
  if (!meta || typeof meta !== 'object') return {}
  const result: Record<string, unknown> = {}
  
  for (const def of facetDefs) {
    const value = getTopLevelValue(meta, def)
    if (value !== undefined && value !== null) {
      result[def.metaKey] = value
    }
  }
  
  return result
}










































