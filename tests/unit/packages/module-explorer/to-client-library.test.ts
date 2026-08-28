/**
 * Unit-Tests: `toClientLibrary` aus `@ks/module-explorer/react` (Welle M4).
 *
 * Die Uebersetzung der oeffentlichen Explorer-Antwort in den Library-Steckbrief
 * der Schale. Reine Funktion, deshalb ohne Render pruefbar — das ist der Grund,
 * warum sie beim Umzug aus der Seite herausgeschnitten wurde.
 */
import { describe, it, expect } from 'vitest'
import { toClientLibrary } from '@ks/module-explorer/react'
import type { ExplorerLibraryPayload } from '@ks/module-explorer/react'

const payload: ExplorerLibraryPayload = {
  id: 'lib-1',
  label: 'Oldies for Future',
  slugName: 'oldies',
  description: 'Ein Archiv',
  icon: 'Globe',
  requiresAuth: false,
  siteEnabled: true,
  logoUrl: 'https://example.test/logo.png',
  gallery: { headline: 'Unsere Aktionen' },
}

describe('toClientLibrary', () => {
  it('uebernimmt Kennung, Name und die Website-Felder', () => {
    const lib = toClientLibrary(payload, 'public')

    expect(lib.id).toBe('lib-1')
    expect(lib.label).toBe('Oldies for Future')
    expect(lib.config?.publicPublishing?.slugName).toBe('oldies')
    expect(lib.config?.publicPublishing?.publicName).toBe('Oldies for Future')
    expect(lib.config?.publicPublishing?.logoUrl).toBe('https://example.test/logo.png')
    expect(lib.config?.publicPublishing?.gallery?.headline).toBe('Unsere Aktionen')
    expect(lib.config?.publicPublishing?.siteEnabled).toBe(true)
  })

  it('setzt isPublic im public-Kontext immer auf true', () => {
    // Der Server liefert das Feld dort gar nicht — wer die Library ueber die
    // oeffentliche Route bekommt, sieht per Definition eine oeffentliche.
    const lib = toClientLibrary({ ...payload, isPublic: undefined }, 'public')

    expect(lib.config?.publicPublishing?.isPublic).toBe(true)
  })

  it('uebernimmt im member-Kontext, was der Server meldet', () => {
    const veroeffentlicht = toClientLibrary({ ...payload, isPublic: true }, 'member')
    const entwurf = toClientLibrary({ ...payload, isPublic: false }, 'member')

    expect(veroeffentlicht.config?.publicPublishing?.isPublic).toBe(true)
    // Owner sieht seine noch nicht veroeffentlichte Library — nicht als public ausgeben.
    expect(entwurf.config?.publicPublishing?.isPublic).toBe(false)
  })

  it('ersetzt eine fehlende Beschreibung durch den leeren String', () => {
    const lib = toClientLibrary({ ...payload, description: undefined }, 'public')

    expect(lib.config?.publicPublishing?.description).toBe('')
  })

  it('reicht die Chat-Konfiguration unveraendert durch', () => {
    const chat = { placeholder: 'Frag mich', maxChars: 500 }
    const lib = toClientLibrary({ ...payload, chat }, 'public')

    expect(lib.config?.chat).toEqual(chat)
  })
})
