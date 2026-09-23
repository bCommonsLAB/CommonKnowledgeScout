/**
 * @fileoverview Identitaet einer Quelle ueber den Umzug hinweg verfolgen.
 *
 * @description
 * `move-family.ts` ging von stabilen Provider-Ids aus (OneDrive). Auf Nextcloud
 * und Filesystem ist die Id der base64-kodierte Pfad: Umbenennen und
 * Verschieben ergeben eine NEUE Id (Befund 23.09.2026). Hier liegt, was mit
 * der Id-Aenderung zu tun ist — Storage-Id nach dem Verschieben ermitteln und
 * das Schaufenster (Vektor-Sammlung) nachziehen. Beides provider-neutral: Wer
 * stabile Ids hat, bekommt dieselbe Id zurueck und nichts wird umgeschrieben.
 *
 * @module shadow-twin
 */

import type { Library } from '@/types/library'
import type { StorageProvider } from '@/lib/storage/types'
import { getCollectionNameForLibrary } from '@/lib/repositories/vector-repo'
import { rekeyVectorsFileId } from '@/lib/repositories/vector-rekey'
import { FileLogger } from '@/lib/debug/logger'

/**
 * `moveItem` liefert keine Id zurueck. Die Datei wird danach im Zielordner
 * ueber ihren Namen gefunden — fuer stabile Ids ergibt das dieselbe Id.
 */
export async function findeIdNachVerschieben(
  provider: StorageProvider,
  parentId: string,
  name: string,
): Promise<string> {
  const items = await provider.listItemsById(parentId)
  const treffer = items.filter((item) => item.type === 'file' && item.metadata.name === name)
  if (treffer.length !== 1) {
    throw new Error(
      `Nach dem Verschieben ${treffer.length === 0 ? 'nicht' : 'mehrfach'} im Zielordner gefunden: "${name}" (parentId=${parentId})`,
    )
  }
  return treffer[0].id
}

export interface SchaufensterNachzug {
  /** null = Library hat keine Vektor-Sammlung konfiguriert (nichts nachzuziehen). */
  umgeschrieben: number | null
}

/** Schaufenster-Eintrag der Quelle auf die neue Id umschreiben (nur bei Id-Wechsel). */
export async function zieheSchaufensterNach(args: {
  library: Library
  alteSourceId: string
  neueSourceId: string
}): Promise<SchaufensterNachzug> {
  const { library, alteSourceId, neueSourceId } = args
  if (alteSourceId === neueSourceId) return { umgeschrieben: 0 }
  const collectionName = library.config?.chat?.vectorStore?.collectionName?.trim()
  if (!collectionName) {
    FileLogger.info('move-family', 'Keine Vektor-Sammlung konfiguriert — Schaufenster nicht nachgezogen', {
      libraryId: library.id, alteSourceId, neueSourceId,
    })
    return { umgeschrieben: null }
  }
  const { umgeschrieben } = await rekeyVectorsFileId(getCollectionNameForLibrary(library), alteSourceId, neueSourceId)
  return { umgeschrieben }
}
