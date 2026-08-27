/**
 * @fileoverview Unit-Tests: Kurations-Stempel altern den Inhalt nicht.
 *
 * Befund 27.08.2026 („die Tretmuehle"): Verifizieren schreibt das Artefakt,
 * also wanderte sein `updatedAt` nach vorn. Regeln, die Zeitstempel
 * vergleichen, lasen darin eine Inhalts-Aenderung — jeder Pruef-Klick machte
 * den Bericht veraltet und liess die Zusammenfassung ueberholt aussehen, was
 * eine Re-Transformation ausloeste, die die eben gesetzte Verifikation wieder
 * entwertete. Eine Schleife, die sich durch Arbeiten nicht schliessen laesst.
 */

import { describe, it, expect } from 'vitest'
import {
  checkTransformationState,
  inhaltsZeitpunkt,
  type TwinArtifactView,
  type TwinFamilyView,
} from '@/lib/agent-view/twin-rules'
import { buildOwnChangeByFolder } from '@/lib/agent-view/coverage-inputs'

const ERZEUGT = '2026-08-20T10:00:00.000Z'
const GEPRUEFT = '2026-08-27T12:46:14.000Z'

function artefakt(overrides: Partial<TwinArtifactView> = {}, fm: Record<string, unknown> = {}): TwinArtifactView {
  return {
    kind: 'transcript',
    targetLanguage: '',
    updatedAt: ERZEUGT,
    frontmatter: { type: 'transcript', generated_at: ERZEUGT, ...fm },
    ...overrides,
  }
}

function familie(artifacts: TwinArtifactView[]): TwinFamilyView {
  return { sourceId: 's1', sourceName: 'Protokoll.docx', folderId: 'f1', path: 'V/Protokoll.docx', artifacts }
}

describe('inhaltsZeitpunkt', () => {
  it('nimmt den Erzeugungs-Zeitpunkt, wenn der letzte Write die Verifikation war', () => {
    const geprueft = artefakt({ updatedAt: GEPRUEFT }, { verified_at: GEPRUEFT, verified_by: 'human:peter' })
    expect(inhaltsZeitpunkt(geprueft)).toBe(ERZEUGT)
  })

  it('gilt genauso fuer eine Fehler-Markierung', () => {
    const markiert = artefakt({ updatedAt: GEPRUEFT }, { flagged_at: GEPRUEFT, twin_status: 'flagged' })
    expect(inhaltsZeitpunkt(markiert)).toBe(ERZEUGT)
  })

  it('laesst Handkorrekturen Inhalts-Aenderungen bleiben — sie tragen keinen Stempel', () => {
    const handKorrigiert = artefakt({ updatedAt: '2026-08-27T14:00:00.000Z' })
    expect(inhaltsZeitpunkt(handKorrigiert)).toBe('2026-08-27T14:00:00.000Z')
  })

  it('zaehlt eine SPAETERE Aenderung nach der Verifikation als Inhalt', () => {
    // Stempel von gestern, Write von heute ⇒ jemand hat danach angefasst.
    const spaeter = artefakt({ updatedAt: '2026-08-27T18:00:00.000Z' }, { verified_at: GEPRUEFT })
    expect(inhaltsZeitpunkt(spaeter)).toBe('2026-08-27T18:00:00.000Z')
  })

  it('faellt ohne `generated_at` auf den Write zurueck (twin_core_missing meldet das Feld)', () => {
    const ohne = artefakt({ updatedAt: GEPRUEFT }, { verified_at: GEPRUEFT, generated_at: undefined })
    expect(inhaltsZeitpunkt(ohne)).toBe(GEPRUEFT)
  })
})

describe('bericht_veraltet: die juengste Aenderung je Ordner', () => {
  it('wandert durch eine Verifikation NICHT nach vorn', () => {
    const vorher = buildOwnChangeByFolder({ folders: [], families: [familie([artefakt()])] })
    const nachher = buildOwnChangeByFolder({
      folders: [],
      families: [familie([artefakt({ updatedAt: GEPRUEFT }, { verified_at: GEPRUEFT })])],
    })
    expect(nachher.get('f1')).toBe(vorher.get('f1'))
    expect(nachher.get('f1')).toBe(ERZEUGT)
  })
})

describe('transformation_stale: das Transkript altert die Zusammenfassung nicht durch Pruefen', () => {
  const STANDARD = 'standard-meeting'

  function transformation(updatedAt: string, fm: Record<string, unknown> = {}): TwinArtifactView {
    return {
      kind: 'transformation',
      templateName: STANDARD,
      targetLanguage: 'de',
      updatedAt,
      frontmatter: { type: 'transformation', template: STANDARD, language: 'de', generated_at: updatedAt, ...fm },
    }
  }

  it('meldet nichts, wenn nur das Transkript verifiziert wurde', () => {
    const geprueftesTranskript = artefakt({ updatedAt: GEPRUEFT }, { verified_at: GEPRUEFT })
    const zusammenfassung = transformation('2026-08-20T11:00:00.000Z')
    expect(checkTransformationState(familie([geprueftesTranskript, zusammenfassung]), STANDARD)).toEqual([])
  })

  it('meldet weiterhin, wenn das Transkript INHALTLICH neuer ist', () => {
    const neuesTranskript = artefakt({ updatedAt: '2026-08-27T18:00:00.000Z' }, { generated_at: '2026-08-27T18:00:00.000Z' })
    const zusammenfassung = transformation('2026-08-20T11:00:00.000Z')
    const gaps = checkTransformationState(familie([neuesTranskript, zusammenfassung]), STANDARD)
    expect(gaps.map((g) => g.type)).toEqual(['transformation_stale'])
  })
})
