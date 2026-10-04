/**
 * @fileoverview Typen und Fehler von `transkript_korrigieren` (Wunschliste 7, B1).
 *
 * @description
 * Aus `transkript-korrektur-schreiben.ts` ausgelagert (200-Zeilen-Regel). Die
 * Fehler tragen einen `code`, den das Werkzeug unveraendert in die Antwort
 * stellt — der Agent muss keine deutsche Meldung parsen, um zu wissen, ob ein
 * zweiter Versuch Sinn hat.
 *
 * @module mcp
 */

import type { StorageProvider } from '@/lib/storage/types'
import type { Library } from '@/types/library'
import type { ResolvedSource } from './tools-erschliessen-shared'
import type { Ersetzung, ErsetzungBeleg } from './transkript-korrektur'

/**
 * Actor der Bruecken-Korrektur (OKF-Schreibweise wie `generated_by`). Die
 * Bruecke spricht immer fuer den Agenten; eine Hand-Korrektur im Spiegel
 * traegt diesen Stempel NICHT — sie kommt ueber `twins_synchronisieren import`.
 */
export const REVISED_BY_BRUECKE = 'claude/cowork'

/** Spiegel und MongoDB passen nicht zusammen, oder `ifVersion` ist veraltet. */
export class TranskriptKonfliktError extends Error {
  readonly code = 'konflikt' as const
  constructor(
    meldung: string,
    readonly details: {
      erwarteteVersion?: string
      aktuelleVersion?: string | null
      /** true = MongoDB traegt die Korrektur schon, nur der Spiegel fehlt. */
      mongoGeschrieben?: boolean
      hinweis: string
    },
  ) {
    super(meldung)
    this.name = 'TranskriptKonfliktError'
  }
}

/** Die Familie hat kein Transkript (oder es gibt keine Familie). */
export class KeinTranskriptError extends Error {
  readonly code = 'kein_transkript' as const
  constructor(meldung: string) {
    super(meldung)
    this.name = 'KeinTranskriptError'
  }
}

/** Es gibt keinen versionierbaren Spiegel im `_`-Ordner — `ifVersion` ist nicht pruefbar. */
export class KeinSpiegelError extends Error {
  readonly code = 'kein_spiegel' as const
  constructor(meldung: string) {
    super(meldung)
    this.name = 'KeinSpiegelError'
  }
}

export interface TransformationZeile {
  pfad: string
  template: string
  sprache: string
  /** true: die Transformation gibt das korrigierte Transkript nicht mehr wieder. */
  jetztUeberholt: boolean
}

export interface OffenerKorrekturauftrag {
  auftrag: string
  von: string | null
  at: string | null
}

export interface KorrekturErgebnis {
  pfad: string
  id: string
  geschrieben: boolean
  versionVorher: string
  /** null in der Vorschau. */
  versionNachher: string | null
  ersetzungen: ErsetzungBeleg[]
  revision: { revised_by: string; revised_at: string; revision_note: string }
  transformationen: TransformationZeile[]
  offeneKorrekturauftraege: OffenerKorrekturauftrag[]
}

export interface KorrekturLauf {
  library: Library
  userEmail: string
  provider: StorageProvider
  source: ResolvedSource
  ersetzungen: readonly Ersetzung[]
  ifVersion: string
  begruendung: string
  nurVorschau: boolean
  /** Zeitquelle (Tests injizieren eine feste Uhr). */
  now?: () => string
}
