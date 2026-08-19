import { describe, it, expect } from 'vitest'
import { normalizeTarget, parseReferences, uniqueReferences } from '@/lib/agent-view/reference-parser'

describe('reference-parser', () => {
  it('liest Wikilinks inkl. Alias und Embed', () => {
    const refs = parseReferences('Siehe [[Konzept.md]], [[10_Bericht|der Bericht]] und ![[bild.png]].')
    expect(refs.map((r) => r.target)).toEqual(['Konzept.md', '10_Bericht', 'bild.png'])
    expect(refs[1].label).toBe('der Bericht')
  })

  it('liest relative Markdown-Links, ignoriert externe und Anker', () => {
    const body = [
      '[intern](_Quelle.pdf/Quelle.md)',
      '[extern](https://example.org/x.md)',
      '[mail](mailto:a@b.c)',
      '[anker](#abschnitt)',
      '[absolut](/root/x.md)',
    ].join('\n')
    expect(parseReferences(body).map((r) => r.target)).toEqual(['_Quelle.pdf/Quelle.md'])
  })

  it('ignoriert Verweise in Code-Bloecken und Inline-Code', () => {
    const body = '```\n[[NichtEinVerweis]]\n```\nText `[[AuchNicht]]` Ende [[Doch.md]]'
    expect(parseReferences(body).map((r) => r.target)).toEqual(['Doch.md'])
  })

  it('normalisiert Anker, Prozent-Kodierung und ./-Praefix', () => {
    expect(normalizeTarget('./Ordner/Datei%20A.md#Kapitel')).toBe('Ordner/Datei A.md')
    expect(normalizeTarget('Datei.md^block')).toBe('Datei.md')
  })

  it('dedupliziert case-insensitiv und haelt die Reihenfolge', () => {
    const refs = uniqueReferences(parseReferences('[[A.md]] [[a.md]] [[B.md]]'))
    expect(refs.map((r) => r.target)).toEqual(['A.md', 'B.md'])
  })

  it('findet in einem Text ohne Verweise nichts (Negativfall)', () => {
    expect(parseReferences('Reiner Fliesstext ohne Links.')).toEqual([])
  })
})
