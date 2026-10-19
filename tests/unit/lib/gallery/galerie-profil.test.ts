/**
 * Plan galerie-buergeransicht, G1: Profil aus Adresse und Config, Adresse
 * nach dem Wechsel, Filteranzeige und Layout-Klassen je Profil.
 */
import { describe, it, expect, vi } from 'vitest'
import {
  filterAnzeigeFuer,
  layoutKlassen,
  profilAus,
  profilParams,
  startParamsFuer,
} from '@ks/module-explorer/gallery/lib/galerie-profil'

describe('startParamsFuer (G2: Vorgabe Im Fokus aus der Config)', () => {
  it('fokus ohne starred/sort in der Adresse setzt starred=1&sort=stars', () => {
    expect(startParamsFuer('fokus', new URLSearchParams('view=gallery'))?.toString()).toBe('view=gallery&starred=1&sort=stars')
    expect(startParamsFuer('fokus', null)?.toString()).toBe('starred=1&sort=stars')
  })
  it('laesst eine Adresse mit starred oder sort in Ruhe („Alle" bleibt eine echte Adresse)', () => {
    expect(startParamsFuer('fokus', new URLSearchParams('starred=1&sort=stars'))).toBeNull()
    expect(startParamsFuer('fokus', new URLSearchParams('sort=rating'))).toBeNull()
  })
  it('alle oder fehlend: nichts; unbekannt: gemeldet und nichts', () => {
    expect(startParamsFuer('alle', new URLSearchParams(''))).toBeNull()
    expect(startParamsFuer(undefined, new URLSearchParams(''))).toBeNull()
    const fehler = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(startParamsFuer('sterne', new URLSearchParams(''))).toBeNull()
    expect(String(fehler.mock.calls[0][0])).toMatch(/startAnsicht="sterne"/)
    fehler.mockRestore()
  })
})

describe('profilAus', () => {
  it('Adresse schlägt Config schlägt Vorgabe', () => {
    expect(profilAus('gefuehrt', 'experte')).toEqual({ profil: 'gefuehrt', quelle: 'adresse' })
    expect(profilAus(null, 'gefuehrt')).toEqual({ profil: 'gefuehrt', quelle: 'config' })
    expect(profilAus(null, undefined)).toEqual({ profil: 'experte', quelle: 'vorgabe' })
    expect(profilAus('', '')).toEqual({ profil: 'experte', quelle: 'vorgabe' })
  })

  it('unbekannte Werte werden gemeldet und übersprungen, kein stiller Fallback auf etwas anderes', () => {
    const fehler = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(profilAus('buerger', 'gefuehrt')).toEqual({ profil: 'gefuehrt', quelle: 'config' })
    expect(profilAus(null, 'simple')).toEqual({ profil: 'experte', quelle: 'vorgabe' })
    expect(fehler).toHaveBeenCalledTimes(2)
    expect(String(fehler.mock.calls[0][0])).toMatch(/ansicht="buerger"/)
    expect(String(fehler.mock.calls[1][0])).toMatch(/standardProfil="simple"/)
    fehler.mockRestore()
  })
})

describe('profilParams', () => {
  it('setzt ansicht und lässt andere Parameter stehen', () => {
    const next = profilParams(new URLSearchParams('view=gallery&starred=1'), 'gefuehrt')
    expect(next.get('ansicht')).toBe('gefuehrt')
    expect(next.get('starred')).toBe('1')
    expect(profilParams(null, 'experte').toString()).toBe('ansicht=experte')
  })
})

describe('filterAnzeigeFuer / layoutKlassen', () => {
  it('geführt: Lade auf jeder Breite; Experte: Spalte ab lg, Lade mobil', () => {
    expect(filterAnzeigeFuer('gefuehrt', false)).toBe('lade')
    expect(filterAnzeigeFuer('gefuehrt', true)).toBe('lade')
    expect(filterAnzeigeFuer('experte', false)).toBe('spalte')
    expect(filterAnzeigeFuer('experte', true)).toBe('lade')
  })

  it('Spalte = die bisherigen Breakpoint-Klassen (Expertenmodus unverändert)', () => {
    const k = layoutKlassen('spalte')
    expect(k.leiste).toBe('lg:hidden')
    expect(k.desktop).toContain('hidden lg:grid lg:grid-cols-[280px_minmax(0,1fr)]')
    expect(k.liste.startsWith('lg:hidden')).toBe(true)
  })

  it('Lade = Leiste sichtbar, Spalte weg, Liste volle Breite', () => {
    const k = layoutKlassen('lade')
    expect(k.leiste).toBe('')
    expect(k.desktop).toBe('hidden')
    expect(k.liste).not.toContain('lg:hidden')
  })
})
