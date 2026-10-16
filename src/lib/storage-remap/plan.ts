/**
 * @fileoverview Zuordnung alte Storage-Id → neue Storage-Id aus zwei Schnappschuessen.
 *
 * @description
 * Rein und ohne I/O (testbar). Schluessel ist der library-relative Pfad in
 * Unicode-NFC: OneDrive und Nextcloud koennen Umlaute unterschiedlich
 * normalisiert melden, der Name ist trotzdem derselbe. Was im neuen Speicher
 * keinen Partner hat, wird benannt, nicht geraten (no-silent-fallbacks).
 *
 * @module storage-remap
 */

import type { SnapshotEntry, StorageSnapshot } from './snapshot'

export interface RemapPlan {
  /** alte Id → neue Id; nur Eintraege, deren Id sich aendert. */
  idMap: Map<string, string>
  /** Alte Eintraege ohne Partner im neuen Speicher (Pfad fehlt oder Typ anders). */
  ohnePartner: Array<SnapshotEntry & { grund: string }>
  /** Anzahl neuer Eintraege ohne alten Partner (neu hinzugekommen). */
  nurNeu: number
  /** Anteil der alten Eintraege, deren Id gleich geblieben ist (0..1). */
  anteilGleicheIds: number
}

function key(relPath: string): string {
  return relPath.normalize('NFC')
}

/** Die eine parentId, mit der der neue Speicher seine Wurzel meldet. */
function neueWurzelId(neu: StorageSnapshot): string {
  const kandidaten = neu.rootParentIds.filter((id) => id !== 'root')
  if (kandidaten.length === 0) return 'root'
  if (kandidaten.length > 1) {
    throw new Error(`Neuer Speicher meldet mehrere Wurzel-Ids (${kandidaten.join(', ')}) — Zuordnung nicht eindeutig`)
  }
  return kandidaten[0]
}

export function planRemap(alt: StorageSnapshot, neu: StorageSnapshot): RemapPlan {
  if (alt.libraryId !== neu.libraryId) {
    throw new Error(`Schnappschuesse gehoeren zu verschiedenen Libraries (${alt.libraryId} / ${neu.libraryId})`)
  }
  const neuNachPfad = new Map<string, SnapshotEntry>()
  for (const e of neu.entries) {
    const k = key(e.relPath)
    if (neuNachPfad.has(k)) throw new Error(`Pfad im neuen Speicher doppelt (nach NFC): "${e.relPath}"`)
    neuNachPfad.set(k, e)
  }

  const idMap = new Map<string, string>()
  const ohnePartner: RemapPlan['ohnePartner'] = []
  const getroffen = new Set<string>()
  let gleich = 0

  for (const e of alt.entries) {
    const partner = neuNachPfad.get(key(e.relPath))
    if (!partner) {
      ohnePartner.push({ ...e, grund: 'Pfad fehlt im neuen Speicher' })
      continue
    }
    if (partner.type !== e.type) {
      ohnePartner.push({ ...e, grund: `Typ ${e.type} im alten, ${partner.type} im neuen Speicher` })
      continue
    }
    getroffen.add(key(e.relPath))
    if (partner.id === e.id) gleich++
    else idMap.set(e.id, partner.id)
  }

  const wurzelNeu = neueWurzelId(neu)
  for (const id of alt.rootParentIds) {
    if (id !== wurzelNeu) idMap.set(id, wurzelNeu)
  }

  return {
    idMap,
    ohnePartner,
    nurNeu: neu.entries.filter((e) => !getroffen.has(key(e.relPath))).length,
    anteilGleicheIds: alt.entries.length === 0 ? 0 : gleich / alt.entries.length,
  }
}
