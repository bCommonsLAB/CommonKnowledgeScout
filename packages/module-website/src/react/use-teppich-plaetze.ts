'use client'

/**
 * Plaetze und Radien der Punkte (aus `website-teppich.tsx` herausgeloest, 24.11.2026).
 *
 * In der Seite liegt die Wolke im Kasten hinter der Antwort, in der Graph-Ansicht fuellt sie die
 * ganze Flaeche. Steht eine Antwort, stehen ihre Belege als Marken (wie die Nummern im Text) und halten Respektabstand
 * (`haltAbstand`, Owner 24.11.2026) — in beiden Ansichten, schon am Ende der Animation.
 */

import * as React from 'react'
import { BELEG_RADIUS, haltAbstand, packeWolke, teppichRadius, type TeppichKasten, type TeppichPlaetze, type TeppichPunkt } from '..'

const RAND = 12
/** Rand der Wolke in der Graph-Ansicht (Pixel). */
const GRAPH_RAND = 28

export interface TeppichPlaetzeEingabe {
  punkte: readonly TeppichPunkt[]
  kasten: TeppichKasten
  breite: number
  /** Graph-Ansicht mit gemessener Flaeche. */
  graph: boolean
  vollHoehe: number
  /** Belege der stehenden Antwort (fileIds); leer, solange keine steht. */
  belege: readonly string[]
}

export function useTeppichPlaetze(e: TeppichPlaetzeEingabe): { plaetze: TeppichPlaetze; radien: Float32Array; belegIndex: number[] } {
  const { punkte, kasten, breite, graph, vollHoehe, belege } = e
  const belegIndex = React.useMemo(() => {
    const index = new Map(punkte.map((p, i) => [p.fileId, i]))
    return belege.map((id) => index.get(id)).filter((i): i is number => i !== undefined)
  }, [punkte, belege])
  const hervor = belegIndex
  const plaetze = React.useMemo(() => {
    const roh = graph
      ? packeWolke(punkte, { breite, hoehe: vollHoehe, rand: GRAPH_RAND })
      : packeWolke(punkte, { breite: kasten.breite, hoehe: kasten.hoehe, rand: RAND, versatz: kasten.links })
    // Frei bleibt die Marke des Belegs und etwas Luft.
    return haltAbstand(roh, hervor, Math.max(BELEG_RADIUS + 8, roh.zelle * 2.2))
  }, [punkte, kasten, graph, breite, vollHoehe, hervor])
  const radien = React.useMemo(() => {
    const r = Float32Array.from(punkte, (q) => teppichRadius(plaetze.zelle, q.gewicht))
    for (const i of hervor) r[i] = BELEG_RADIUS
    return r
  }, [punkte, plaetze.zelle, hervor])
  return { plaetze, radien, belegIndex }
}
