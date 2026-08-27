/**
 * @fileoverview Adressierung der Storage-Werkzeuge: Pfad UND Id (Welle ST2).
 *
 * @description
 * Das Adressierungsproblem aus den Anforderungen (§1), das vor allen
 * Werkzeugen zu klaeren war:
 *
 * - **A1** Jede Antwort liefert Pfad UND Id. Nie nur eines.
 * - **A2** Jedes Werkzeug akzeptiert beides als Adresse.
 * - **A4** `pfad_aufloesen` gibt es als eigenstaendige, billige Operation.
 *
 * Der Beleg dafuer ist konkret: Als `stand_setzen` die `_INDEX.md` noch
 * ersetzte statt aenderte, lief der naechste Schreibversuch auf die
 * gespeicherte Id in ein `NOT_FOUND`, und der Pfad musste neu aufgeloest
 * werden. Wer beides in der Hand hat, kann sich selbst erholen.
 *
 * @module mcp/storage
 */

import { z } from 'zod'
import type { StorageProvider } from '@/lib/storage/types'
import { resolveItemByPath } from '../resolve-folder'

export const ADRESSE_PFAD = z
  .string()
  .min(1)
  .optional()
  .describe('Library-relativer Pfad, z. B. "26.01 Klima/BERICHT.md". Alternative zu `id` — genau eines von beiden angeben.')

export const ADRESSE_ID = z
  .string()
  .min(1)
  .optional()
  .describe('Storage-Id des Items. Alternative zu `pfad` — genau eines von beiden angeben.')

/** Ein aufgeloestes Item, immer mit BEIDEN Adressen (A1). */
export interface Adresse {
  id: string
  pfad: string
  name: string
  typ: 'file' | 'folder'
}

/**
 * Loest `pfad` ODER `id` auf und liefert immer beides zurueck.
 *
 * Der Pfad zur Id kommt aus `getPathById` — die Umkehrung ist provider-seitig
 * billig, waehrend der Weg Pfad → Id ein Listing pro Segment kostet. Deshalb
 * ist `id` die guenstigere Adresse, sobald man sie einmal hat, und genau
 * darum liefern alle Werkzeuge sie mit.
 */
export async function loeseAdresse(args: {
  provider: StorageProvider
  pfad?: string
  id?: string
  erwartet: 'file' | 'folder'
}): Promise<Adresse> {
  const { provider, pfad, id, erwartet } = args

  if (pfad && id) throw new Error('Entweder `pfad` ODER `id` angeben — nicht beides')
  if (!pfad && !id) throw new Error('`pfad` oder `id` angeben')

  if (pfad) {
    const item = await resolveItemByPath(provider, pfad, erwartet)
    return { id: item.id, pfad: normalisiere(pfad), name: item.name, typ: item.type }
  }

  const item = await provider.getItemById(id as string)
  if (item.type !== erwartet) {
    throw new Error(
      `Item ${id} ist ${item.type === 'folder' ? 'ein Ordner' : 'eine Datei'}, ` +
      `erwartet wurde ${erwartet === 'folder' ? 'ein Ordner' : 'eine Datei'}`,
    )
  }
  return {
    id: item.id,
    pfad: normalisiere(await provider.getPathById(item.id)),
    name: item.metadata.name,
    typ: item.type,
  }
}

/** Library-relativer Pfad ohne fuehrende/abschliessende Slashes. */
export function normalisiere(pfad: string): string {
  return pfad.replace(/^\/+|\/+$/g, '')
}

/** Pfad eines Kindes unter `elternPfad` — leerer Elternpfad = Wurzel. */
export function kindPfad(elternPfad: string, name: string): string {
  const eltern = normalisiere(elternPfad)
  return eltern ? `${eltern}/${name}` : name
}
