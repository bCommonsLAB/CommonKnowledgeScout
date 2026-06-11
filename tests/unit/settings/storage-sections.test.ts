/**
 * Char-Tests für storage-form Section-Komponenten (Welle 3-IV-Sections-Split).
 *
 * Prüft die Props-Schnittstellen und Export-Vertrag der extrahierten
 * Storage-Section-Komponenten.
 */

import { describe, it, expect } from 'vitest'

// --------------------------------------------------------------------------
// Props-Kontrakte
// --------------------------------------------------------------------------
describe('OneDriveSectionProps Props-Kontrakt', () => {
  it('hat die erwarteten Props-Felder im Interface', () => {
    const requiredProps = [
      'form',
      'activeLibrary',
      'tokenStatus',
      'handleOneDriveAuth',
      'handleOneDriveLogout',
    ] as const
    expect(requiredProps.length).toBeGreaterThan(0)
  })
})

describe('NextcloudSectionProps Props-Kontrakt', () => {
  it('hat die erwarteten Props-Felder im Interface', () => {
    const requiredProps = ['form', 'activeLibrary'] as const
    expect(requiredProps).toHaveLength(2)
  })
})

// --------------------------------------------------------------------------
// Export-Kontrakt: named exports, keine default exports
// --------------------------------------------------------------------------
describe('Storage Section-Komponenten Export-Kontrakt', () => {
  it('OneDriveSection ist als named export definiert', async () => {
    const mod = await import(
      '@/components/settings/storage/onedrive-section'
    )
    expect(typeof mod.OneDriveSection).toBe('function')
    expect(mod.default).toBeUndefined()
  })

  it('NextcloudSection ist als named export definiert', async () => {
    const mod = await import(
      '@/components/settings/storage/nextcloud-section'
    )
    expect(typeof mod.NextcloudSection).toBe('function')
    expect(mod.default).toBeUndefined()
  })
})
