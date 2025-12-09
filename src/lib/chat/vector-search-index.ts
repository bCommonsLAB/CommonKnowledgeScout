/**
 * @fileoverview Vector Search Index Definition Builder
 * 
 * Generiert MongoDB Atlas Vector Search Index-Definitionen dynamisch
 * basierend auf Library-Facetten-Konfiguration.
 * 
 * Diese Datei enthält KEINE MongoDB-Imports, damit sie auch im Client verwendet werden kann.
 */

import type { Library } from '@/types/library'
import { parseFacetDefs } from '@/lib/chat/dynamic-facets'
import { getEmbeddingDimensionForModel } from '@/lib/chat/config'

/**
 * Name des MongoDB Vector Search Index (konsistent mit vector-repo.ts)
 * WICHTIG: Diese Konstante muss hier definiert werden, damit vector-search-index.ts
 * keine MongoDB-Imports benötigt und im Client verwendet werden kann.
 */
export const VECTOR_SEARCH_INDEX_NAME = 'vector_search_idx'

/**
 * Baut die Vector Search Index-Definition dynamisch aus der Library-Config.
 * Generiert Indexe für ALLE Facetten basierend auf ihrem Typ:
 * - string[] → token (für Array-Filterung)
 * - number → number
 * - date → date
 * - string/boolean → token (da buildFilterFromQuery immer $in verwendet)
 * 
 * WICHTIG: MongoDB Vector Search benötigt Token-Indexe für alle Felder, die mit $in verwendet werden.
 * Da buildFilterFromQuery für String-Facetten IMMER $in verwendet (auch bei einem Wert),
 * müssen alle String-Facetten als Token-Indexe definiert werden.
 * 
 * @param library Library-Objekt mit Config
 * @param dimension Embedding-Dimension
 * @returns Index-Definition als JSON-Objekt
 */
export function buildVectorSearchIndexDefinition(
  library: Library,
  dimension: number
): {
  name: string
  definition: {
    mappings: {
      dynamic: boolean
      fields: Record<string, { type: string; dimensions?: number; similarity?: string }>
    }
  }
} {
  const indexName = VECTOR_SEARCH_INDEX_NAME
  const facetDefs = parseFacetDefs(library)
  
  // Basis-Felder immer enthalten
  // WICHTIG: libraryId, user und fileId müssen als Token-Indexe definiert sein, wenn sie in Filtern mit $eq/$in verwendet werden
  // MongoDB Atlas Vector Search benötigt Token-Indexe für alle Filter-Felder, die mit Operatoren verwendet werden
  const fields: Record<string, { type: string; dimensions?: number; similarity?: string }> = {
    embedding: {
      type: 'knnVector',
      dimensions: dimension,
      similarity: 'cosine',
    },
    kind: {
      type: 'token',
    },
    libraryId: {
      type: 'token', // Token statt string, da in Filtern mit $eq verwendet
    },
    user: {
      type: 'token', // Token statt string, da in Filtern mit $eq verwendet
    },
    fileId: {
      type: 'token', // Token statt string, da in Filtern mit $in verwendet (z.B. fileId: { $in: [...] })
    },
  }
  
  // Dynamisch: Indexe für ALLE Facetten basierend auf ihrem Typ
  for (const def of facetDefs) {
    if (!def.metaKey) continue
    
    // Überspringe wenn bereits vorhanden (z.B. libraryId, user)
    if (fields[def.metaKey]) continue
    
    // Bestimme Index-Typ basierend auf Facetten-Typ
    if (def.type === 'string[]') {
      // Array-Facetten: Token-Index für Array-Filterung
      fields[def.metaKey] = {
        type: 'token',
      }
    } else if (def.type === 'number') {
      // Zahlen-Facetten: Number-Index
      fields[def.metaKey] = {
        type: 'number',
      }
    } else if (def.type === 'date') {
      // Datum-Facetten: Date-Index
      fields[def.metaKey] = {
        type: 'date',
      }
    } else {
      // String-Facetten (string, boolean): Token-Index
      // WICHTIG: buildFilterFromQuery verwendet IMMER $in für String-Facetten (auch bei einem Wert)
      // MongoDB Vector Search benötigt Token-Indexe für alle Felder, die mit $in verwendet werden
      fields[def.metaKey] = {
        type: 'token',
      }
    }
  }
  
  return {
    name: indexName,
    definition: {
      mappings: {
        dynamic: true, // Alle Felder werden automatisch indiziert (inkl. Filter-Felder)
        fields,
      },
    },
  }
}

/**
 * Hilfsfunktion: Generiert Index-Definition für eine Library mit automatischer Dimension-Erkennung.
 * @param library Library-Objekt mit Config
 * @returns Index-Definition als JSON-Objekt
 */
export function buildVectorSearchIndexDefinitionForLibrary(library: Library): {
  name: string
  definition: {
    mappings: {
      dynamic: boolean
      fields: Record<string, { type: string; dimensions?: number; similarity?: string }>
    }
  }
} {
  const dimension = getEmbeddingDimensionForModel(library.config?.chat)
  return buildVectorSearchIndexDefinition(library, dimension)
}

/**
 * Bereinigt einen String für die Verwendung als Collection-Name.
 * Entfernt ungültige Zeichen und begrenzt die Länge.
 */
function safeCollectionName(s: string): string {
  return s.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 60)
}

/**
 * Ermittelt den MongoDB Collection-Namen für eine Library.
 * Verwendet den Wert aus der Config (deterministisch).
 * Falls nicht vorhanden, berechnet einen Fallback-Namen basierend auf der Library-ID.
 * 
 * WICHTIG: Diese Funktion hat KEINE MongoDB-Imports und kann im Client verwendet werden.
 * Sie hat einen Fallback-Mechanismus, während die Server-Version in vector-repo.ts einen Fehler wirft.
 * 
 * Für Server-Verwendung: Verwende getCollectionNameForLibrary() aus @/lib/repositories/vector-repo
 * 
 * @param library Die Library mit Config
 * @returns Der Collection-Name (aus Config oder Fallback)
 */
export function getCollectionNameForLibrary(library: Library): string {
  const collectionName = library.config?.chat?.vectorStore?.collectionName
  if (collectionName && collectionName.trim().length > 0) {
    return collectionName
  }
  
  // Fallback: Berechne Collection-Namen basierend auf Library-ID
  // Dies entspricht der Logik von computeDocMetaCollectionName mit strategy 'per_library'
  const safeId = safeCollectionName(library.id)
  return `doc_meta__${safeId}`
}

