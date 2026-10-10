/**
 * Zeilen-Modelle des Reiters „Korrektur" (P3b) und reine Umformer
 * zwischen Secretary-Vorschlag, Transkript-Zustand und Schreib-Request.
 * Kein React, kein I/O — die Hooks und Komponenten bauen darauf auf.
 */

import type { TranskriptZustand } from '@/lib/transkript-korrektur/laden'
import type { Korrekturvorschlag } from '@/lib/transkript-korrektur/vorschlag'

export interface ErsetzungZeile {
  id: string
  aktiv: boolean
  alt: string
  neu: string
  /** Jedes Vorkommen ersetzen (wiederkehrender Hoerfehler). */
  alle: boolean
  zeile: number | null
  kontext: string
  begruendung: string
  beleg: string
  quelle: 'vorschlag' | 'hand'
}

export interface SprecherZeile {
  label: string
  aktiv: boolean
  name: string
  begruendung: string
  beleg: string
}

export interface BegleitQuelle {
  id: string
  name: string
  hatTranskript: boolean
  gewaehlt: boolean
}

export interface ApplyAntwort {
  geschrieben: boolean
  updatedAt: string | null
  belege: Array<{ alt: string; neu: string; treffer: number; zeile: number; kontextVorher: string; kontextNachher: string }>
  speakerNames: string[]
  revision: { revised_by: string; revised_at: string; revision_note: string }
  transformationen: Array<{ pfad: string; template: string; sprache: string; jetztUeberholt: boolean }>
  /** Welle E: Sammeldateien mit dieser Quelle (nach dem Schreiben ueberholt). */
  abhaengigeSammeldateien?: Array<{ sourceId: string; sourceName: string; ueberholt: boolean; ohneTransformation: boolean }>
}

let zaehler = 0
export function neueZeilenId(): string {
  zaehler += 1
  return `z${zaehler}`
}

export function leereErsetzung(): ErsetzungZeile {
  return { id: neueZeilenId(), aktiv: true, alt: '', neu: '', alle: false, zeile: null, kontext: '', begruendung: '', beleg: 'mensch', quelle: 'hand' }
}

/** Vorschlaege des Secretary als Zeilen; `unsicher` ist vorab abgewaehlt (Brief, Entscheidung 4). */
export function ersetzungenAusVorschlag(vorschlag: Korrekturvorschlag): ErsetzungZeile[] {
  return vorschlag.ersetzungen.map((e) => ({
    id: neueZeilenId(), aktiv: e.beleg !== 'unsicher', alt: e.alt, neu: e.neu, alle: false,
    zeile: e.zeile > 0 ? e.zeile : null, kontext: e.kontext, begruendung: e.begruendung, beleg: e.beleg, quelle: 'vorschlag',
  }))
}

/** Eine Zeile je Label aus `speakers`; der Vorschlag fuellt Name, Beleg und Begruendung. */
export function sprecherZeilen(zustand: TranskriptZustand, vorschlag: Korrekturvorschlag | null): SprecherZeile[] {
  const bereits = new Map(zustand.speakerNames.map((e) => {
    const i = e.indexOf(':')
    return [e.slice(0, i).trim(), e.slice(i + 1).trim()] as const
  }))
  return zustand.speakers.map((label) => {
    const v = vorschlag?.sprecher.find((s) => s.label === label)
    const vorhanden = bereits.get(label)
    return {
      label,
      name: v?.name ?? vorhanden ?? '',
      aktiv: !!v && v.beleg !== 'unsicher' && v.name.trim() !== '',
      begruendung: v?.begruendung ?? (vorhanden ? 'bereits zugeordnet' : ''),
      beleg: v?.beleg ?? (vorhanden ? 'vorhanden' : ''),
    }
  })
}

/** Request-Body fuer POST transcript-correction aus den aktiven Zeilen. */
export function applyBody(args: {
  sourceId: string
  ersetzungen: ErsetzungZeile[]
  sprecher: SprecherZeile[]
  begruendung: string
  ifUpdatedAt: string
  nurVorschau: boolean
}): Record<string, unknown> {
  return {
    sourceId: args.sourceId,
    ersetzungen: args.ersetzungen
      .filter((z) => z.aktiv && z.alt.trim() !== '')
      .map((z) => ({ alt: z.alt, neu: z.neu, ...(z.alle ? { alle: true } : {}) })),
    sprecher: args.sprecher
      .filter((z) => z.aktiv && z.name.trim() !== '')
      .map((z) => ({ label: z.label, name: z.name.trim() })),
    begruendung: args.begruendung,
    ifUpdatedAt: args.ifUpdatedAt,
    nurVorschau: args.nurVorschau,
  }
}

export function anzahlAktiv(ersetzungen: ErsetzungZeile[], sprecher: SprecherZeile[]): { ersetzungen: number; sprecher: number } {
  return {
    ersetzungen: ersetzungen.filter((z) => z.aktiv && z.alt.trim() !== '').length,
    sprecher: sprecher.filter((z) => z.aktiv && z.name.trim() !== '').length,
  }
}
