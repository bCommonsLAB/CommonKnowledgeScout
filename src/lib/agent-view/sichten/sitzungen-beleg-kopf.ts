/**
 * @fileoverview Beleg-Koepfe lesen und am Twin merken (S1b).
 *
 * @description
 * `vorhaben:`, `hauptvorhaben:` und `ende:` stehen nur im Beleg selbst, nicht
 * in der Notiz-Transformation, und Markdown-Quellen haben kein Transkript am
 * Twin. 240 Dateien bei jedem Lauf aus OneDrive zu lesen waere zu langsam,
 * darum liest der Lauf einen Kopf nur, wenn der Merker fehlt oder die Datei
 * laut Ordner-Listing juenger ist als beim letzten Lesen, und schreibt ihn
 * sofort an den Twin — ein abgebrochener Lauf verliert so nichts. Lesefehler
 * treffen EINE Datei und stehen in `fehler`, nie still. Ports statt Storage,
 * damit die Logik ohne Provider testbar ist.
 *
 * @module agent-view/sichten
 */

import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import type { TransformationZeile } from '@/lib/repositories/shadow-twin-transformationen'

/** Der Provider vertraegt nur wenige parallele Downloads (Pilot-Befund: 4). */
export const BELEG_LESE_PARALLEL = 4

export interface BelegKopfPorts {
  /** Markdown-Text der Quelle. */
  lesen: (sourceId: string) => Promise<string>
  /** Merker ans Twin schreiben. */
  speichern: (sourceId: string, fields: Record<string, unknown>, sourceModifiedAt: string | null) => Promise<void>
}

export interface BelegKoepfeStatistik {
  gelesen: number
  ausMerker: number
  /** Belege, deren Kopf unbekannt bleibt (Lesefehler) — sie laufen ohne Querverweise weiter. */
  fehler: string[]
}

/** Merker brauchbar? Ohne Listing-Zeit (Datei nicht im Scan) gilt der Merker; sonst muss die Zeit stimmen. */
export function merkerGilt(zeile: TransformationZeile, dateiZeit: string | null | undefined): boolean {
  if (zeile.sourceFrontmatter === null) return false
  if (dateiZeit === undefined || dateiZeit === null) return true
  return zeile.sourceFrontmatter.sourceModifiedAt === dateiZeit
}

/**
 * Ergaenzt fehlende oder veraltete Beleg-Koepfe. `dateiZeit`: fileId → `modifiedAt`
 * aus dem Scan (fehlt = Datei nicht gescannt). Liefert neue Zeilen; die Eingabe
 * bleibt unveraendert.
 */
export async function ergaenzeBelegKoepfe(args: {
  zeilen: readonly TransformationZeile[]
  dateiZeit: ReadonlyMap<string, string | null>
  ports: BelegKopfPorts
  parallel?: number
}): Promise<{ zeilen: TransformationZeile[]; statistik: BelegKoepfeStatistik }> {
  const parallel = args.parallel ?? BELEG_LESE_PARALLEL
  const statistik: BelegKoepfeStatistik = { gelesen: 0, ausMerker: 0, fehler: [] }
  const ergebnis: TransformationZeile[] = [...args.zeilen]
  const offen: number[] = []
  ergebnis.forEach((zeile, i) => {
    if (merkerGilt(zeile, args.dateiZeit.get(zeile.sourceId))) statistik.ausMerker += 1
    else offen.push(i)
  })
  for (let start = 0; start < offen.length; start += parallel) {
    await Promise.all(
      offen.slice(start, start + parallel).map(async (i) => {
        const zeile = ergebnis[i]
        const zeit = args.dateiZeit.get(zeile.sourceId) ?? null
        try {
          const { meta } = parseFrontmatter(await args.ports.lesen(zeile.sourceId))
          await args.ports.speichern(zeile.sourceId, meta, zeit)
          ergebnis[i] = { ...zeile, sourceFrontmatter: { fields: meta, sourceModifiedAt: zeit } }
          statistik.gelesen += 1
        } catch (error) {
          statistik.fehler.push(`${zeile.sourceName}: ${error instanceof Error ? error.message : String(error)}`)
        }
      }),
    )
  }
  return { zeilen: ergebnis, statistik }
}
