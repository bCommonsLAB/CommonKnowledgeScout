/**
 * @fileoverview Sammelaktions-Stempel erkennen (ADR 0006, Uebergang) — pur.
 *
 * @description
 * Bis ADR 0006 gab es Sammelaktionen: EIN Klick verifizierte 26 Artefakte
 * hintereinander. Unter der neuen Bedeutung („gruener Haken = ein Mensch hat
 * hingesehen") behaupten diese Stempel etwas Unwahres und werden
 * zurueckgesetzt — Einzelklicks bleiben.
 *
 * Unterscheidbar sind beide am TAKT. Die Messung im Pruefarchiv
 * (26.08.2026, 35 Stempel) zeigt zwei klar getrennte Muster:
 * Sammelaktion 26 Stempel EINER Art in 65 s (~2,5 s Takt, weil jeder
 * Schreibvorgang so lange dauert), Einzelklicks 4 Stempel in 39 s mit
 * gemischten Arten. Die Regel bildet genau das ab und rechnet NICHTS
 * hinein, was sie nicht sieht: Ein Grenzfall bleibt ungeloescht (lieber ein
 * Haken zu viel als eine geloeschte, echte Pruefung).
 *
 * Reine Funktionen, kein I/O.
 *
 * @module shadow-twin
 */

/** Ein `verified_by`-Stempel, wie ihn der Bestand traegt. */
export interface VerifikationsStempel {
  sourceId: string
  sourceName: string
  kind: 'transcript' | 'transformation'
  /** Template der Transformation; beim Transkript null. */
  templateName: string | null
  targetLanguage: string
  verifiedBy: string
  /** ISO-Zeitstempel. */
  verifiedAt: string
}

export interface SammelaktionsRegel {
  /** Ab so vielen Stempeln in einem Schwung gilt er als Sammelaktion. */
  mindestAnzahl: number
  /** Groesster Abstand zwischen zwei Stempeln DESSELBEN Schwungs (ms). */
  maxAbstandMs: number
}

/**
 * Werte aus der Messung: Sammelaktion ~2,5 s Takt, Einzelklicks 7-13 s.
 * 5 s trennt beide Muster mit Abstand nach beiden Seiten.
 */
export const SAMMELAKTION_REGEL: SammelaktionsRegel = { mindestAnzahl: 6, maxAbstandMs: 5000 }

/** Art des Artefakts — Sammelaktionen liefen je Art getrennt. */
function artVon(stempel: VerifikationsStempel): string {
  return `${stempel.kind}|${stempel.templateName ?? ''}|${stempel.targetLanguage}`
}

function zeitVon(stempel: VerifikationsStempel): number {
  return new Date(stempel.verifiedAt).getTime()
}

/**
 * Ein Schwung: Stempel derselben Art, die im Takt der Regel aufeinander
 * folgen. Auch Einzelklicks bilden Schwuenge — sie sind nur kleiner.
 */
export interface StempelSchwung {
  art: string
  stempel: VerifikationsStempel[]
  von: string
  bis: string
  /** Nach der Regel eine Sammelaktion (und damit zurueckzusetzen). */
  istSammelaktion: boolean
}

/**
 * Gruppiert Stempel in Schwuenge und urteilt je Schwung. Stempel ohne
 * lesbare Zeit werden BENANNT uebersprungen (eigener Rueckgabewert), nie
 * still einsortiert.
 */
export function baueSchwuenge(
  stempel: readonly VerifikationsStempel[],
  regel: SammelaktionsRegel = SAMMELAKTION_REGEL,
): { schwuenge: StempelSchwung[]; ohneZeit: VerifikationsStempel[] } {
  const ohneZeit = stempel.filter((s) => Number.isNaN(zeitVon(s)))
  const brauchbar = stempel.filter((s) => !Number.isNaN(zeitVon(s)))

  const nachArt = new Map<string, VerifikationsStempel[]>()
  for (const s of brauchbar) {
    const art = artVon(s)
    const bucket = nachArt.get(art)
    if (bucket) bucket.push(s)
    else nachArt.set(art, [s])
  }

  const schwuenge: StempelSchwung[] = []
  for (const [art, liste] of nachArt) {
    const sortiert = [...liste].sort((a, b) => zeitVon(a) - zeitVon(b))
    let aktuell: VerifikationsStempel[] = []
    const abschliessen = () => {
      if (aktuell.length === 0) return
      schwuenge.push({
        art,
        stempel: aktuell,
        von: aktuell[0].verifiedAt,
        bis: aktuell[aktuell.length - 1].verifiedAt,
        istSammelaktion: aktuell.length >= regel.mindestAnzahl,
      })
      aktuell = []
    }
    for (const s of sortiert) {
      const vorher = aktuell[aktuell.length - 1]
      if (vorher !== undefined && zeitVon(s) - zeitVon(vorher) > regel.maxAbstandMs) abschliessen()
      aktuell.push(s)
    }
    abschliessen()
  }
  return { schwuenge, ohneZeit }
}

/** Die Stempel, die nach der Regel aus einer Sammelaktion stammen. */
export function findeSammelStempel(
  stempel: readonly VerifikationsStempel[],
  regel: SammelaktionsRegel = SAMMELAKTION_REGEL,
): VerifikationsStempel[] {
  return baueSchwuenge(stempel, regel)
    .schwuenge.filter((schwung) => schwung.istSammelaktion)
    .flatMap((schwung) => schwung.stempel)
}
