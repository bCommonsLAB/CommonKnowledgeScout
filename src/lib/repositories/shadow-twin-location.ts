/**
 * @fileoverview Ort/Name — und bei Bedarf die Identitaet — eines Twin-Dokuments nachziehen.
 *
 * @description
 * Nach einem Familien-Umzug (move-family.ts) muessen `sourceName` und
 * `parentId` im Twin-Dokument dem neuen Storage-Zustand folgen. Auf Providern
 * mit pfadbasierten Ids (Nextcloud, Filesystem: base64 des Pfads) aendert ein
 * Umbenennen oder Verschieben auch die `sourceId` — dann wird das Dokument
 * umgeschluesselt (Befund 23.09.2026: der alte Schluessel blieb, Export und
 * Schaufenster liefen mit einer Id, die es nicht mehr gab).
 * Eigenes Modul statt Erweiterung von shadow-twin-repo.ts (Datei-Groessen-Limit).
 *
 * @module repositories
 */

import { getCollection } from '@/lib/mongodb-service'
import {
  getShadowTwinCollectionName,
  type ShadowTwinDocument,
} from '@/lib/repositories/shadow-twin-repo'

/**
 * Setzt `sourceName`/`parentId` des Twin-Dokuments; mit `newSourceId` (≠
 * `sourceId`) auch den Schluessel. Wirft, wenn kein Dokument existiert oder
 * der neue Schluessel schon belegt ist — still nichts zu tun waere ein
 * verschleierter Zustandsfehler (`no-silent-fallbacks`).
 */
export async function updateShadowTwinSourceLocation(args: {
  libraryId: string
  sourceId: string
  sourceName: string
  parentId: string
  newSourceId?: string
}): Promise<void> {
  const { libraryId, sourceId, sourceName, parentId } = args
  const newSourceId = args.newSourceId && args.newSourceId !== sourceId ? args.newSourceId : undefined
  const col = await getCollection<ShadowTwinDocument>(getShadowTwinCollectionName(libraryId))

  if (newSourceId) {
    // Der Index (libraryId, sourceId) ist unique — ein Duplikat wuerde die
    // Familie zerlegen statt umziehen.
    const belegt = await col.countDocuments({ libraryId, sourceId: newSourceId }, { limit: 1 })
    if (belegt > 0) {
      throw new Error(
        `updateShadowTwinSourceLocation: unter der neuen sourceId=${newSourceId} liegt schon ein Twin-Dokument — ` +
          'erst twins_pruefen/twins_synchronisieren, dann erneut umziehen',
      )
    }
  }

  const res = await col.updateOne(
    { libraryId, sourceId },
    {
      $set: {
        sourceName,
        parentId,
        ...(newSourceId ? { sourceId: newSourceId } : {}),
        updatedAt: new Date().toISOString(),
      },
    },
  )
  if (res.matchedCount === 0) {
    throw new Error(`updateShadowTwinSourceLocation: kein Twin-Dokument fuer sourceId=${sourceId}`)
  }
}
