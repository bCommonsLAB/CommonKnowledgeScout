/**
 * @fileoverview Alt-Format-Familien erkennen, statt sie raten zu lassen (W9).
 *
 * @description
 * Befund aus dem Erschliessungslauf 02.09.2026: Von rund 250 Jobs brauchten
 * **60** `erzwingen: true` — ein Viertel; in einem Vorhabensordner traf es
 * **alle 16** Quellen. Ohne das Flag meldet der Job `completed` und schreibt
 * NICHTS: Das Extract-Gate liest die vorhandene Transformation als Beweis
 * fuer ein Transkript und ueberspringt die Transkription. Die Meldung luegt.
 *
 * Der Parameter existiert seit Welle ST11 samt Erklaerung — nur muss der
 * Agent raten, wann er ihn setzt. Die Konstellation ist aber maschinell
 * eindeutig: eine Familie MIT Transformation und OHNE Transkript. Genau das
 * prueft dieses Modul, damit die Entscheidung dort faellt, wo die Daten
 * liegen, statt in einer Werkzeugbeschreibung.
 *
 * **Sichtbar, nicht still.** Ein automatisch gesetztes `erzwingen` steht als
 * `erzwungen: 'alt_format_erkannt'` in der Antwort. Eine stille Korrektur
 * waere derselbe Fehler in gruen — der Agent koennte den naechsten Lauf nicht
 * erklaeren (`no-silent-fallbacks`).
 *
 * @module mcp
 */

import { type ShadowTwinDocument, readTranscriptRecord } from '@/lib/repositories/shadow-twin-repo'

/** Warum `erzwingen` gilt (oder nicht) — genau ein Wert, kein Default-Zweig. */
export type ErzwingenGrund =
  /** Der Mensch hat es ausdruecklich angefordert. */
  | 'angefordert'
  /** Der Mensch hat es ausdruecklich abgelehnt. */
  | 'abgelehnt'
  /** Transformation ohne Transkript — das Gate wuerde still ueberspringen. */
  | 'alt_format_erkannt'
  /** Nichts spricht dafuer: normale Quelle. */
  | 'nicht_noetig'

export interface ErzwingenEntscheidung {
  erzwingen: boolean
  grund: ErzwingenGrund
}

/** Hat die Familie mindestens eine Transformation (Template × Sprache)? */
export function hatTransformation(doc: ShadowTwinDocument | null | undefined): boolean {
  const nachTemplate = doc?.artifacts?.transformation
  if (!nachTemplate || typeof nachTemplate !== 'object') return false
  return Object.values(nachTemplate).some(
    (nachSprache) =>
      !!nachSprache &&
      typeof nachSprache === 'object' &&
      Object.values(nachSprache).some((record) => typeof record?.markdown === 'string'),
  )
}

/**
 * Die Alt-Format-Konstellation: Transformation da, Transkript nicht.
 *
 * Eine Familie ganz OHNE Artefakte ist keine — sie ist schlicht noch nicht
 * erschlossen, und dort greift das Gate richtig.
 */
export function istAltFormatFamilie(doc: ShadowTwinDocument | null | undefined): boolean {
  if (!doc) return false
  return hatTransformation(doc) && readTranscriptRecord(doc) === null
}

/**
 * Entscheidet, ob dieser Job das Extract-Gate uebergehen muss.
 *
 * Die ausdrueckliche Angabe des Menschen gewinnt IMMER — in beide Richtungen.
 * Ein `erzwingen: false` gegen die Erkennung ist eine legitime Ansage („ich
 * weiss, was ich tue"), und sie zu ueberstimmen hiesse, dem Menschen das
 * Werkzeug aus der Hand zu nehmen.
 */
export function entscheideErzwingen(args: {
  angefordert: boolean | undefined
  doc: ShadowTwinDocument | null | undefined
}): ErzwingenEntscheidung {
  if (args.angefordert === true) return { erzwingen: true, grund: 'angefordert' }
  if (args.angefordert === false) return { erzwingen: false, grund: 'abgelehnt' }
  if (istAltFormatFamilie(args.doc)) return { erzwingen: true, grund: 'alt_format_erkannt' }
  return { erzwingen: false, grund: 'nicht_noetig' }
}
