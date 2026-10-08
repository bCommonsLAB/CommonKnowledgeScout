/**
 * @fileoverview Quellen fuer `index_aktualisieren` sammeln und begrenzen (Welle C, Handover W4).
 *
 * @description
 * Befund T9 (Brueckentest 2.44): `index_aktualisieren` ueber einen Ordner
 * brachte jede Quelle mit IRGENDEINER Transformation in die Galerie — sechs
 * alte `standard-meeting`-Zwischenstaende erschienen neu (4 → 10). Der Index
 * soll dem Twin folgen, nicht den Bestand erweitern. Deshalb:
 * - `nurPublizierte` (Vorgabe true): nur Quellen, die schon einen Eintrag im
 *   Index haben; Neues kommt ueber `dokument_publizieren` herein.
 * - `vorlage`: nur Quellen, deren Transformation diese Vorlage traegt.
 * - Zeilen nennen den Pfad, nicht nur den Dateinamen (der Flyer stand doppelt).
 * Uebersprungenes wird je Zeile mit Grund genannt, nicht still verworfen.
 *
 * @module mcp
 */

import { ZAUN_BESCHREIBUNG } from '@/lib/pipeline/batch-zaun'
import type { StorageProvider } from '@/lib/storage/types'
import { sammleOrdnerQuellen } from './ordner-quellen'
import { resolveScope } from './tool-shared'
import { resolveSourceItem, type ResolvedSource } from './tools-erschliessen-shared'

export const MAX_STAPEL = 30
export const MAX_ORDNER = 200

export interface Kandidat {
  source: ResolvedSource
  /** Anzeigepfad der Zeile (library-relativ, soweit bekannt). */
  anzeige: string
}

export async function quellenAusAufruf(args: {
  provider: StorageProvider
  userEmail: string
  libraryId: string
  sourceIds?: string[]
  ordner?: string
  ordnerId?: string
  rekursiv?: boolean
}): Promise<{ kandidaten: Kandidat[]; fehler: Array<{ quelle: string; fehler: string }>; zaun: Record<string, unknown> }> {
  const stapel = Array.isArray(args.sourceIds) && args.sourceIds.length > 0
  const ordner = Boolean(args.ordner) || Boolean(args.ordnerId)
  if (stapel && ordner) throw new Error('Entweder sourceIds ODER ordner/ordnerId — nicht beides')
  if (!stapel && !ordner) throw new Error('sourceIds oder ordner/ordnerId ist Pflicht')
  if (stapel) {
    const kandidaten: Kandidat[] = []
    const fehler: Array<{ quelle: string; fehler: string }> = []
    for (const id of args.sourceIds ?? []) {
      try {
        const source = await resolveSourceItem(args.provider, id)
        kandidaten.push({ source, anzeige: (await args.provider.getPathById(source.itemId)).replace(/^\/+/, '') })
      } catch (error) {
        fehler.push({ quelle: id, fehler: error instanceof Error ? error.message : String(error) })
      }
    }
    return { kandidaten, fehler, zaun: {} }
  }
  const folderId = await resolveScope({ userEmail: args.userEmail, libraryId: args.libraryId, folderId: args.ordnerId, pfad: args.ordner })
  if (!folderId) throw new Error('Ordner nicht aufloesbar')
  const gesammelt = await sammleOrdnerQuellen({ provider: args.provider, folderId, rekursiv: args.rekursiv ?? false, maxQuellen: MAX_ORDNER })
  const praefix = args.ordner ? args.ordner.replace(/^\/+|\/+$/g, '') : ''
  return {
    kandidaten: gesammelt.quellen.map((source) => {
      const relativ = source.pfad ?? source.name
      return { source, anzeige: praefix ? `${praefix}/${relativ}` : relativ }
    }),
    fehler: [],
    zaun: {
      zaun: ZAUN_BESCHREIBUNG,
      uebersprungeneOrdner: gesammelt.uebersprungeneOrdner,
      uebersprungeneDateien: gesammelt.uebersprungeneDateien,
      ...(gesammelt.abgeschnitten ? { hinweis: `Nur die ersten ${MAX_ORDNER} Quellen genommen — Ordner enger fassen` } : {}),
    },
  }
}

export interface IndexAuswahl {
  /** Quelle bleibt im Stapel. */
  nehmen: boolean
  grund?: string
}

/**
 * Entscheidet je Quelle, ob sie in den Stapel kommt. Rein: `publiziert` kommt
 * aus der Index-Abfrage, `vorlagenDesTwins` sind die Vorlagennamen der
 * Transformationen in der Zielsprache am Twin.
 */
export function waehleFuerIndex(args: {
  publiziert: boolean
  nurPublizierte: boolean
  vorlagenDesTwins: string[]
  vorlage?: string
}): IndexAuswahl {
  if (args.nurPublizierte && !args.publiziert) {
    return { nehmen: false, grund: 'nicht publiziert — nurPublizierte: false oder dokument_publizieren nimmt sie auf' }
  }
  if (args.vorlage && !args.vorlagenDesTwins.some((name) => name.toLowerCase() === args.vorlage?.toLowerCase())) {
    const vorhanden = args.vorlagenDesTwins.length > 0 ? args.vorlagenDesTwins.join(', ') : 'keine'
    return { nehmen: false, grund: `keine Transformation mit Vorlage ${args.vorlage} (vorhanden: ${vorhanden})` }
  }
  return { nehmen: true }
}
