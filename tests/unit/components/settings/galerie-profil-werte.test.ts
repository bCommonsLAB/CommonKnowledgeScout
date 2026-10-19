/** G3: Formular-Helfer fuer Galerie-Profil und Start-Ansicht aus der Config. */
import { describe, it, expect, vi } from 'vitest'
import { standardProfilAus, startAnsichtAus } from '@/components/settings/chat/galerie-profil-werte'

describe('standardProfilAus / startAnsichtAus', () => {
  it('fehlend oder leer = Vorgabe, gueltig = Wert', () => {
    expect(standardProfilAus(undefined)).toBe('experte')
    expect(standardProfilAus('')).toBe('experte')
    expect(standardProfilAus('gefuehrt')).toBe('gefuehrt')
    expect(startAnsichtAus(null)).toBe('alle')
    expect(startAnsichtAus('fokus')).toBe('fokus')
  })

  it('unbekannt wird gemeldet und durch die Vorgabe ersetzt', () => {
    const fehler = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(standardProfilAus('buerger')).toBe('experte')
    expect(startAnsichtAus(7)).toBe('alle')
    expect(fehler).toHaveBeenCalledTimes(2)
    expect(String(fehler.mock.calls[0][0])).toMatch(/standardProfil="buerger"/)
    fehler.mockRestore()
  })
})
