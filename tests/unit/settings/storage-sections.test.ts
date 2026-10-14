/**
 * Char-Tests fuer die Storage-Settings-Komponenten (Archive · 1 Quelle).
 *
 * Seit Teil A des Plans speicher-verbindungen-und-library-anlage waehlt der
 * Wizard eine Speicher-Verbindung des Kontos statt Zugangsdaten einzugeben;
 * die NextcloudSection und der OAuth-Resume des Wizards sind entfallen.
 */

import { describe, it, expect } from 'vitest'

describe('Storage-Komponenten Export-Kontrakt', () => {
  it('StorageWizard ist als named export definiert', async () => {
    const mod = await import('@/components/settings/storage/storage-wizard')
    expect(typeof mod.StorageWizard).toBe('function')
    expect(mod.default).toBeUndefined()
  })

  it('ConnectionPicker ist als named export definiert und verweist auf die Konto-Seite', async () => {
    const mod = await import('@/components/settings/storage/connection-picker')
    expect(typeof mod.ConnectionPicker).toBe('function')
    expect(mod.STORAGE_CONNECTIONS_HREF).toBe('/settings/account/storage-connections')
    expect(mod.default).toBeUndefined()
  })

  it('Wizard-Schritte Verzeichnis und Test sind named exports', async () => {
    const mod = await import('@/components/settings/storage/storage-wizard-steps')
    expect(typeof mod.DirectoryStep).toBe('function')
    expect(typeof mod.TestStep).toBe('function')
  })
})
