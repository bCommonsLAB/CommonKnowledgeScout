import { describe, it, expect, vi } from 'vitest'
import {
  classifyReference,
  classifyReferences,
  groupReferencesByFormat,
  referenceDisplayName,
  REFERENCE_FORMAT_ORDER,
  type ReferenceFormat,
} from '@/lib/library/reference-format'

describe('classifyReference', () => {
  const cases: Array<[string, ReferenceFormat]> = [
    ['https://example.com/doc.pdf', 'pdf'],
    ['https://example.com/talk.mp3', 'audio'],
    ['https://example.com/clip.mp4', 'video'],
    ['https://example.com/photo.JPG', 'image'],
    ['https://example.com/sheet.xlsx', 'office'],
    ['https://example.com/slides.pptx', 'office'],
    ['https://example.com/notes.md', 'markdown'],
    ['https://example.com/page', 'web'],
    ['https://example.com', 'web'],
  ]

  it.each(cases)('klassifiziert %s als %s', (url, expected) => {
    expect(classifyReference(url)).toBe(expected)
  })

  it('ignoriert Query-String und Fragment bei der Endung', () => {
    expect(classifyReference('https://blob.core/abc.pdf?sig=xyz&t=1')).toBe('pdf')
    expect(classifyReference('https://x/clip.webm#t=10')).toBe('video')
  })

  it('dekodiert URL-codierte Dateinamen (z.B. Leerzeichen)', () => {
    expect(classifyReference('https://blob/My%20File.pdf')).toBe('pdf')
  })

  it('behandelt blanke Dateinamen ohne Host', () => {
    expect(classifyReference('report.pdf')).toBe('pdf')
    expect(classifyReference('image.png')).toBe('image')
  })

  it('Verweis ohne Endung ist ein Web-Link (kein Warn-Log)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(classifyReference('https://example.com/article/123')).toBe('web')
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('referenceDisplayName', () => {
  it('nimmt den Dateinamen aus dem Pfad', () => {
    expect(referenceDisplayName('https://blob/path/Bericht%202024.pdf')).toBe('Bericht 2024.pdf')
  })

  it('faellt auf Hostname + Pfad zurueck, wenn kein Dateiname', () => {
    expect(referenceDisplayName('https://example.com/about')).toBe('example.com/about')
  })

  it('gibt den Rohwert bei ungueltiger URL zurueck', () => {
    expect(referenceDisplayName('nicht-eine-url')).toBe('nicht-eine-url')
  })
})

describe('classifyReferences', () => {
  it('filtert leere/whitespace-Eintraege und behaelt die Reihenfolge', () => {
    const out = classifyReferences(['https://x/a.pdf', '  ', 'https://x/b.mp3'])
    expect(out).toHaveLength(2)
    expect(out[0]).toMatchObject({ url: 'https://x/a.pdf', format: 'pdf' })
    expect(out[1]).toMatchObject({ url: 'https://x/b.mp3', format: 'audio' })
  })

  it('liefert [] bei undefined', () => {
    expect(classifyReferences(undefined)).toEqual([])
  })

  it('klassifiziert {url,name} nach dem Namen, verlinkt aber die URL', () => {
    // Aufgeloeste Blob-URL ohne Endung, Format steckt im Dateinamen.
    const out = classifyReferences([
      { url: 'https://blob.core/api/storage?id=abc', name: 'Folien.pdf' },
    ])
    expect(out[0]).toEqual({
      url: 'https://blob.core/api/storage?id=abc',
      format: 'pdf',
      name: 'Folien.pdf',
    })
  })

  it('faellt ohne Namen auf die URL-Klassifikation zurueck', () => {
    const out = classifyReferences([{ url: 'https://x/clip.mp4' }])
    expect(out[0]).toMatchObject({ format: 'video', name: 'clip.mp4' })
  })
})

describe('groupReferencesByFormat', () => {
  it('gruppiert in stabiler Reihenfolge und laesst leere Gruppen weg', () => {
    const refs = classifyReferences([
      'https://x/link', // web
      'https://x/a.png', // image
      'https://x/b.pdf', // pdf
    ])
    const groups = groupReferencesByFormat(refs)
    expect(groups.map((g) => g.format)).toEqual(['image', 'pdf', 'web'])
  })

  it('REFERENCE_FORMAT_ORDER deckt alle Formate genau einmal ab', () => {
    expect(new Set(REFERENCE_FORMAT_ORDER).size).toBe(REFERENCE_FORMAT_ORDER.length)
  })
})
