import { describe, it, expect } from 'vitest'
import {
  getVerificationStatusDisplay,
  VERIFICATION_STATUS_DISPLAY,
} from '@/lib/library-verification/status-display'
import type { LibraryVerificationStatus } from '@/lib/library-verification/types'

describe('getVerificationStatusDisplay', () => {
  it('mappt jeden Status auf Label + Variante', () => {
    expect(getVerificationStatusDisplay('verified').label).toBe('Geprüft')
    expect(getVerificationStatusDisplay('needs-repair').variant).toBe('destructive')
    expect(getVerificationStatusDisplay('unchecked').variant).toBe('secondary')
  })

  it('liefert fuer jeden Status nicht-leeres Label + Beschreibung', () => {
    const statuses: LibraryVerificationStatus[] = ['verified', 'needs-repair', 'unchecked']
    for (const s of statuses) {
      const d = VERIFICATION_STATUS_DISPLAY[s]
      expect(d.label.length).toBeGreaterThan(0)
      expect(d.description.length).toBeGreaterThan(0)
    }
  })
})
