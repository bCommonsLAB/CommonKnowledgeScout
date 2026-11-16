/**
 * @fileoverview Ein- und Ausgaben von `sitzung_eintragen` (Register, Welle R4b).
 *
 * @description
 * Nach `sitzung_abschliessen` und dem Job `chatverlauf-de` traegt dieses
 * Werkzeug EINE Sitzung in den Block jedes Vorhabens und in die Chronik ein —
 * ohne Speicher-Scan. Es ersetzt die beiden vollen Laeufe aus den
 * Folgeaufrufen (Befund 16.11.2026: je 90–100 s, und der Teilbaum-Lauf
 * loeschte Querverweise). E7 bleibt: der Skill ruft es nach `completed`.
 * Was ohne Scan nicht sicher geht, steht in `offen`, mit dem vollen Lauf als
 * Folgeaufruf — nie geraten.
 *
 * @module agent-view/sitzungen-register/eintragen
 */

import type { SitzungsDatensatz } from '@/lib/agent-view/sichten/sitzungen-types'
import type { EinsetzStatus } from '@/lib/agent-view/sichten/sitzungen-einsetzen'
import type { TransformationZeile } from '@/lib/repositories/shadow-twin-transformationen'
import type { Folgeaufruf } from '../abschluss/abschluss-typen'
import type { AbgleichArt } from '../abgleich'
import type { RegisterLaufErgebnis } from '../register-dienst'
import type { SitzungsRegisterDoc } from '../types'

export const EINTRAG_FEHLER = ['nicht_im_register', 'ohne_beleg', 'notiz_fehlt'] as const
export type EintragFehlerCode = (typeof EINTRAG_FEHLER)[number]

export class SitzungsEintragError extends Error {
  constructor(readonly code: EintragFehlerCode, message: string) {
    super(`${code}: ${message}`)
  }
}

/** Ordner mit kanonischem, library-relativem Pfad (so wie der Scan ihn schreibt). */
export interface EintragOrdner {
  id: string
  pfad: string
  name: string
}

export interface EintragDatei {
  text: string
  /** Version beim Lesen — geschrieben wird nur, wenn sie noch gilt. */
  version: string | null
}

export interface EintragPorts {
  register: {
    holeNachKennung: (sitzungId: string) => Promise<SitzungsRegisterDoc | null>
    /** Abgleich wie nach einem Sichten-Lauf, mit library-relativen Pfaden (Ablage-Cache). */
    nachLauf: (args: {
      zeilen: TransformationZeile[]
      sitzungen: SitzungsDatensatz[]
      berichtet: ReadonlySet<string>
      art: AbgleichArt
    }) => Promise<RegisterLaufErgebnis>
  }
  /** Notizen (Transformation `chatverlauf-de`) genau dieser Belege. */
  notizen: (sourceIds: readonly string[]) => Promise<TransformationZeile[]>
  /** Beleg-Kopf frisch lesen und am Twin merken. */
  belegKopf: (sourceId: string) => Promise<{ fields: Record<string, unknown>; modifiedAt: string | null }>
  ordner: {
    nachId: (id: string) => Promise<EintragOrdner>
    /** null = den Pfad gibt es nicht; sonst mit dem Pfad, den der Speicher nennt. */
    nachPfad: (pfad: string) => Promise<EintragOrdner | null>
    /** Id des `BERICHT.md` im Ordner; null = keiner. */
    bericht: (ordnerId: string) => Promise<string | null>
  }
  /** Id von `Organisation/SITZUNGEN.md`; null = gibt es nicht. */
  chronik: () => Promise<string | null>
  datei: {
    lesen: (id: string) => Promise<EintragDatei>
    /** Versioniert ersetzen; wirft, wenn die Datei seit dem Lesen geaendert wurde. */
    ersetzen: (id: string, text: string, version: string | null) => Promise<void>
  }
  jetzt: () => Date
}

export type ChronikStatus = 'geschrieben' | 'unveraendert' | 'nicht_lesbar' | 'fehlt' | 'fehler' | 'uebersprungen'

export interface EintragErgebnis {
  sitzungId: string
  belege: Array<{ beleg: string; vorhaben: string; querverweise: string[] }>
  /** `querverweis`: der Bericht bekam nur die Querverweis-Zeile (Nebenvorhaben). */
  berichte: Array<{ pfad: string; status: EinsetzStatus | 'fehler'; querverweis: boolean }>
  chronik: ChronikStatus
  register: { block: RegisterLaufErgebnis | null; chronik: RegisterLaufErgebnis | null }
  /** Was nur ein voller Lauf entscheiden kann, mit Grund; leer = alles eingetragen. */
  offen: string[]
  hinweise: string[]
  /** Nur wenn `offen` nicht leer ist: die vollen Laeufe. */
  folgeaufrufe: Folgeaufruf[]
}
