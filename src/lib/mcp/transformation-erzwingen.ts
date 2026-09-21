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
 * @module mcp
 */

import { type ShadowTwinDocument, readTranscriptRecord } from '@/lib/repositories/shadow-twin-repo'
import { hatTransformation } from './alt-format-erkennung'

/** Warum das Template-Gate uebergangen wird (oder nicht) — genau ein Wert. */
export type TransformationErzwingenGrund =
  /** Ausdruecklich angefordert. */
  | 'angefordert'
  /** Ausdruecklich abgelehnt — der Worker darf ueberspringen. */
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
  if (args.angefordert === false) return { erzwingen: false, grund: 'abgelehnt' }
  if (!hatTransformation(args.doc)) return { erzwingen: false, grund: 'nicht_noetig' }

  const record = args.doc?.artifacts?.transformation?.[args.template]?.[args.zielsprache]
  if (typeof record?.markdown !== 'string') return { erzwingen: true, grund: 'andere_vorlage' }
  if (istJuenger(args.vorlageAktualisiertAm, record.updatedAt)) return { erzwingen: true, grund: 'vorlage_juenger' }
  if (istJuenger(readTranscriptRecord(args.doc)?.updatedAt, record.updatedAt)) {
    return { erzwingen: true, grund: 'transkript_juenger' }
  }
  throw new Error(
    `Transformation mit Vorlage "${args.template}" (${args.zielsprache}) ist aktuell: Twin vom ${record.updatedAt}, ` +
      `Vorlage vom ${args.vorlageAktualisiertAm ?? 'unbekannt'}. Der Worker wuerde sie ueberspringen — ` +
      'mit erzwingen: true trotzdem neu erzeugen (z.B. nach geaenderter Quelldatei). Kein Job angelegt.',
  )
}
