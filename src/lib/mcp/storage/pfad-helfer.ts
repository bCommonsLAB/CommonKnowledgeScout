/**
 * @fileoverview Pfad-Helfer der Storage-Werkzeuge (Welle ST4).
 *
 * @module mcp/storage
 */

import type { StorageProvider } from '@/lib/storage/types'
import { normalisiere } from './adressierung'

/**
 * Loest einen Ordnerpfad auf, legt ihn bei Bedarf segmentweise an.
 *
 * Ohne `anlegen` wirft ein fehlendes Segment — und die Meldung nennt, WO es
 * fehlt. Ein stilles Anlegen waere die gefaehrlichere Variante: ein Tippfehler
 * im Pfad erzeugte lautlos einen zweiten, fast gleich heissenden Ordner.
 */
export async function ordnerSicherstellen(
  provider: StorageProvider,
  pfad: string,
  anlegen: boolean,
): Promise<string> {
  const segmente = normalisiere(pfad).split('/').filter(Boolean)
  let aktuell = 'root'
  const gegangen: string[] = []
  for (const segment of segmente) {
    const kinder = await provider.listItemsById(aktuell)
    const treffer = kinder.find((k) => k.type === 'folder' && k.metadata.name === segment)
    if (treffer) {
      aktuell = treffer.id
    } else {
      if (!anlegen) {
        throw new Error(
          `Ordner "${segment}" fehlt unter "${gegangen.join('/') || '(Wurzel)'}" — ` +
          'mit elternAnlegen: true anlegen lassen oder Pfad pruefen.',
        )
      }
      aktuell = (await provider.createFolder(aktuell, segment)).id
    }
    gegangen.push(segment)
  }
  return aktuell
}

/** Trennt "a/b/c.md" in Elternpfad und Namen. */
export function trenne(pfad: string): { eltern: string; name: string } {
  const teile = normalisiere(pfad).split('/').filter(Boolean)
  if (teile.length === 0) throw new Error('Leerer Pfad')
  return { eltern: teile.slice(0, -1).join('/'), name: teile[teile.length - 1] }
}
