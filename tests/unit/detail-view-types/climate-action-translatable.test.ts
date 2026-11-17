/**
 * Klimamassnahme: Jedes Textfeld, das die Detailansicht als Fliesstext zeigt,
 * muss in der `translatable`-Spec stehen. Sonst bleibt es in IT/EN deutsch,
 * obwohl die Uebersetzung als fertig gilt (Befund 17.11.2026).
 */
import { describe, it, expect } from 'vitest'
import { getTranslatableFields } from '@ks/contracts'

const ANGEZEIGTE_TEXTFELDER = [
  'title',
  'shortTitle',
  'summary',
  'arbeitsgruppe',
  'lv_zustaendigkeit',
  'einleitung',
  'was_vorgeschlagen',
  'position_lv',
  'perspektiven_begruendung',
  'co2_einsparung_kt_begruendung',
  'durchsetzbarkeit_begruendung',
  'kosten_eur_begruendung',
  'sdg_begruendung',
]

/** Originalzitate werden absichtlich nicht uebersetzt. */
const ORIGINALZITATE = ['vorschlag_text', 'lv_rueckmeldung']

describe('climateAction translatable-Spec', () => {
  const textKeys = getTranslatableFields('climateAction').text.map((f) => f.key)

  it('enthaelt alle in der Detailansicht gezeigten Textfelder', () => {
    for (const key of ANGEZEIGTE_TEXTFELDER) expect(textKeys, key).toContain(key)
  })

  it('laesst Originalzitate unuebersetzt', () => {
    for (const key of ORIGINALZITATE) expect(textKeys, key).not.toContain(key)
  })
})
