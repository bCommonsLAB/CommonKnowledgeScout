import { describe, it, expect } from 'vitest'
import { gapsFromFieldVerification } from '@/lib/agent-view/field-gaps'
import type { SourceLocation } from '@/lib/agent-view/engine-gaps'
import type { DocumentVerificationResult } from '@/lib/library-verification/types'

const LOCATIONS = new Map<string, SourceLocation>([['f1', { folderId: 'ordner-1', path: '25.01 Pilot/Aufnahme.m4a' }]])

function doc(overrides: Partial<DocumentVerificationResult>): DocumentVerificationResult {
  return { fileId: 'f1', fileName: 'Aufnahme.m4a', issues: [], ok: true, ...overrides }
}

describe('field-gaps — core_fields_missing', () => {
  it('uebersetzt missing-base-field in einen Befund je Dokument (Positivfall)', () => {
    const gaps = gapsFromFieldVerification({
      documents: [
        doc({
          ok: false,
          issues: [
            { code: 'missing-base-field', severity: 'error', field: 'title', message: 'fehlt', autoFixable: false },
            { code: 'missing-base-field', severity: 'error', field: 'authors', message: 'fehlt', autoFixable: false },
          ],
        }),
      ],
      locations: LOCATIONS,
      rootFolderId: 'root',
    })
    expect(gaps).toHaveLength(1)
    expect(gaps[0].type).toBe('core_fields_missing')
    expect(gaps[0].detail).toBe('authors, title')
    expect(gaps[0].actor).toBe('knowledgescout')
    expect(gaps[0].path).toBe('25.01 Pilot/Aufnahme.m4a')
  })

  it('ignoriert alle anderen A1-Befund-Codes (Negativfall — keine Doppel-Anzeige)', () => {
    const gaps = gapsFromFieldVerification({
      documents: [
        doc({
          ok: false,
          issues: [
            { code: 'facet-type-mismatch', severity: 'warning', field: 'tags', message: 'x', autoFixable: false },
            { code: 'invalid-detail-view-type', severity: 'error', field: 'detailViewType', message: 'x', autoFixable: false },
          ],
        }),
      ],
      locations: LOCATIONS,
      rootFolderId: 'root',
    })
    expect(gaps).toEqual([])
  })

  it('haengt unbekannte Dokumente an die Wurzel statt sie zu verlieren', () => {
    const gaps = gapsFromFieldVerification({
      documents: [
        doc({
          fileId: 'unbekannt',
          fileName: 'Fremd.pdf',
          ok: false,
          issues: [{ code: 'missing-base-field', severity: 'error', field: 'date', message: 'fehlt', autoFixable: false }],
        }),
      ],
      locations: LOCATIONS,
      rootFolderId: 'root',
    })
    expect(gaps[0].folderId).toBe('root')
    expect(gaps[0].path).toBe('Fremd.pdf')
  })

  it('laesst unbekannte Dokumente bei Teilbaum-Scans weg (Pilot-Befund B2: Fremddokument an jeder Wurzel)', () => {
    const fremd = doc({
      fileId: 'unbekannt',
      fileName: 'Fremd.pdf',
      ok: false,
      issues: [{ code: 'missing-base-field', severity: 'error', field: 'date', message: 'fehlt', autoFixable: false }],
    })
    const scoped = gapsFromFieldVerification({
      documents: [fremd], locations: LOCATIONS, rootFolderId: 'scope-root', scoped: true,
    })
    expect(scoped).toHaveLength(0)

    // Bekannte Dokumente bleiben auch im Teilbaum-Scope Befunde.
    const bekannt = doc({
      ok: false,
      issues: [{ code: 'missing-base-field', severity: 'error', field: 'date', message: 'fehlt', autoFixable: false }],
    })
    const scopedBekannt = gapsFromFieldVerification({
      documents: [bekannt], locations: LOCATIONS, rootFolderId: 'scope-root', scoped: true,
    })
    expect(scopedBekannt).toHaveLength(1)
  })
})

/**
 * W1 (Wunschliste 4) — die Fehlergewichtung.
 *
 * 487 von 1.005 Befunden waren `core_fields_missing`, 465 davon (95,5 %)
 * betrafen NUR `date`. Als `error` sperrten sie die Abnahme von zwoelf
 * Vorhaben — obwohl drei von vier ableitbar sind. Die Einstufung entsteht
 * beim SCAN, also stufen sich die Altbefunde um, ohne dass ein Job laeuft.
 */
describe('field-gaps — Gewichtung der Datums-Befunde (W1)', () => {
  function nurDatumFehlt(fileId: string, fileName: string): DocumentVerificationResult {
    return {
      fileId,
      fileName,
      ok: false,
      issues: [{ code: 'missing-base-field', severity: 'error', field: 'date', message: 'fehlt', autoFixable: false }],
    }
  }

  function gapsFuer(fileName: string, path: string) {
    return gapsFromFieldVerification({
      documents: [nurDatumFehlt('x1', fileName)],
      locations: new Map<string, SourceLocation>([['x1', { folderId: 'o1', path }]]),
      rootFolderId: 'root',
    })
  }

  it('stuft auf info herab, wenn das Datum im Ablagepfad steht', () => {
    const [gap] = gapsFuer('Notiz.pdf', '4. Aktivismus/2025-07-16 Besprechung/Notiz.pdf')
    expect(gap.type).toBe('datum_ableitbar')
    expect(gap.severity).toBe('info')
    expect(gap.detail).toContain('2025-07-16')
    expect(gap.detail).toContain('2025-07-16 Besprechung')
  })

  it('weist die Monatsschaerfe aus, statt sie zu verschweigen', () => {
    const [gap] = gapsFuer('Notiz.pdf', '9. Wissen/2025-07 Sammlung/Notiz.pdf')
    expect(gap.type).toBe('datum_ableitbar')
    expect(gap.detail).toContain('monatsscharf')
  })

  it('stuft Tonaufnahmen auch ohne Datum im Pfad herab — der Zeitstempel traegt dort', () => {
    const [gap] = gapsFuer('Aufnahme.m4a', '26.01 Klimamassnahmen/Aufnahme.m4a')
    expect(gap.type).toBe('datum_ableitbar')
    expect(gap.severity).toBe('info')
  })

  it('bleibt bei PDF ohne Pfaddatum ein offener Mangel — aber warning, nicht error', () => {
    const [gap] = gapsFuer('Vertrag.pdf', '26.01 Klimamassnahmen/Vertrag.pdf')
    expect(gap.type).toBe('datum_fehlt')
    expect(gap.severity).toBe('warning')
  })

  it('bleibt error, sobald ein weiteres Pflichtfeld fehlt — auch mit ableitbarem Datum', () => {
    const gaps = gapsFromFieldVerification({
      documents: [
        {
          fileId: 'x1',
          fileName: 'Notiz.pdf',
          ok: false,
          issues: [
            { code: 'missing-base-field', severity: 'error', field: 'date', message: 'fehlt', autoFixable: false },
            { code: 'missing-base-field', severity: 'error', field: 'authors', message: 'fehlt', autoFixable: false },
          ],
        },
      ],
      locations: new Map<string, SourceLocation>([['x1', { folderId: 'o1', path: '2025-07-16 Besprechung/Notiz.pdf' }]]),
      rootFolderId: 'root',
    })
    expect(gaps[0].type).toBe('core_fields_missing')
    expect(gaps[0].severity).toBe('error')
    expect(gaps[0].detail).toBe('authors, date')
  })
})

describe('field-gaps — unplausibles Datum (W5)', () => {
  it('uebersetzt implausible-date in einen eigenen Befund bei Cowork', () => {
    const gaps = gapsFromFieldVerification({
      documents: [
        doc({
          ok: false,
          issues: [
            { code: 'implausible-date', severity: 'warning', field: 'date', message: 'Inhaltsdatum liegt in der Zukunft: 2026-10-01.', autoFixable: false },
          ],
        }),
      ],
      locations: LOCATIONS,
      rootFolderId: 'root',
    })
    expect(gaps).toHaveLength(1)
    expect(gaps[0].type).toBe('datum_unplausibel')
    expect(gaps[0].actor).toBe('cowork')
    expect(gaps[0].severity).toBe('warning')
  })

  it('meldet fehlendes UND falsches Datum getrennt — verschiedene Zustaende, verschiedene Akteure', () => {
    const gaps = gapsFromFieldVerification({
      documents: [
        doc({
          ok: false,
          issues: [
            { code: 'missing-base-field', severity: 'error', field: 'authors', message: 'fehlt', autoFixable: false },
            { code: 'implausible-date', severity: 'warning', field: 'date', message: 'x', autoFixable: false },
          ],
        }),
      ],
      locations: LOCATIONS,
      rootFolderId: 'root',
    })
    expect(gaps.map((g) => g.type)).toEqual(['core_fields_missing', 'datum_unplausibel'])
  })
})
