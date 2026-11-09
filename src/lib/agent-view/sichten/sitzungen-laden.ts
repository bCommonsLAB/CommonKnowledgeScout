/**
 * @fileoverview Sitzungen laden: MongoDB → Beleg-Koepfe → Zuordnung (S1/S1b, I/O).
 *
 * @description
 * Der eine Weg fuer `sichten_regenerieren` und `sitzungen_block_schreiben`:
 * Transformationen der Sitzungs-Vorlage lesen, fehlende Beleg-Koepfe aus dem
 * Storage nachziehen und am Twin merken, dann die Zuordnung zu den Vorhaben
 * des uebergebenen Scans. Im Teilbaum-Scope zaehlen Belege ausserhalb der
 * gescannten Ordner als `nichtImScope` — sie werden weder gelesen noch
 * zugeordnet (kein Aufstieg ueber den Scope hinaus).
 *
 * @module agent-view/sichten
 */

import type { ArchiveFolderNode } from '../archive-types'
import { findeTransformationenNachVorlage, setzeQuellFrontmatter } from '@/lib/repositories/shadow-twin-transformationen'
import type { StorageProvider } from '@/lib/storage/types'
import { ergaenzeBelegKoepfe, type BelegKoepfeStatistik } from './sitzungen-beleg-kopf'
import { elternVonProvider, ordneSitzungenZu, type SitzungenZuordnung } from './sitzungen-sammeln'
import { SITZUNGS_SPRACHE, SITZUNGS_VORLAGE } from './sitzungen-types'

export interface GeladeneSitzungen {
  zuordnung: SitzungenZuordnung
  belegKoepfe: BelegKoepfeStatistik
  /** Nur im Teilbaum-Scope > 0: Belege in Ordnern, die der Scan nicht kennt. */
  nichtImScope: number
}

/** fileId → modifiedAt aller Dateien des Scans (die Belege liegen in den Vorhabensordnern). */
export function dateiZeiten(folders: readonly ArchiveFolderNode[]): Map<string, string | null> {
  const zeiten = new Map<string, string | null>()
  for (const f of folders) for (const file of f.files) zeiten.set(file.fileId, file.modifiedAt)
  return zeiten
}

export async function ladeSitzungen(args: {
  libraryId: string
  provider: StorageProvider
  folders: readonly ArchiveFolderNode[]
  vorhabenMuster: RegExp | null
  /** true = Teilbaum: nur Belege in gescannten Ordnern. */
  nurGescannte: boolean
}): Promise<GeladeneSitzungen> {
  const { libraryId, provider } = args
  const alle = await findeTransformationenNachVorlage({ libraryId, template: SITZUNGS_VORLAGE, language: SITZUNGS_SPRACHE })
  const gescannt = new Set(args.folders.map((f) => f.folderId))
  const zeilen = args.nurGescannte ? alle.filter((z) => gescannt.has(z.parentId)) : alle
  const koepfe = await ergaenzeBelegKoepfe({
    zeilen,
    dateiZeit: dateiZeiten(args.folders),
    ports: {
      lesen: async (sourceId) => (await provider.getBinary(sourceId)).blob.text(),
      speichern: (sourceId, fields, sourceModifiedAt) => setzeQuellFrontmatter({ libraryId, sourceId, fields, sourceModifiedAt }),
    },
  })
  const zuordnung = await ordneSitzungenZu({
    zeilen: koepfe.zeilen, folders: args.folders, vorhabenMuster: args.vorhabenMuster, elternVon: elternVonProvider(provider),
  })
  return { zuordnung, belegKoepfe: koepfe.statistik, nichtImScope: alle.length - zeilen.length }
}
