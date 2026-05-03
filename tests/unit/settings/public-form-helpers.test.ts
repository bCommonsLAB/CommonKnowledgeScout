/**
 * Char-Tests für public-form.tsx Hilfsfunktionen.
 *
 * Getestete Logik:
 * - Slug-Validierung (Format-Check vor API-Aufruf)
 * - publicLink-Berechnung aus slugName
 *
 * Diese Tests verifizieren das Verhalten, das im Modul-Split
 * (Welle 3-IV-b) in slug-section.tsx + use-public-form.ts landen wird.
 */

import { describe, it, expect } from 'vitest'

// Slug-Validierungslogik — direkt aus public-form.tsx extrahiert (Zeile ~164)
function isValidSlugFormat(slug: string): boolean {
  return /^[a-z0-9-]+$/.test(slug)
}

// publicLink-Berechnung aus public-form.tsx (Zeile ~192)
function computePublicLink(slugName: string, origin: string): string {
  const path = slugName ? `/explore/${slugName}` : ""
  return origin ? `${origin}${path}` : path
}

describe('public-form: Slug-Validierung', () => {
  it('akzeptiert gültigen Slug mit Kleinbuchstaben', () => {
    expect(isValidSlugFormat('meine-bibliothek')).toBe(true)
  })

  it('akzeptiert Slug mit Zahlen', () => {
    expect(isValidSlugFormat('bibliothek-2024')).toBe(true)
  })

  it('akzeptiert Slug mit Bindestrichen', () => {
    expect(isValidSlugFormat('a-b-c')).toBe(true)
  })

  it('lehnt Großbuchstaben ab', () => {
    expect(isValidSlugFormat('MeineBibliothek')).toBe(false)
  })

  it('lehnt Leerzeichen ab', () => {
    expect(isValidSlugFormat('meine bibliothek')).toBe(false)
  })

  it('lehnt Sonderzeichen ab', () => {
    expect(isValidSlugFormat('bibliothek!')).toBe(false)
  })

  it('lehnt Unterstriche ab', () => {
    expect(isValidSlugFormat('meine_bibliothek')).toBe(false)
  })

  it('akzeptiert einzelne Zahl', () => {
    expect(isValidSlugFormat('1')).toBe(true)
  })
})

describe('public-form: publicLink-Berechnung', () => {
  it('berechnet Link mit Origin und Slug', () => {
    const result = computePublicLink('meine-bib', 'https://example.com')
    expect(result).toBe('https://example.com/explore/meine-bib')
  })

  it('gibt nur Pfad zurück wenn kein Origin', () => {
    const result = computePublicLink('meine-bib', '')
    expect(result).toBe('/explore/meine-bib')
  })

  it('gibt nur Origin zurück bei leerem Slug (kein /explore/-Pfad)', () => {
    // Originale Logik: path="" → gibt origin zurück (kein Pfad-Suffix)
    const result = computePublicLink('', 'https://example.com')
    expect(result).toBe('https://example.com')
  })

  it('gibt leeren String zurück bei leerem Slug und keinem Origin', () => {
    const result = computePublicLink('', '')
    expect(result).toBe('')
  })
})
