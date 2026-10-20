/**
 * B4 — Validierung und Merge der Veroeffentlichungs-Einstellungen:
 * eine Quelle fuer Formular-Route und Bruecke.
 */
import { describe, it, expect } from 'vitest'
import {
  geaenderteFelder, mergeGalleryTexte, mergePublicPublishing, mergeStoryTexte, validierePublicPublishing,
} from '@/lib/services/public-publishing-validation'

const ALT = {
  slugName: 'klima', publicName: 'Klima', description: 'Eine lange Beschreibung.', isPublic: true,
  showOnHomepage: true, requiresAuth: false, apiKey: 'geheim', logoUrl: 'https://blob/logo.png',
  gallery: { headline: 'H', subtitle: 'S' }, story: { headline: 'Story', topicsTitle: 'Themen' }, siteEnabled: false,
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

  it('ohne Vorzustand: Label als oeffentlicher Name, Homepage true, nicht oeffentlich, Sterne-Zahl privat', () => {
    const neu = mergePublicPublishing(undefined, {}, 'Meine Library')
    expect(neu).toMatchObject({ publicName: 'Meine Library', isPublic: false, showOnHomepage: true, requiresAuth: false, siteEnabled: false })
    expect(neu.starCountsPublic).toBeUndefined()
  })

  it('starCountsPublic (ADR 0012): undefined laesst stehen, true/false setzt, geaendert nennt das Feld', () => {
    expect(mergePublicPublishing({ ...ALT, starCountsPublic: true }, {}, 'L').starCountsPublic).toBe(true)
    const an = mergePublicPublishing(ALT, { starCountsPublic: true }, 'L')
    expect(an.starCountsPublic).toBe(true)
    expect(geaenderteFelder(ALT, an)).toEqual(['starCountsPublic'])
    const aus = mergePublicPublishing({ ...ALT, starCountsPublic: true }, { starCountsPublic: false }, 'L')
    expect(aus.starCountsPublic).toBe(false)
  })

  it('Galerie-Texte werden feldweise gemergt', () => {
    expect(mergeGalleryTexte({ headline: 'H', subtitle: 'S' }, { subtitle: 'Neu' })).toEqual({ headline: 'H', subtitle: 'Neu' })
    expect(mergeGalleryTexte(undefined, undefined)).toBeUndefined()
    expect(mergeGalleryTexte({ headline: 'H' }, { headline: '' })).toEqual({ headline: '' })
  })
})

describe('Story-Texte (Befund 16.10.)', () => {
  it('werden feldweise gemergt wie die Galerie-Texte; leerer String bleibt (= Standardtext)', () => {
    expect(mergeStoryTexte({ headline: 'H', intro: 'I' }, { intro: 'Neu', topicsIntro: 'T' })).toEqual({ headline: 'H', intro: 'Neu', topicsIntro: 'T' })
    expect(mergeStoryTexte({ headline: 'H' }, undefined)).toEqual({ headline: 'H' })
    expect(mergeStoryTexte(undefined, undefined)).toBeUndefined()
    expect(mergeStoryTexte({ headline: 'H' }, { headline: '' })).toEqual({ headline: '' })
  })

  it('mergePublicPublishing setzt nur genannte Story-Felder und meldet story als geaendert', () => {
    expect(mergePublicPublishing(ALT, {}, 'L').story).toEqual({ headline: 'Story', topicsTitle: 'Themen' })
    const neu = mergePublicPublishing(ALT, { story: { topicsIntro: 'Worum es geht' } }, 'L')
    expect(neu.story).toEqual({ headline: 'Story', topicsTitle: 'Themen', topicsIntro: 'Worum es geht' })
    expect(neu.gallery).toEqual(ALT.gallery)
    expect(geaenderteFelder(ALT, neu)).toEqual(['story'])
  })

  it('Validierung weist unbekannte Felder und Nicht-Text-Werte in story und gallery ab', () => {
    expect(validierePublicPublishing({ story: { headline: 'H', intro: '' } })).toBeNull()
    expect(validierePublicPublishing({ story: { titel: 'H' } })).toMatch(/story: unbekanntes Feld "titel"/)
    expect(validierePublicPublishing({ story: { headline: 3 } })).toMatch(/story\.headline muss ein Text sein/)
    expect(validierePublicPublishing({ story: 'Text' })).toMatch(/story muss ein Objekt sein/)
    expect(validierePublicPublishing({ gallery: { intro: 'x' } })).toMatch(/gallery: unbekanntes Feld "intro"/)
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

describe('Mitreden-Band (G5)', () => {
  it('merge feldweise; leerer String bleibt; geaendert nennt mitreden', () => {
    const neu = mergePublicPublishing(ALT, { mitreden: { headline: 'Wer kommentiert, ist Expertin', href: '/explore/klima?site=mitreden' } }, 'L')
    expect(neu.mitreden).toEqual({ headline: 'Wer kommentiert, ist Expertin', href: '/explore/klima?site=mitreden' })
    expect(geaenderteFelder(ALT, neu)).toEqual(['mitreden'])
    const geleert = mergePublicPublishing({ ...ALT, mitreden: neu.mitreden }, { mitreden: { href: '' } }, 'L')
    expect(geleert.mitreden).toEqual({ headline: 'Wer kommentiert, ist Expertin', href: '' })
    expect(mergePublicPublishing(ALT, {}, 'L').mitreden).toBeUndefined()
  })

  it('Validierung: unbekannte Felder, Nicht-Text und ein Ziel ohne "/" oder "https://" werden abgewiesen', () => {
    expect(validierePublicPublishing({ mitreden: { knopf: 'x' } })).toMatch(/mitreden: unbekanntes Feld/)
    expect(validierePublicPublishing({ mitreden: { headline: 7 } })).toMatch(/mitreden.headline muss ein Text sein/)
    expect(validierePublicPublishing({ mitreden: { href: 'mitreden' } })).toMatch(/mitreden.href/)
    expect(validierePublicPublishing({ mitreden: { href: 'http://unsicher.example' } })).toMatch(/mitreden.href/)
    expect(validierePublicPublishing({ mitreden: { href: '/explore/klima?site=mitreden' } })).toBeNull()
    expect(validierePublicPublishing({ mitreden: { href: 'https://example.org/mitreden', text: '' } })).toBeNull()
  })
})
