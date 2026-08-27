/**
 * @fileoverview Unit-Tests: Stand-Plan (F8, Welle W7) — alle 409-Faelle.
 *
 * Der Wellenplan verlangt: Validierung, `stand_geaendert`, `report_veraltet`,
 * die Stufe-4-Regel (`abgenommen` ohne `bestaetigen`) und den Precheck-Filter,
 * der bewusst STRENGER als die Ampel urteilt (nur Maschine + error/warning;
 * `info` und Mensch-Befunde blockieren die Beurkundung nicht).
 */

import { describe, it, expect } from 'vitest'
import {
  KeinIndexError,
  MAX_BEFUNDE_IN_ANTWORT,
  NichtBereitError,
  ReportVeraltetError,
  StandGeaendertError,
  StandValidationError,
  baueStandPatch,
  blockierendeBefunde,
  brauchtPrecheck,
  parseStandRequest,
  pruefeBereitschaft,
  pruefeReportVeraltet,
  pruefeStandGeaendert,
} from '@/lib/agent-view/stand-plan'
import type { CoverageGap } from '@/lib/agent-view/types'

function gap(overrides: Partial<CoverageGap>): CoverageGap {
  return {
    type: 'report_missing', actor: 'cowork', zyklusSchritt: 3, severity: 'error',
    scope: 'folder', targetId: 'f-1', targetName: 'Pilot', folderId: 'f-1',
    path: '1. Arbeit/Pilot', message: 'Test', ...overrides,
  }
}

const BODY = {
  folderId: 'f-pilot',
  stand: 'abgenommen',
  erwarteterStand: 'berichtet',
  reportGeneratedAt: '2026-08-23T12:00:00.000Z',
}

describe('parseStandRequest — Validierung (400)', () => {
  it('nimmt einen vollstaendigen Body an; bestaetigen ist optional false', () => {
    expect(parseStandRequest(BODY)).toEqual({ ...BODY, bestaetigen: false })
  })

  it('verlangt folderId, gueltigen stand und reportGeneratedAt', () => {
    expect(() => parseStandRequest({ ...BODY, folderId: ' ' })).toThrow(StandValidationError)
    expect(() => parseStandRequest({ ...BODY, stand: 'fertig' })).toThrow(/erlaubt:/)
    expect(() => parseStandRequest({ ...BODY, reportGeneratedAt: '' })).toThrow(StandValidationError)
  })

  it('erwarteterStand ist Pflicht — explizites null erlaubt, fehlender Schluessel nicht', () => {
    const { erwarteterStand: _weg, ...ohne } = BODY
    expect(() => parseStandRequest(ohne)).toThrow(/erwarteterStand ist Pflicht/)
    expect(parseStandRequest({ ...BODY, erwarteterStand: null }).erwarteterStand).toBeNull()
  })

  it('bestaetigen heisst gleicher Stand — abweichender stand ist ein Eingabefehler', () => {
    expect(() => parseStandRequest({ ...BODY, bestaetigen: true })).toThrow(/gleicher Stand/)
    const ok = parseStandRequest({ ...BODY, stand: 'berichtet', bestaetigen: true })
    expect(ok.bestaetigen).toBe(true)
    expect(() => parseStandRequest({ ...BODY, bestaetigen: 'ja' })).toThrow(StandValidationError)
  })
})

describe('Schutzstufen 2 + 3 (409)', () => {
  it('stand_geaendert: Storage-Stand ≠ Erwartung wirft und traegt den aktuellen Stand', () => {
    expect(() => pruefeStandGeaendert('erschlossen', 'berichtet')).toThrow(StandGeaendertError)
    try {
      pruefeStandGeaendert(null, 'berichtet')
      expect.unreachable('haette geworfen')
    } catch (error) {
      expect((error as StandGeaendertError).aktuellerStand).toBeNull()
      expect((error as StandGeaendertError).message).toMatch(/jemand war schneller/)
    }
    expect(() => pruefeStandGeaendert('berichtet', 'berichtet')).not.toThrow()
    expect(() => pruefeStandGeaendert(null, null)).not.toThrow()
  })

  it('report_veraltet: fremder oder fehlender gespeicherter Report wirft', () => {
    expect(() => pruefeReportVeraltet('A', 'B')).toThrow(ReportVeraltetError)
    expect(() => pruefeReportVeraltet('A', null)).toThrow(/erst scannen/)
    expect(() => pruefeReportVeraltet('A', 'A')).not.toThrow()
  })
})

describe('Stufe 4 — Precheck (nur abgenommen ohne bestaetigen)', () => {
  it('brauchtPrecheck folgt exakt der §F8-Regel', () => {
    expect(brauchtPrecheck({ stand: 'abgenommen', bestaetigen: false })).toBe(true)
    expect(brauchtPrecheck({ stand: 'abgenommen', bestaetigen: true })).toBe(false)
    expect(brauchtPrecheck({ stand: 'berichtet', bestaetigen: false })).toBe(false)
  })

  it('blockiert nur Maschine + error/warning — info und Mensch nicht (strenger als Ampel, enger im Grad)', () => {
    const gaps = [
      gap({ severity: 'error', actor: 'cowork' }),
      gap({ severity: 'warning', actor: 'knowledgescout' }),
      gap({ severity: 'info', actor: 'knowledgescout', type: 'transformation_stale' }),
      gap({ severity: 'error', actor: 'mensch', type: 'twin_flagged' }),
    ]
    const blocker = blockierendeBefunde(gaps)
    expect(blocker.map((b) => b.actor)).toEqual(['cowork', 'knowledgescout'])
    expect(() => pruefeBereitschaft(gaps)).toThrow(NichtBereitError)
    // Nur info + Mensch offen: die Beurkundung ist frei.
    expect(() => pruefeBereitschaft(gaps.slice(2))).not.toThrow()
  })

  it('kappt die Befundliste der Antwort benannt, zaehlt aber alle', () => {
    const viele = Array.from({ length: MAX_BEFUNDE_IN_ANTWORT + 5 }, (_, i) =>
      gap({ path: `1. Arbeit/Pilot/${i}` }),
    )
    try {
      pruefeBereitschaft(viele)
      expect.unreachable('haette geworfen')
    } catch (error) {
      const nichtBereit = error as NichtBereitError
      expect(nichtBereit.befunde).toHaveLength(MAX_BEFUNDE_IN_ANTWORT)
      expect(nichtBereit.gesamt).toBe(MAX_BEFUNDE_IN_ANTWORT + 5)
      expect(nichtBereit.message).toMatch(/25 maschinelle Befunde/)
    }
  })
})

describe('baueStandPatch + kein_index', () => {
  it('schreibt genau die zwei flachen Felder; _seit ist ein DATUM (Zyklus §4)', () => {
    expect(baueStandPatch('abgenommen', '2026-08-24T09:30:00.000Z')).toEqual({
      bearbeitungsstand: 'abgenommen',
      bearbeitungsstand_seit: '2026-08-24',
    })
    expect(() => baueStandPatch('abgenommen', 'quatsch')).toThrow(StandValidationError)
  })

  it('KeinIndexError benennt, dass die Route nie ein _INDEX.md anlegt', () => {
    const error = new KeinIndexError('Pilot')
    expect(error.code).toBe('kein_index')
    expect(error.message).toMatch(/legt nie eines an/)
  })
})
