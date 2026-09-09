/**
 * @fileoverview Stapel-Ausfuehrung fuer `themen_setzen` (Wunschliste 5, B3b).
 *
 * @description
 * Seit B3a darf jeder Ordner Themen tragen — und genau dadurch wird der
 * Einzelaufruf zum Engpass: `24.09 KnowledgeScout` hat 53 Ereignisordner,
 * das waeren 53 Aufrufe mit OneDrive-Latenz fuer EIN Vorhaben. Dieselbe
 * Luecke, die ST9 fuer die Umzuege geschlossen hat, hier fuer die Themen.
 *
 * Stapel-Semantik wie `fuehreStapelUmzugAus` (ST9): Ein Fehler bricht den
 * Stapel NICHT ab — jede Zeile traegt ihr eigenes Ergebnis, damit der Agent
 * gezielt nachfasst statt blind neu zu starten. Alle Ordner bekommen
 * DIESELBE Themenliste; wer verschiedene Listen vergeben will, ruft mehrmals
 * (eine gemeinsame Liste ist die Gruppe, nicht der Kompromiss).
 *
 * Das gilt auch fuer `erwarteteThemen`: Der Riegel gegen konkurrierende
 * Schreiber ist im Stapel derselbe Wert fuer alle. Fuer den Regelfall
 * (Ordner ohne Themen, `null`) passt das; ein Ordner, der doch schon welche
 * traegt, scheitert in SEINER Zeile — genau der Zweck des Riegels.
 *
 * @module mcp
 */

import type { ThemenErgebnis } from '@/lib/agent-view/themen-schreiben'

/** Obergrenze je Stapel — gleicher Wert wie bei Umzuegen und Erschliessungs-Jobs. */
export const MAX_THEMEN_ORDNER = 30

/** Ergebnis-Zeile: gesetzt ODER gescheitert, nie beides. */
export interface ThemenZeile {
  folderId: string
  themen?: string[]
  /** Das `_INDEX.md` gab es nicht und wurde nach Vorlage angelegt. */
  indexAngelegt?: true
  fehler?: string
  /** Fehler-Code des Schreibwegs (z. B. `kein_index`, `themen_widerspruch`). */
  code?: string
}

export interface StapelErgebnis {
  zeilen: ThemenZeile[]
  gesetzt: number
  gescheitert: number
  indexAngelegt: number
}

/** Genau EINE Adressierung: `folderId` oder `folderIds`, nie beides, nie keines. */
export function sammleOrdnerIds(args: { folderId?: string; folderIds?: readonly string[] }): string[] {
  const { folderId, folderIds } = args
  const stapel = folderIds ?? []
  if (folderId && stapel.length > 0) throw new Error('Entweder folderId ODER folderIds angeben — nicht beides')
  if (folderId) return [folderId]
  if (stapel.length === 0) throw new Error('folderId oder folderIds ist Pflicht')
  if (stapel.length > MAX_THEMEN_ORDNER) {
    throw new Error(`Hoechstens ${MAX_THEMEN_ORDNER} Ordner je Stapel — es waren ${stapel.length}`)
  }
  const doppelt = stapel.filter((id, i) => stapel.indexOf(id) !== i)
  if (doppelt.length > 0) throw new Error(`Doppelte Ordner im Stapel: ${[...new Set(doppelt)].join(', ')}`)
  return [...stapel]
}

/**
 * Setzt die Themen Ordner fuer Ordner; `setze` ist injiziert, damit die
 * Stapel-Logik ohne Storage testbar bleibt.
 */
export async function fuehreStapelThemenAus(args: {
  folderIds: readonly string[]
  setze: (folderId: string) => Promise<ThemenErgebnis>
}): Promise<StapelErgebnis> {
  const zeilen: ThemenZeile[] = []
  for (const folderId of args.folderIds) {
    try {
      const ergebnis = await args.setze(folderId)
      zeilen.push({
        folderId,
        themen: ergebnis.themen,
        ...(ergebnis.indexAngelegt ? { indexAngelegt: true as const } : {}),
      })
    } catch (fehler) {
      const code = (fehler as { code?: unknown }).code
      zeilen.push({
        folderId,
        fehler: fehler instanceof Error ? fehler.message : String(fehler),
        ...(typeof code === 'string' ? { code } : {}),
      })
    }
  }
  return {
    zeilen,
    gesetzt: zeilen.filter((zeile) => zeile.themen !== undefined).length,
    gescheitert: zeilen.filter((zeile) => zeile.fehler !== undefined).length,
    indexAngelegt: zeilen.filter((zeile) => zeile.indexAngelegt === true).length,
  }
}
