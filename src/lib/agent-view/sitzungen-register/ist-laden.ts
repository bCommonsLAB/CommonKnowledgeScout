/**
 * @fileoverview Register-Sicht laden: Register + Notizen + bekannte Belege (Register, Welle R1, I/O).
 *
 * @description
 * Liest NUR: das Register, die Transformationen der Vorlage `chatverlauf-de`
 * samt gemerktem Beleg-Kopf (MongoDB, ohne Speicher-Scan) und — nur fuer die
 * wenigen `belegSourceIds` ohne Notiz — das Speicher-Item per `getItemById`.
 * Ein Beleg, den der Speicher nicht liefert, wird Hinweis `beleg_fehlt`, kein
 * stilles Weglassen. Zeilen aus dem Archiv ohne Register-Eintrag erscheinen
 * mit `gespeichert: false` (W3); gespeichert werden sie erst von einem
 * schreibenden Sichten-Lauf.
 *
 * @module agent-view/sitzungen-register
 */

import { SITZUNGS_SPRACHE, SITZUNGS_VORLAGE } from '@/lib/agent-view/sichten/sitzungen-types'
import { listeRegister } from '@/lib/repositories/agent-view-sitzungen-repo'
import { findeTransformationenNachVorlage } from '@/lib/repositories/shadow-twin-transformationen'
import { istAusTransformation, istOhneNotiz } from './ist-beleg'
import { ordneIstZu } from './ist-zuordnen'
import { zuSicht } from './stand-rechnen'
import type { IstBeleg, SitzungsSicht } from './types'

/** Der Provider vertraegt nur wenige parallele Zugriffe (Pilot-Befund: 4). */
const LESE_PARALLEL = 4

/** Liest ein Speicher-Item; wirft, wenn es fehlt. */
export type ItemLesen = (sourceId: string) => Promise<{ id: string; parentId: string; name: string }>

export interface RegisterSicht {
  zeilen: SitzungsSicht[]
  /** Wie viele Belege ohne Notiz im Speicher nachgesehen wurden. */
  imSpeicherGeprueft: number
}

export async function ladeRegisterSicht(args: { libraryId: string; itemLesen: ItemLesen; jetzt: string }): Promise<RegisterSicht> {
  const [docs, transformationen] = await Promise.all([
    listeRegister(args.libraryId),
    findeTransformationenNachVorlage({ libraryId: args.libraryId, template: SITZUNGS_VORLAGE, language: SITZUNGS_SPRACHE }),
  ])
  const belege: IstBeleg[] = transformationen.map(istAusTransformation)
  const bekannt = new Set(belege.map((b) => b.sourceId))
  const offen = [...new Set(docs.flatMap((d) => d.belegSourceIds))].filter((id) => !bekannt.has(id))

  const fehlend = new Map<string, string>()
  for (let start = 0; start < offen.length; start += LESE_PARALLEL) {
    await Promise.all(
      offen.slice(start, start + LESE_PARALLEL).map(async (sourceId) => {
        try {
          belege.push(istOhneNotiz(await args.itemLesen(sourceId)))
        } catch (error) {
          fehlend.set(sourceId, error instanceof Error ? error.message : String(error))
        }
      }),
    )
  }
  const zeilen = ordneIstZu({ libraryId: args.libraryId, docs, belege, jetzt: args.jetzt }).map((z) => zuSicht(z, fehlend))
  return { zeilen, imSpeicherGeprueft: offen.length }
}
