/**
 * @fileoverview Body der PATCH-Route des Reiters „Sitzungen" lesen (Register, Welle R3). Reine Funktion.
 *
 * @description
 * Dieselben Felder wie das Brueckenwerkzeug `sitzung_setzen` (Entscheidung,
 * Grund, Zugbereiche, Vorhaben-Vorschlag, Bemerkung, Kennung nachtragen) —
 * die Regeln dahinter (Grund bei `ueberspringen`, mind. zwei Zugbereiche bei
 * `trennen`, volle Kennung) prueft `planeSetzen`, nicht diese Datei. Hier nur
 * die Form: unbekannte Felder und ein leerer Body sind Fehler, keine stille
 * Nicht-Aenderung.
 *
 * @module agent-view/sitzungen-register
 */

import { z } from 'zod'
import type { SetzEingabe } from './schreib-plaene'
import { ENTSCHEIDUNGEN } from './types'

const VORSCHLAG = z.object({
  ordner: z.string().trim().min(1),
  herkunft: z.string().trim().min(1),
}).strict()

const ZUGBEREICH = z.object({ von: z.number().int(), bis: z.number().int() }).strict()

const SETZ_BODY = z.object({
  entscheidung: z.enum(ENTSCHEIDUNGEN).optional(),
  entscheidungGrund: z.string().nullable().optional(),
  zugbereiche: z.array(ZUGBEREICH).optional(),
  vorhabenVorschlag: VORSCHLAG.nullable().optional(),
  bemerkung: z.string().nullable().optional(),
  sitzungId: z.string().trim().min(1).optional(),
}).strict()

export type SetzBodyErgebnis = { ok: true; eingabe: SetzEingabe } | { ok: false; fehler: string }

export function leseSetzBody(body: unknown): SetzBodyErgebnis {
  const r = SETZ_BODY.safeParse(body)
  if (!r.success) {
    return { ok: false, fehler: r.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ') }
  }
  if (Object.keys(r.data).length === 0) return { ok: false, fehler: 'body: mindestens ein Feld noetig' }
  return { ok: true, eingabe: r.data }
}
