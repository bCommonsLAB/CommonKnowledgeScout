/**
 * Tests der X/Y-Compute-Entscheidung (U5, Entscheidung 2Y). Pinnt den Vertrag,
 * auf dem U5b/U5c aufsetzen: reiner Text/URL synchron off-target (`text-sync`),
 * Datei-Medien über die Inbox-Pipeline (`inbox-job`); unbekannter Quelltyp wirft
 * (no-silent-fallbacks).
 */

import { describe, expect, it } from 'vitest'
import { resolveComputeMode, type ComputeModeSource } from '@/lib/creation/compute-mode'

describe('resolveComputeMode', () => {
  it('reiner Text läuft synchron off-target (text-sync)', () => {
    expect(resolveComputeMode({ kind: 'text' })).toBe('text-sync')
  })

  it('URL läuft synchron off-target (text-sync)', () => {
    expect(resolveComputeMode({ kind: 'url' })).toBe('text-sync')
  })

  it('Datei-Medien laufen über die Inbox-Pipeline (inbox-job)', () => {
    expect(resolveComputeMode({ kind: 'file' })).toBe('inbox-job')
  })

  it('wirft bei unbekanntem Quelltyp (kein stiller Fallback)', () => {
    const bogus = { kind: 'folder' } as unknown as ComputeModeSource
    expect(() => resolveComputeMode(bogus)).toThrow(/unbekannter Quelltyp/)
    expect(() => resolveComputeMode(bogus)).toThrow(/folder/)
  })

  it('Text/URL gehen NIE den Inbox-Job-Weg (Off-target-Synchron-Invariante)', () => {
    expect(resolveComputeMode({ kind: 'text' })).not.toBe('inbox-job')
    expect(resolveComputeMode({ kind: 'url' })).not.toBe('inbox-job')
  })
})
