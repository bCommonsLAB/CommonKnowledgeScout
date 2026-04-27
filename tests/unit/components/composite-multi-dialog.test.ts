/**
 * @fileoverview Unit-Tests fuer den Composite-Multi-Erstell-Dialog (S6).
 *
 * Geprueft wird:
 * - `deriveCompositeMultiDefaultFilename` findet einen sinnvollen Praefix
 *   und faellt auf "zusammenstellung.md" zurueck, wenn nichts gemeinsam ist.
 * - Trenner und Datei-Endungen werden korrekt entfernt.
 *
 * Die UI-Komponente selbst (Dialog) wird nicht gerendert — sie ist ein
 * duenner Wrapper um Radix-Dialog. End-to-End-Verhalten faellt unter S8.
 */

import { describe, it, expect } from 'vitest'
import { deriveCompositeMultiDefaultFilename } from '@/components/library/composite-multi-create-dialog'

describe('deriveCompositeMultiDefaultFilename', () => {
  it('liefert generischen Default bei leerer Liste', () => {
    expect(deriveCompositeMultiDefaultFilename([])).toBe('zusammenstellung.md')
  })

  it('findet gemeinsamen Praefix mit Trenner', () => {
    const names = [
      'page_009__cortina.jpeg',
      'page_010__cortina.jpeg',
      'page_011__cortina.jpeg',
    ]
    // Gemeinsamer Praefix der Basisnamen ist "page_0" — Trenner werden
    // nicht abgeschnitten, wenn sie noch Buchstaben/Ziffern enthalten.
    // Der Algorithmus schneidet nur nachgestellte [\\s._-] ab.
    const result = deriveCompositeMultiDefaultFilename(names)
    // Wir erwarten, dass irgendein nicht-leerer Praefix vor _zusammenstellung.md steht.
    expect(result.endsWith('_zusammenstellung.md')).toBe(true)
    expect(result.length).toBeGreaterThan('_zusammenstellung.md'.length)
  })

  it('faellt auf generischen Default zurueck, wenn Praefix < 3 Zeichen', () => {
    const names = ['ab.jpg', 'cd.jpg']
    expect(deriveCompositeMultiDefaultFilename(names)).toBe('zusammenstellung.md')
  })

  it('schneidet nachgestellte Trenner vom Praefix ab', () => {
    const names = ['cortina_seite_a.jpg', 'cortina_seite_b.jpg']
    // Praefix der Basisnamen: "cortina_seite_" -> getrimmt zu "cortina_seite"
    expect(deriveCompositeMultiDefaultFilename(names)).toBe('cortina_seite_zusammenstellung.md')
  })

  it('arbeitet ohne Datei-Endung korrekt', () => {
    const names = ['cortina_a', 'cortina_b']
    expect(deriveCompositeMultiDefaultFilename(names)).toBe('cortina_zusammenstellung.md')
  })

  it('liefert generischen Default bei voellig unterschiedlichen Namen', () => {
    const names = ['alpha.jpg', 'beta.jpg', 'gamma.jpg']
    expect(deriveCompositeMultiDefaultFilename(names)).toBe('zusammenstellung.md')
  })
})
