import { describe, it, expect } from 'vitest'
import type { ArchiveDocEntry } from '@/lib/agent-view/archive-types'
import { auditReferences, buildReferenceIndex } from '@/lib/agent-view/reference-audit'
import { parseReferences } from '@/lib/agent-view/reference-parser'

const BODY = [
  'Siehe [[@klima/Veranstaltungen/Flyer.pdf|Flyer]] und [Bericht](@dachverband/events/BERICHT.md).',
  'Tippfehler: [[@unbekannt/a.md]], kaputt: [[@Klima Archiv/a.md]].',
  'Normal: [[Notiz.md]].',
].join('\n')

function doc(body: string): ArchiveDocEntry {
  return {
    fileId: 'ber-1', name: 'BERICHT.md', path: '24.09 KS/BERICHT.md', modifiedAt: '2026-10-13T08:00:00.000Z',
    meta: {}, body,
  }
}

describe('parseReferences — library-adresse', () => {
  it('erkennt @-Ziele in Wikilinks und Markdown-Links als eigene Syntax', () => {
    const syntax = parseReferences(BODY).map((ref) => `${ref.syntax}:${ref.target}`)
    expect(syntax).toContain('library-adresse:@klima/Veranstaltungen/Flyer.pdf')
    expect(syntax).toContain('library-adresse:@dachverband/events/BERICHT.md')
    expect(syntax).toContain('wikilink:Notiz.md')
  })
})

describe('auditReferences — library-adresse', () => {
  const index = buildReferenceIndex([
    { kind: 'file', name: 'Notiz.md', path: '24.09 KS/Notiz.md', modifiedAt: '2026-10-01T00:00:00.000Z' },
  ])

  it('meldet unbekannte und unlesbare Adressen als verweis_tot, bekannte nie', () => {
    const gaps = auditReferences({ doc: doc(BODY), folderId: 'f', index, libraryAdressen: new Set(['klima', 'dachverband']) })
    const tot = gaps.filter((g) => g.type === 'verweis_tot').map((g) => g.message)
    expect(tot).toHaveLength(2)
    expect(tot.some((m) => m.includes('unbekannte Library (@unbekannt)'))).toBe(true)
    expect(tot.some((m) => m.includes('nicht lesbar'))).toBe(true)
  })

  it('laesst Adressen ohne Verzeichnis ungeprueft — kein geratenes verweis_tot', () => {
    const gaps = auditReferences({ doc: doc(BODY), folderId: 'f', index, libraryAdressen: null })
    expect(gaps.filter((g) => g.type === 'verweis_tot')).toEqual([])
  })
})
