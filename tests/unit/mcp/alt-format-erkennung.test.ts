/**
 * Welle W9 — Alt-Format-Familien erkennen, statt sie raten zu lassen.
 *
 * Beleg: Von rund 250 Jobs brauchten 60 `erzwingen: true`; in einem
 * Vorhabensordner alle 16. Ohne das Flag meldet der Job `completed` und
 * schreibt nichts — die Meldung luegt.
 */
import { describe, expect, it } from 'vitest'
import {
  entscheideErzwingen,
  hatTransformation,
  istAltFormatFamilie,
} from '@/lib/mcp/alt-format-erkennung'
import type { ShadowTwinDocument } from '@/lib/repositories/shadow-twin-repo'

function record(markdown = '# Inhalt') {
  return { markdown, createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z' }
}

function doc(artifacts: ShadowTwinDocument['artifacts']): ShadowTwinDocument {
  return {
    libraryId: 'lib', sourceId: 's1', sourceName: 'Quelle.m4a', parentId: 'p', userEmail: 'a@b.c',
    artifacts, createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z',
  }
}

describe('hatTransformation', () => {
  it('erkennt eine Transformation unter Template und Sprache', () => {
    expect(hatTransformation(doc({ transformation: { 'standard-meeting': { de: record() } } }))).toBe(true)
  })

  it('zaehlt einen leeren Template-Knoten nicht als Transformation', () => {
    expect(hatTransformation(doc({ transformation: { 'standard-meeting': {} } }))).toBe(false)
    expect(hatTransformation(doc({}))).toBe(false)
    expect(hatTransformation(null)).toBe(false)
  })
})

describe('istAltFormatFamilie', () => {
  it('trifft genau die Konstellation Transformation OHNE Transkript', () => {
    expect(istAltFormatFamilie(doc({ transformation: { t: { de: record() } } }))).toBe(true)
  })

  it('trifft NICHT, wenn das Transkript da ist — dort greift das Gate richtig', () => {
    expect(istAltFormatFamilie(doc({
      transcript: record('Rohtext'),
      transformation: { t: { de: record() } },
    }))).toBe(false)
  })

  it('erkennt auch die sprach-gekeyte Legacy-Form des Transkripts', () => {
    const legacy = doc({ transformation: { t: { de: record() } } })
    // Legacy: Record<lang, record> statt Single-Record.
    ;(legacy.artifacts as unknown as { transcript: unknown }).transcript = { de: record('Rohtext') }
    expect(istAltFormatFamilie(legacy)).toBe(false)
  })

  it('trifft NICHT bei einer noch gar nicht erschlossenen Quelle', () => {
    expect(istAltFormatFamilie(doc({}))).toBe(false)
    expect(istAltFormatFamilie(null)).toBe(false)
  })
})

describe('entscheideErzwingen', () => {
  const altFormat = doc({ transformation: { t: { de: record() } } })
  const vollstaendig = doc({ transcript: record('Rohtext'), transformation: { t: { de: record() } } })

  it('erkennt das Alt-Format von selbst, wenn der Mensch nichts sagt', () => {
    expect(entscheideErzwingen({ angefordert: undefined, doc: altFormat }))
      .toEqual({ erzwingen: true, grund: 'alt_format_erkannt' })
  })

  it('laesst eine normale Quelle in Ruhe', () => {
    expect(entscheideErzwingen({ angefordert: undefined, doc: vollstaendig }))
      .toEqual({ erzwingen: false, grund: 'nicht_noetig' })
  })

  it('respektiert ein ausdrueckliches false auch gegen die Erkennung', () => {
    // Dem Menschen das Werkzeug aus der Hand zu nehmen waere schlechter,
    // als seine Ansage zu befolgen.
    expect(entscheideErzwingen({ angefordert: false, doc: altFormat }))
      .toEqual({ erzwingen: false, grund: 'abgelehnt' })
  })

  it('respektiert ein ausdrueckliches true auch ohne Befund', () => {
    expect(entscheideErzwingen({ angefordert: true, doc: vollstaendig }))
      .toEqual({ erzwingen: true, grund: 'angefordert' })
  })
})
