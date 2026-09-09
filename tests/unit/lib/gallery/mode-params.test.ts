/**
 * Das Adress-Vokabular der Galerie-Ansichten, festgehalten (Welle M4f).
 *
 * Die Regeln lagen vorher in `use-gallery-mode.ts`, verwoben mit
 * `next/navigation`, und waren nur im Browser pruefbar. Jetzt sind sie reine
 * Funktionen — und diese Tabelle ist ihr Vertrag. Wer eine Zeile aendert,
 * aendert das Verhalten der Voll-App (Garantie G4) und muss das begruenden.
 */

import { describe, it, expect } from 'vitest'
import { nextParamsForMode, readGalleryMode, type GalleryMode } from '@/lib/gallery/mode-params'

const p = (s: string) => new URLSearchParams(s)

describe('readGalleryMode', () => {
  it.each<[string, GalleryMode, GalleryMode]>([
    ['', 'gallery', 'gallery'],
    ['', 'site', 'site'],
    ['view=site', 'gallery', 'site'],
    ['view=gallery', 'site', 'gallery'],
    ['mode=story', 'gallery', 'story'],
    ['mode=story', 'site', 'story'],
    // `view` schlaegt `mode`: beide gesetzt, die Ansicht gewinnt.
    ['view=gallery&mode=story', 'site', 'gallery'],
    // Unbekannte Werte fallen auf den Default — nicht auf eine Ansicht.
    ['view=table', 'site', 'site'],
  ])('"%s" mit Default %s → %s', (search, defaultMode, erwartet) => {
    expect(readGalleryMode(p(search), defaultMode)).toBe(erwartet)
  })
})

describe('nextParamsForMode', () => {
  it.each<[string, GalleryMode, GalleryMode, string]>([
    // Ziel site: doc und mode weg; view nur, wenn site nicht Default ist
    ['doc=x&mode=story&sort=stars', 'site', 'gallery', 'sort=stars&view=site'],
    ['doc=x&mode=story&sort=stars', 'site', 'site', 'sort=stars'],
    // Ziel story: doc und view weg, mode=story — unabhaengig vom Default
    ['doc=x&view=site&sort=stars', 'story', 'gallery', 'sort=stars&mode=story'],
    ['doc=x&view=gallery', 'story', 'site', 'mode=story'],
    // Ziel gallery: mode weg, doc BLEIBT; view nur, wenn gallery nicht Default ist
    ['doc=x&mode=story&sort=stars', 'gallery', 'gallery', 'doc=x&sort=stars'],
    ['doc=x&mode=story', 'gallery', 'site', 'doc=x&view=gallery'],
    ['view=site', 'gallery', 'site', 'view=gallery'],
    ['', 'gallery', 'gallery', ''],
  ])('"%s" → %s (Default %s) ergibt "%s"', (search, ziel, defaultMode, erwartet) => {
    expect(nextParamsForMode(p(search), ziel, defaultMode).toString()).toBe(erwartet)
  })

  it('laesst die uebergebenen Parameter unangetastet', () => {
    const current = p('doc=x&mode=story')
    nextParamsForMode(current, 'site', 'gallery')
    expect(current.toString()).toBe('doc=x&mode=story')
  })
})
