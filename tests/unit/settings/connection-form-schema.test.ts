/**
 * Formular-Modell der Konto-Seite Speicher-Verbindungen: Pflichtfelder je Typ,
 * Geheimnis nur beim Anlegen Pflicht, Eingabe fuer die API ohne leere Geheimnisse.
 */
import { describe, it, expect } from 'vitest'
import { fehlendePflichtfelder, readConnectionForm, toConnectionInput } from '@/components/settings/account/storage-connections/connection-form-schema'

describe('connection-form-schema', () => {
  it('beim Anlegen fehlt das Geheimnis, beim Aendern nicht', () => {
    const werte = { ...readConnectionForm(null), label: 'X', webdavUrl: 'https://x', username: 'u' }
    expect(fehlendePflichtfelder(werte, true)).toEqual(['appPassword'])
    expect(fehlendePflichtfelder(werte, false)).toEqual([])
  })

  it('OneDrive-Pflichtfelder sind Tenant, Client und Secret', () => {
    const werte = { ...readConnectionForm(null), label: 'X', type: 'onedrive' as const }
    expect(fehlendePflichtfelder(werte, true)).toEqual(['tenantId', 'clientId', 'clientSecret'])
  })

  it('toConnectionInput schickt nur die Felder des Typs und laesst leere Geheimnisse weg', () => {
    const nc = toConnectionInput({ ...readConnectionForm(null), label: ' Verein ', webdavUrl: ' https://x ', username: 'u', appPassword: '' })
    expect(nc).toEqual({ label: 'Verein', type: 'nextcloud', nextcloud: { webdavUrl: 'https://x', username: 'u' } })
    const od = toConnectionInput({ ...readConnectionForm(null), label: 'F', type: 'onedrive', tenantId: 't', clientId: 'c', clientSecret: 's' })
    expect(od).toEqual({ label: 'F', type: 'onedrive', onedrive: { tenantId: 't', clientId: 'c', clientSecret: 's' } })
  })

  it('readConnectionForm uebernimmt Kennungen, nie Geheimnisse', () => {
    const werte = readConnectionForm({
      id: 'c1', label: 'Verein', type: 'nextcloud', lastTest: null, createdAt: 'T', updatedAt: 'T',
      nextcloud: { webdavUrl: 'https://x', username: 'u', appPasswordSet: true },
    })
    expect(werte.webdavUrl).toBe('https://x')
    expect(werte.appPassword).toBe('')
  })
})
