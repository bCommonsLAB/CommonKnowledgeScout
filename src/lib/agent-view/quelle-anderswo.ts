/**
 * @fileoverview `quelle_verschwunden` bekommt `moeglicherweiseIn` (Wunschliste 8, W8-2).
 *
 * @description
 * Der Befund sagte bisher nur „die Datenbank kennt sie, im Speicher liegt sie
 * nicht" — eine Sackgasse, wenn die Datei in einer anderen Library liegt
 * (Anlass 13.10.: acht Dateien, von Hand gefunden). Jetzt fragt der Scan
 * ueber einen Port nach Orten (`sucheQuelleAnderswo`, nur MongoDB) und haengt
 * sie an den Befund:
 *
 * - `moeglicherweiseIn: [...]` — gefunden (hoechstens fuenf, bessere
 *   Uebereinstimmung zuerst; `moeglicherweiseInGesamt`, wenn gekappt);
 * - `moeglicherweiseIn: []` — gesucht, nichts gefunden;
 * - Feld fehlt — nicht gesucht (kein Port, oder Report vor 2.50.0).
 *
 * Scheitert die Suche, bleibt der Befund ohne Feld, und ein `scan_error`
 * sagt es (`no-silent-fallbacks`). Pfade nennt erst `quelle_suchen`.
 *
 * @module agent-view
 */

import type { OrteJeQuelle, SuchQuelle } from '@/lib/shadow-twin/quelle-suche'
import { createGap } from './gap-registry'
import type { TwinFamilyView } from './twin-rules'
import type { CoverageGap } from './types'

/** Haengt die Orte an die `quelle_verschwunden`-Befunde (pur). */
export function ergaenzeMoeglicherweiseIn(gaps: readonly CoverageGap[], orte: ReadonlyMap<string, OrteJeQuelle>): CoverageGap[] {
  return gaps.map((gap) => {
    if (gap.type !== 'quelle_verschwunden') return gap
    const gefunden = orte.get(gap.targetId) ?? { orte: [], gesamt: 0 }
    const kurz = gefunden.orte
      .map((ort) => `${ort.libraryName}${ort.bibliothek ? ` (${ort.bibliothek})` : ''} [${ort.uebereinstimmung}]`)
      .join(', ')
    return {
      ...gap,
      moeglicherweiseIn: gefunden.orte,
      ...(gefunden.gesamt > gefunden.orte.length ? { moeglicherweiseInGesamt: gefunden.gesamt } : {}),
      detail: gefunden.orte.length > 0
        ? `${gap.detail ?? ''}; womoeglich in: ${kurz}${gefunden.gesamt > gefunden.orte.length ? ` (+${gefunden.gesamt - gefunden.orte.length})` : ''} — quelle_suchen nennt Pfade`
        : gap.detail,
    }
  })
}

/** Fragt den Port fuer alle verschwundenen Quellen und ergaenzt die Befunde. */
export async function verschwundeneMitOrten(args: {
  gaps: readonly CoverageGap[]
  families: readonly TwinFamilyView[]
  suche: ((quellen: readonly SuchQuelle[]) => Promise<Map<string, OrteJeQuelle>>) | undefined
  rootFolderId: string
}): Promise<CoverageGap[]> {
  const verschwunden = args.gaps.filter((gap) => gap.type === 'quelle_verschwunden')
  if (args.suche === undefined || verschwunden.length === 0) return [...args.gaps]
  const jeId = new Map(args.families.map((family) => [family.sourceId, family]))
  const quellen: SuchQuelle[] = verschwunden.map((gap) => {
    const family = jeId.get(gap.targetId)
    return {
      sourceId: gap.targetId,
      sourceName: family?.sourceName ?? gap.targetName,
      sourceContentHash: family?.sourceContentHash ?? null,
      sourceSize: family?.sourceSize ?? null,
    }
  })
  try {
    return ergaenzeMoeglicherweiseIn(args.gaps, await args.suche(quellen))
  } catch (error) {
    return [
      ...args.gaps,
      createGap({
        type: 'scan_error',
        scope: 'library',
        targetId: args.rootFolderId,
        targetName: '(Library)',
        folderId: args.rootFolderId,
        path: '',
        message: 'Suche nach verschwundenen Quellen in anderen Libraries fehlgeschlagen — moeglicherweiseIn fehlt',
        detail: error instanceof Error ? error.message : String(error),
      }),
    ]
  }
}
