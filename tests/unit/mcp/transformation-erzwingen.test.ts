/**
 * @fileoverview Unit-Tests: Gate-Entscheidung fuer `transformation_starten`.
 *
 * Befund 21.09.2026: Haengt am Twin schon eine Transformation, ueberspringt der
 * Worker die Template-Phase und meldet `completed`. Die Entscheidung, das Gate
 * zu uebergehen, faellt hier — sichtbar, mit Grund; eine aktuelle
 * Transformation fuehrt zur Absage statt zu einem Job, der nichts schreibt.
 */

import { describe, it, expect } from 'vitest'
import { entscheideTransformationErzwingen } from '@/lib/mcp/transformation-erzwingen'
import type { ShadowTwinDocument } from '@/lib/repositories/shadow-twin-repo'

const TEMPLATE = 'commoning-methode-de'

function twin(args: { transformationAm?: string; template?: string; transkriptAm?: string }): ShadowTwinDocument {
  const record = (am: string) => ({ markdown: '# x', createdAt: am, updatedAt: am })
  return {
    libraryId: 'lib-1', sourceId: 's1', sourceName: 'a.md', parentId: 'p', userEmail: 'u@e.com',
    createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
    artifacts: {
      ...(args.transkriptAm ? { transcript: record(args.transkriptAm) } : {}),
      ...(args.transformationAm
        ? { transformation: { [args.template ?? TEMPLATE]: { de: record(args.transformationAm) } } }
        : {}),
    },
  }
}

function entscheide(doc: ShadowTwinDocument | null, angefordert?: boolean, vorlageAm?: string) {
  return entscheideTransformationErzwingen({
    angefordert, doc, template: TEMPLATE, zielsprache: 'de', vorlageAktualisiertAm: vorlageAm,
  })
}

describe('entscheideTransformationErzwingen', () => {
  it('ausdrueckliche Angabe gewinnt in beide Richtungen', () => {
    const aktuell = twin({ transformationAm: '2026-09-21T14:00:00.000Z' })
    expect(entscheide(aktuell, true, '2026-09-01T00:00:00.000Z')).toEqual({ erzwingen: true, grund: 'angefordert' })
    expect(entscheide(aktuell, false, '2026-09-22T00:00:00.000Z')).toEqual({ erzwingen: false, grund: 'abgelehnt' })
  })

  it('ohne Twin oder ohne Transformation: nicht noetig, das Gate laesst durch', () => {
    expect(entscheide(null)).toEqual({ erzwingen: false, grund: 'nicht_noetig' })
    expect(entscheide(twin({ transkriptAm: '2026-09-01T00:00:00.000Z' }))).toEqual({ erzwingen: false, grund: 'nicht_noetig' })
  })

  it('Vorlage juenger als die Transformation: erzwingen', () => {
    const doc = twin({ transformationAm: '2026-09-18T10:00:00.000Z' })
    expect(entscheide(doc, undefined, '2026-09-21T13:00:00.000Z')).toEqual({ erzwingen: true, grund: 'vorlage_juenger' })
  })

  it('Transkript juenger als die Transformation: erzwingen', () => {
    const doc = twin({ transformationAm: '2026-09-18T10:00:00.000Z', transkriptAm: '2026-09-19T10:00:00.000Z' })
    expect(entscheide(doc, undefined, '2026-09-01T00:00:00.000Z')).toEqual({ erzwingen: true, grund: 'transkript_juenger' })
  })

  it('nur eine ANDERE Vorlage transformiert: erzwingen, sonst ueberspringt das Gate trotzdem', () => {
    const doc = twin({ transformationAm: '2026-09-18T10:00:00.000Z', template: 'standard-meeting' })
    expect(entscheide(doc, undefined, '2026-09-01T00:00:00.000Z')).toEqual({ erzwingen: true, grund: 'andere_vorlage' })
  })

  it('aktuelle Transformation: Absage mit beiden Zeitpunkten, kein stiller Lauf', () => {
    const doc = twin({ transformationAm: '2026-09-21T14:00:00.000Z' })
    expect(() => entscheide(doc, undefined, '2026-09-21T13:00:00.000Z'))
      .toThrow(/ist aktuell.*2026-09-21T14:00.*2026-09-21T13:00.*erzwingen: true.*Kein Job/s)
  })

  it('unbekannter Vorlagen-Zeitpunkt zaehlt nicht als juenger — Absage nennt "unbekannt"', () => {
    const doc = twin({ transformationAm: '2026-09-21T14:00:00.000Z' })
    expect(() => entscheide(doc, undefined, undefined)).toThrow(/Vorlage vom unbekannt/)
  })
})
