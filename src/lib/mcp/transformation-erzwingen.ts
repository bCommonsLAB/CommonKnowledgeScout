/**
 * @fileoverview Soll `transformation_starten` das Template-Gate uebergehen?
 *
 * @description
 * Befund 21.09.2026 (Nachtrag zur Bruecken-Luecke bei Sammeldateien): Haengt am
 * Twin schon IRGENDEINE Transformation, ueberspringt der Worker die
 * Template-Phase (`transform_template` skipped, Grund
 * `preprocess_frontmatter_valid`), laesst nur `ingest_rag` laufen und meldet
 * `completed`. Eine geaenderte Vorlage liess sich so ueber die Bruecke nie auf
 * bereits transformierte Quellen anwenden — und der Job sah gruen aus.
 *
 * Wie bei `alt-format-erkennung.ts` faellt die Entscheidung dort, wo die Daten
 * liegen, und sie steht SICHTBAR in der Antwort (`erzwungen`). Ist die
 * vorhandene Transformation aktuell, gibt es KEINEN Job, sondern eine Absage
 * mit Begruendung: Ein bezahlter Lauf, der nichts schreibt, ist fuer den
 * Aufrufer ein Fehlschlag (`no-silent-fallbacks`).
 *
 * Befund Live-Abnahme R4 (15.11.2026): `erzwingen: false` legte trotzdem einen
 * Job an und verliess sich darauf, dass der Worker ueberspringt. Bei einem
 * Markdown-Beleg ohne `chapters` tat er das nicht und ueberschrieb die Notiz.
 * Darum gilt jetzt: `false` und eine Transformation DIESER Vorlage liegt vor
 * → Absage ohne Job, statt das Ueberspringen dem Gate zu ueberlassen.
 *
 * @module mcp
 */

import { type ShadowTwinDocument, readTranscriptRecord } from '@/lib/repositories/shadow-twin-repo'
import { hatTransformation } from './alt-format-erkennung'

/** Warum das Template-Gate uebergangen wird (oder nicht) — genau ein Wert. */
export type TransformationErzwingenGrund =
  /** Ausdruecklich angefordert. */
  | 'angefordert'
  /** Ausdruecklich abgelehnt, und es gibt noch keine Transformation dieser Vorlage — der Lauf erzeugt sie. */
  | 'abgelehnt'
  /** Die Vorlage wurde nach der vorhandenen Transformation geaendert. */
  | 'vorlage_juenger'
  /** Das Transkript wurde nach der Transformation geaendert (transformation_stale). */
  | 'transkript_juenger'
  /** Es gibt nur Transformationen ANDERER Vorlagen — das Gate wuerde trotzdem ueberspringen. */
  | 'andere_vorlage'
  /** Noch keine Transformation am Twin: das Gate laesst den Lauf ohnehin durch. */
  | 'nicht_noetig'

export interface TransformationErzwingenEntscheidung {
  erzwingen: boolean
  grund: TransformationErzwingenGrund
}

/** Juenger als die Transformation? Unlesbare Zeitpunkte zaehlen NICHT als juenger. */
function istJuenger(kandidat: string | undefined, transformation: string): boolean {
  const a = Date.parse(kandidat ?? '')
  const b = Date.parse(transformation)
  return !Number.isNaN(a) && !Number.isNaN(b) && a > b
}

/**
 * Absage: Es entsteht kein Job — die Transformation ist aktuell, oder sie liegt
 * vor und `erzwingen: false` verbietet das Neuschreiben. Benannt, damit
 * Aufrufer (R4 `sitzung_abschliessen`) sie von echten Fehlern unterscheiden,
 * ohne die Meldung zu lesen.
 */
export class TransformationAbgesagtError extends Error {
  readonly code = 'transformation_abgesagt' as const
  constructor(message: string) {
    super(message)
    this.name = 'TransformationAbgesagtError'
  }
}

/**
 * Die ausdrueckliche Angabe gewinnt immer, in beide Richtungen. Sonst: erzwingen,
 * wenn es einen erkennbaren Grund gibt; ist die Transformation aktuell, WIRFT die
 * Funktion — der Aufrufer bekommt die Absage je Zeile, ohne Job.
 */
export function entscheideTransformationErzwingen(args: {
  angefordert: boolean | undefined
  doc: ShadowTwinDocument | null | undefined
  template: string
  zielsprache: string
  /** `updatedAt` der Vorlage in MongoDB (ISO); undefined = nicht ermittelbar. */
  vorlageAktualisiertAm: string | undefined
}): TransformationErzwingenEntscheidung {
  if (args.angefordert === true) return { erzwingen: true, grund: 'angefordert' }
  const record = args.doc?.artifacts?.transformation?.[args.template]?.[args.zielsprache]
  if (args.angefordert === false) {
    if (typeof record?.markdown === 'string') {
      throw new TransformationAbgesagtError(
        `Transformation mit Vorlage "${args.template}" (${args.zielsprache}) liegt vor (Twin vom ${record.updatedAt}) und ` +
          'erzwingen: false verbietet das Neuschreiben. Kein Job angelegt.',
      )
    }
    return { erzwingen: false, grund: 'abgelehnt' }
  }
  if (!hatTransformation(args.doc)) return { erzwingen: false, grund: 'nicht_noetig' }

  if (typeof record?.markdown !== 'string') return { erzwingen: true, grund: 'andere_vorlage' }
  if (istJuenger(args.vorlageAktualisiertAm, record.updatedAt)) return { erzwingen: true, grund: 'vorlage_juenger' }
  if (istJuenger(readTranscriptRecord(args.doc)?.updatedAt, record.updatedAt)) {
    return { erzwingen: true, grund: 'transkript_juenger' }
  }
  throw new TransformationAbgesagtError(
    `Transformation mit Vorlage "${args.template}" (${args.zielsprache}) ist aktuell: Twin vom ${record.updatedAt}, ` +
      `Vorlage vom ${args.vorlageAktualisiertAm ?? 'unbekannt'}. Der Worker wuerde sie ueberspringen — ` +
      'mit erzwingen: true trotzdem neu erzeugen (z.B. nach geaenderter Quelldatei). Kein Job angelegt.',
  )
}
