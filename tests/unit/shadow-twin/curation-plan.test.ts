/**
 * @fileoverview Unit-Tests: Kurations-Patch-Logik (Twin-Datei-Contract §4).
 *
 * Positiv- UND Negativfall je Regel (Projektauftrag, Akzeptanzkriterium 2):
 * Feld-Zaun, twin_status-Werte, Verify-Stempel, Selbst-Verifikations-
 * Invariante, Spiegel-Drift-Gleichheit, Artefakt-Referenz-Validierung.
 */

import { describe, it, expect } from 'vitest'
import {
  CurationValidationError,
  MAX_NOTIZ_LAENGE,
  MirrorDriftError,
  SelfVerificationError,
  buildCurationPatches,
  hasMirrorDrift,
  humanActor,
  parseCurationArtifactRef,
} from '@/lib/shadow-twin/curation-plan'

const NOW = '2026-08-19T10:00:00.000Z'
const USER = 'peter@example.org'

describe('buildCurationPatches — Fehler-Markierung (ADR 0006)', () => {
  const basis = { verify: false, userEmail: USER, generatedBy: 'knowledgescout/gemini-2.5-pro', now: NOW }

  it('stempelt Status, Urheber und Zeit selbst; die Notiz kommt vom Aufrufer', () => {
    const patches = buildCurationPatches({ ...basis, markiere: { notiz: 'Sprecher vertauscht' } })
    expect(patches).toEqual({
      twin_status: 'flagged',
      flagged_by: `human:${USER}`,
      flagged_at: NOW,
      flagged_note: 'Sprecher vertauscht',
    })
  })

  it('verlangt eine Notiz — leer oder nur Leerzeichen wird abgelehnt', () => {
    expect(() => buildCurationPatches({ ...basis, markiere: { notiz: '' } })).toThrow(CurationValidationError)
    expect(() => buildCurationPatches({ ...basis, markiere: { notiz: '   ' } })).toThrow(CurationValidationError)
  })

  it('haelt die Notiz einzeilig und begrenzt (flaches Frontmatter)', () => {
    const mehrzeilig = ['Zeile eins', '', 'Zeile zwei'].join(String.fromCharCode(10))
    const patches = buildCurationPatches({ ...basis, markiere: { notiz: mehrzeilig } })
    expect(patches.flagged_note).toBe('Zeile eins Zeile zwei')
    expect(() =>
      buildCurationPatches({ ...basis, markiere: { notiz: 'x'.repeat(MAX_NOTIZ_LAENGE + 1) } }),
    ).toThrow(/Notiz zu lang/)
  })

  it('lehnt `twin_status: flagged` ueber den Feld-Patch ab — sonst fehlt die Notiz', () => {
    expect(() => buildCurationPatches({ ...basis, set: { twin_status: 'flagged' } })).toThrow(
      /Markier-Aktion/,
    )
  })

  it('lehnt Markieren und Verifizieren in einem Zug ab', () => {
    expect(() =>
      buildCurationPatches({ ...basis, verify: true, markiere: { notiz: 'passt nicht' } }),
    ).toThrow(CurationValidationError)
  })

  it('loest die Markierung beim Verifizieren auf — die Felder fallen weg (null)', () => {
    const patches = buildCurationPatches({
      ...basis, verify: true, aktuellerTwinStatus: 'flagged',
    })
    expect(patches).toEqual({
      verified_by: `human:${USER}`,
      verified_at: NOW,
      twin_status: null,
      flagged_by: null,
      flagged_at: null,
      flagged_note: null,
    })
  })

  it('laesst einen anderen twin_status beim Verifizieren unangetastet', () => {
    const patches = buildCurationPatches({ ...basis, verify: true, aktuellerTwinStatus: 'stable' })
    expect(patches).toEqual({ verified_by: `human:${USER}`, verified_at: NOW })
  })

  it('gibt einem ausdruecklich mitgesetzten twin_status den Vorrang', () => {
    const patches = buildCurationPatches({
      ...basis, verify: true, aktuellerTwinStatus: 'flagged', set: { twin_status: 'draft' },
    })
    expect(patches.twin_status).toBe('draft')
    expect(patches.flagged_by).toBeUndefined()
  })
})

describe('buildCurationPatches — Feld-Zaun (Contract §4.1/§4.4)', () => {
  it('patcht twin_status mit gueltigem Wert', () => {
    const patches = buildCurationPatches({
      set: { twin_status: 'stable' }, verify: false, userEmail: USER,
      generatedBy: 'knowledgescout/gemini-2.5-pro', now: NOW,
    })
    expect(patches).toEqual({ twin_status: 'stable' })
  })

  it('lehnt ungueltige twin_status-Werte ab', () => {
    expect(() =>
      buildCurationPatches({
        set: { twin_status: 'final' }, verify: false, userEmail: USER,
        generatedBy: 'knowledgescout/gemini-2.5-pro', now: NOW,
      }),
    ).toThrow(CurationValidationError)
  })

  it('lehnt fremde Felder ab — verified_by ist nie direkt patchbar', () => {
    expect(() =>
      buildCurationPatches({
        set: { verified_by: 'human:angreifer' }, verify: false, userEmail: USER,
        generatedBy: 'knowledgescout/gemini-2.5-pro', now: NOW,
      }),
    ).toThrow(/verified_by/)
    expect(() =>
      buildCurationPatches({
        set: { title: 'Neuer Titel' }, verify: false, userEmail: USER,
        generatedBy: 'knowledgescout/gemini-2.5-pro', now: NOW,
      }),
    ).toThrow(CurationValidationError)
  })

  it('lehnt einen leeren Patch ab (kein stiller No-op)', () => {
    expect(() =>
      buildCurationPatches({ set: {}, verify: false, userEmail: USER, generatedBy: undefined, now: NOW }),
    ).toThrow(CurationValidationError)
  })
})

describe('buildCurationPatches — Verify-Aktion (F4)', () => {
  it('stempelt verified_by: human:<email> und verified_at serverseitig', () => {
    const patches = buildCurationPatches({
      verify: true, userEmail: USER, generatedBy: 'knowledgescout/gemini-2.5-pro', now: NOW,
    })
    expect(patches).toEqual({ verified_by: `human:${USER}`, verified_at: NOW })
  })

  it('kombiniert Verify mit twin_status in EINEM Patch', () => {
    const patches = buildCurationPatches({
      set: { twin_status: 'stable' }, verify: true, userEmail: USER,
      generatedBy: 'knowledgescout/gemini-2.5-pro', now: NOW,
    })
    expect(patches.twin_status).toBe('stable')
    expect(patches.verified_by).toBe(`human:${USER}`)
  })

  it('verweigert Selbst-Verifikation auf Actor-Ebene (Contract §3.2)', () => {
    expect(() =>
      buildCurationPatches({ verify: true, userEmail: USER, generatedBy: `human:${USER}`, now: NOW }),
    ).toThrow(SelfVerificationError)
  })

  it('Legacy-Twin ohne generated_by darf verifiziert werden', () => {
    const patches = buildCurationPatches({ verify: true, userEmail: USER, generatedBy: undefined, now: NOW })
    expect(patches.verified_by).toBe(`human:${USER}`)
  })

  it('humanActor verweigert leere Email (kein geratener Akteur)', () => {
    expect(() => humanActor('   ')).toThrow(CurationValidationError)
  })
})

describe('hasMirrorDrift — Spiegel-Drift-Guard (Contract §4.3)', () => {
  const mongo = '---\ntype: transcript\n---\n\nInhalt.\n'

  it('kein Drift bei identischem Inhalt — CRLF und Rand-Whitespace zaehlen nicht', () => {
    expect(hasMirrorDrift({ mongoMarkdown: mongo, mirrorMarkdown: mongo })).toBe(false)
    const crlf = mongo.replace(/\n/g, '\r\n') + '\r\n'
    expect(hasMirrorDrift({ mongoMarkdown: mongo, mirrorMarkdown: crlf })).toBe(false)
  })

  it('Drift bei abweichendem Inhalt (Handkorrektur am Spiegel)', () => {
    const edited = mongo.replace('Inhalt.', 'Inhalt, von Hand korrigiert.')
    expect(hasMirrorDrift({ mongoMarkdown: mongo, mirrorMarkdown: edited })).toBe(true)
  })

  it('fehlender Spiegel ist KEIN Drift — der naechste Export erzeugt ihn', () => {
    expect(hasMirrorDrift({ mongoMarkdown: mongo, mirrorMarkdown: null })).toBe(false)
  })

  it('MirrorDriftError nennt die Spiegel-Datei und den Import-Weg', () => {
    const error = new MirrorDriftError('X.standard.de.md')
    expect(error.code).toBe('mirror_drift')
    expect(error.message).toContain('X.standard.de.md')
    expect(error.message).toContain('importieren')
  })
})

describe('parseCurationArtifactRef — exakte Adressierung (ArtifactKey-Contract)', () => {
  it('akzeptiert Transkript (sprachneutral) und Transformation (Template + Sprache)', () => {
    expect(parseCurationArtifactRef({ kind: 'transcript', targetLanguage: '' })).toEqual({
      kind: 'transcript', targetLanguage: '', templateName: undefined,
    })
    expect(
      parseCurationArtifactRef({ kind: 'transformation', targetLanguage: 'de', templateName: 'standard' }),
    ).toEqual({ kind: 'transformation', targetLanguage: 'de', templateName: 'standard' })
  })

  it('verweigert Transformation ohne templateName oder ohne Sprache (kein Raten)', () => {
    expect(() => parseCurationArtifactRef({ kind: 'transformation', targetLanguage: 'de' })).toThrow(
      CurationValidationError,
    )
    expect(() =>
      parseCurationArtifactRef({ kind: 'transformation', templateName: 'standard', targetLanguage: '' }),
    ).toThrow(CurationValidationError)
  })

  it('verweigert templateName am Transkript und unbekannte kinds', () => {
    expect(() =>
      parseCurationArtifactRef({ kind: 'transcript', targetLanguage: '', templateName: 'standard' }),
    ).toThrow(CurationValidationError)
    expect(() => parseCurationArtifactRef({ kind: 'bericht', targetLanguage: '' })).toThrow(
      CurationValidationError,
    )
    expect(() => parseCurationArtifactRef(null)).toThrow(CurationValidationError)
  })
})
