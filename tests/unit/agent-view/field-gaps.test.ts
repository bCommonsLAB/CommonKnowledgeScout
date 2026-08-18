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
})
