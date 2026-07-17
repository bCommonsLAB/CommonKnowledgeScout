/**
 * @fileoverview Unit-Tests fuer selectBestArtifactVariant („vollstaendigster gewinnt").
 *
 * @description
 * Sichert den Kern-Fix gegen die Regression ab, die `_Ökoniomie_en_Innen.pdf`
 * zerstoert hat: die suffixlose, neuere, aber EINSEITIGE Variante darf NICHT
 * mehr gewinnen — der vollstaendigste Inhalt gewinnt.
 */

import { describe, it, expect } from 'vitest'
import {
  selectBestArtifactVariant,
  countPageMarkers,
  type ArtifactVariant,
} from '@/lib/shadow-twin/select-best-artifact-variant'

/** Erzeugt Markdown mit n Seiten-Markern + Fuelltext gewuenschter Mindestlaenge. */
function pages(n: number, filler = ''): string {
  const blocks = Array.from({ length: n }, (_, i) => `# page_${String(i + 1).padStart(3, '0')}.jpeg\nSeite: ${i + 1}`)
  return blocks.join('\n\n') + (filler ? `\n\n${filler}` : '')
}

function variant(name: string, markdown: string, origin: 'storage' | 'mongo' = 'storage'): ArtifactVariant<string> {
  return { ref: name, markdown, origin, name }
}

describe('countPageMarkers', () => {
  it('zaehlt Bild-Refs und Seiten-Textmarker', () => {
    expect(countPageMarkers('# page_020.jpeg\nSeite: 20')).toBe(2)
    expect(countPageMarkers(pages(20))).toBe(40) // 20x page_ + 20x Seite
    expect(countPageMarkers('kein Marker hier')).toBe(0)
    expect(countPageMarkers('')).toBe(0)
  })
})

describe('selectBestArtifactVariant', () => {
  it('waehlt die vollstaendige Variante, NICHT die suffixlose Einzelseite (Ökoniomie-Regression)', () => {
    const stale = variant('_Ökoniomie_en_Innen.md', '# page_020.jpeg\nSeite: 20\nDonation Information')
    const full = variant('_Ökoniomie_en_Innen.en.md', pages(20, 'voller Text'))
    const mongo = variant('mongo', '# page_020.jpeg\nSeite: 20\nDonation Information', 'mongo')

    const res = selectBestArtifactVariant([stale, full, mongo], '_Ökoniomie_en_Innen.md')

    expect(res.best?.name).toBe('_Ökoniomie_en_Innen.en.md')
    expect(res.conflict).toBe(false)
    // Beide einseitigen (Storage-stale + Mongo) sind strikt unterlegen -> loeschbar.
    expect(res.deletable.map((v) => v.ref).sort()).toEqual(['_Ökoniomie_en_Innen.md', 'mongo'])
  })

  it('bei gleicher Seitenzahl gewinnt die laengere Variante', () => {
    const short = variant('a.md', pages(5))
    const long = variant('b.md', pages(5, 'deutlich mehr Inhalt '.repeat(20)))
    const res = selectBestArtifactVariant([short, long])
    expect(res.best?.ref).toBe('b.md')
    expect(res.deletable.map((v) => v.ref)).toEqual(['a.md'])
  })

  it('bevorzugt bei identischem Inhalt den kanonischen Namen und loescht das Duplikat', () => {
    const content = pages(20)
    const suffixed = variant('doc.en.md', content)
    const canonical = variant('doc.md', content)
    const res = selectBestArtifactVariant([suffixed, canonical], 'doc.md')
    expect(res.best?.name).toBe('doc.md')
    expect(res.conflict).toBe(false)
    expect(res.deletable.map((v) => v.ref)).toEqual(['doc.en.md'])
  })

  it('meldet Konflikt bei zwei gleich-vollstaendigen, aber UNTERSCHIEDLICHEN Varianten', () => {
    const a = variant('a.md', pages(10) + '\nVariante A')
    const b = variant('b.md', pages(10) + '\nVariante B') // gleiche Score, anderer Inhalt
    const res = selectBestArtifactVariant([a, b])
    expect(res.conflict).toBe(true)
    // best ist auch bei Konflikt deterministisch gefuellt (lexikographisch kleinster Name) –
    // Lese-Pfade brauchen ein Ergebnis; geloescht wird aber nichts.
    expect(res.best?.ref).toBe('a.md')
    expect(res.deletable).toEqual([])
  })

  it('Konflikt: kanonischer Name gewinnt fuer best, trotzdem nichts loeschbar', () => {
    const canonical = variant('doc.md', pages(10) + '\nVariante A')
    const other = variant('doc.en.md', pages(10) + '\nVariante B')
    const res = selectBestArtifactVariant([other, canonical], 'doc.md')
    expect(res.conflict).toBe(true)
    expect(res.best?.name).toBe('doc.md')
    expect(res.deletable).toEqual([])
  })

  it('einzelne Variante: ist Gewinner, nichts loeschbar', () => {
    const only = variant('only.md', pages(3))
    const res = selectBestArtifactVariant([only], 'only.md')
    expect(res.best?.ref).toBe('only.md')
    expect(res.deletable).toEqual([])
  })

  it('leere Varianten werden ignoriert und sind gegenueber vollem Gewinner loeschbar', () => {
    const empty = variant('empty.md', '   \n  ')
    const full = variant('full.md', pages(4))
    const res = selectBestArtifactVariant([empty, full])
    expect(res.best?.ref).toBe('full.md')
    expect(res.deletable.map((v) => v.ref)).toEqual(['empty.md'])
  })

  it('nur leere/keine Varianten: kein Gewinner, kein Konflikt, nichts loeschbar', () => {
    expect(selectBestArtifactVariant([])).toEqual({ best: null, conflict: false, deletable: [] })
    const res = selectBestArtifactVariant([variant('e.md', ''), variant('f.md', '  ')])
    expect(res.best).toBeNull()
    expect(res.conflict).toBe(false)
    expect(res.deletable).toEqual([])
  })
})
