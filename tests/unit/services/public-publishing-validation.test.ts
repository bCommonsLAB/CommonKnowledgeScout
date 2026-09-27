/**
 * B4 — Validierung und Merge der Veroeffentlichungs-Einstellungen:
 * eine Quelle fuer Formular-Route und Bruecke.
 */
import { describe, it, expect } from 'vitest'
import {
  geaenderteFelder, mergeGalleryTexte, mergePublicPublishing, validierePublicPublishing,
} from '@/lib/services/public-publishing-validation'

const ALT = {
  slugName: 'klima', publicName: 'Klima', description: 'Eine lange Beschreibung.', isPublic: true,
  showOnHomepage: true, requiresAuth: false, apiKey: 'geheim', logoUrl: 'https://blob/logo.png',
  gallery: { headline: 'H', subtitle: 'S' }, siteEnabled: false,
}

describe('validierePublicPublishing', () => {
  it('oeffentlich: Slug, Name und Beschreibung sind Pflicht mit Mindestlaengen', () => {
    expect(validierePublicPublishing({ isPublic: true })).toMatch(/Slug-Name/)
    expect(validierePublicPublishing({ isPublic: true, slugName: 'Kli ma' })).toMatch(/Kleinbuchstaben/)
    expect(validierePublicPublishing({ isPublic: true, slugName: 'klima', publicName: 'K' })).toMatch(/Öffentlicher Name/)
    expect(validierePublicPublishing({ isPublic: true, slugName: 'klima', publicName: 'Klima', description: 'kurz' })).toMatch(/Beschreibung/)
    expect(validierePublicPublishing({ isPublic: true, slugName: 'klima', publicName: 'Klima', description: 'Eine lange Beschreibung.' })).toBeNull()
  })

  it('requiresAuth und showOnHomepage=false nur bei isPublic', () => {
    expect(validierePublicPublishing({ isPublic: false, requiresAuth: true })).toMatch(/requiresAuth/)
    expect(validierePublicPublishing({ isPublic: false, showOnHomepage: false })).toMatch(/Show-on-Homepage/)
    expect(validierePublicPublishing({ isPublic: false })).toBeNull()
  })
})

describe('mergePublicPublishing', () => {
  it('undefined laesst alles stehen, apiKey und story bleiben unangetastet', () => {
    const neu = mergePublicPublishing(ALT, {}, 'Label')
    expect(neu).toMatchObject({ slugName: 'klima', isPublic: true, apiKey: 'geheim', siteEnabled: false, logoUrl: 'https://blob/logo.png' })
    expect(geaenderteFelder(ALT, neu)).toEqual([])
  })

  it('setzt nur genannte Felder; leere URL loescht; icon none loescht', () => {
    const neu = mergePublicPublishing({ ...ALT, icon: 'leaf' }, { siteEnabled: true, logoUrl: '', icon: 'none' }, 'Label')
    expect(neu.siteEnabled).toBe(true)
    expect(neu.logoUrl).toBeUndefined()
    expect(neu.icon).toBeUndefined()
    expect(geaenderteFelder({ ...ALT, icon: 'leaf' }, neu).sort()).toEqual(['icon', 'logoUrl', 'siteEnabled'])
  })

  it('ohne Vorzustand: Label als oeffentlicher Name, Homepage true, nicht oeffentlich', () => {
    const neu = mergePublicPublishing(undefined, {}, 'Meine Library')
    expect(neu).toMatchObject({ publicName: 'Meine Library', isPublic: false, showOnHomepage: true, requiresAuth: false, siteEnabled: false })
  })

  it('Galerie-Texte werden feldweise gemergt', () => {
    expect(mergeGalleryTexte({ headline: 'H', subtitle: 'S' }, { subtitle: 'Neu' })).toEqual({ headline: 'H', subtitle: 'Neu' })
    expect(mergeGalleryTexte(undefined, undefined)).toBeUndefined()
    expect(mergeGalleryTexte({ headline: 'H' }, { headline: '' })).toEqual({ headline: '' })
  })
})

describe('siteTheme (Welle S2)', () => {
  it('validiert ein Profil mit denselben Regeln wie die Bruecke', () => {
    expect(validierePublicPublishing({ siteTheme: { accent: 'orange' } })).toMatch(/"accent" ist kein Hex-Farbwert/)
    expect(validierePublicPublishing({ siteTheme: { fontHeading: 'newsreader' } })).toBeNull()
    expect(validierePublicPublishing({ siteTheme: null })).toBeNull()
  })

  it('merge: undefined laesst stehen, null loescht, gueltig ersetzt normalisiert', () => {
    const mitProfil = { ...ALT, siteTheme: { accent: '#c85a32' } }
    expect(mergePublicPublishing(mitProfil, {}, 'L').siteTheme).toEqual({ accent: '#c85a32' })
    expect(mergePublicPublishing(mitProfil, { siteTheme: null }, 'L').siteTheme).toBeUndefined()
    const neu = mergePublicPublishing(mitProfil, { siteTheme: { fontHeading: 'newsreader', accent: '#C85A32' } }, 'L')
    expect(neu.siteTheme).toEqual({ fontHeading: 'newsreader', accent: '#c85a32' })
    expect(geaenderteFelder(mitProfil, neu)).toEqual(['siteTheme'])
    expect(() => mergePublicPublishing(mitProfil, { siteTheme: { accent: 'rot' } }, 'L')).toThrow(/Hex/)
  })
})
