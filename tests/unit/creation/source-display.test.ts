/**
 * Tests fuer die Quell-Anzeigenamen der Wizard-Summary.
 * Deckt alle gueltigen `kind`-Werte ab + den Wurf bei unbekanntem Typ
 * (no-silent-fallbacks).
 */

import { describe, it, expect } from 'vitest'
import { describeSourceName, describeSourceNames } from '@/lib/creation/source-display'
import type { WizardSource } from '@/lib/creation/corpus'

function src(over: Partial<WizardSource>): WizardSource {
  return { id: 's1', kind: 'file', createdAt: '2026-06-14T00:00:00.000Z', ...over }
}

describe('describeSourceName', () => {
  it('file: liefert den Dateinamen', () => {
    expect(describeSourceName(src({ kind: 'file', fileName: 'vortrag.pdf' }))).toBe('vortrag.pdf')
  })

  it('file ohne Name: Fallback-Label "Datei"', () => {
    expect(describeSourceName(src({ kind: 'file', fileName: '' }))).toBe('Datei')
  })

  it('url: liefert die URL', () => {
    expect(describeSourceName(src({ kind: 'url', url: 'https://example.com' }))).toBe('https://example.com')
  })

  it('text: festes Label "Texteingabe"', () => {
    expect(describeSourceName(src({ kind: 'text', text: 'Hallo' }))).toBe('Texteingabe')
  })

  it('unbekannter kind: wirft (kein stiller Fallback)', () => {
    expect(() => describeSourceName({ id: 'x', kind: 'audio' as unknown as 'file', createdAt: '' })).toThrow()
  })
})

describe('describeSourceNames', () => {
  it('leere/fehlende Eingabe -> leere Liste', () => {
    expect(describeSourceNames(undefined)).toEqual([])
    expect(describeSourceNames([])).toEqual([])
  })

  it('mehrere Quellen -> Liste der Anzeigenamen', () => {
    const names = describeSourceNames([
      src({ id: 'a', kind: 'file', fileName: 'a.pdf' }),
      src({ id: 'b', kind: 'url', url: 'https://b.de' }),
    ])
    expect(names).toEqual(['a.pdf', 'https://b.de'])
  })
})
