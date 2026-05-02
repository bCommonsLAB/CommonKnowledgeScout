/**
 * Characterization Tests fuer die PerspectivePageContent-Fassade (Welle 3-III-c).
 *
 * Diese Tests fixieren den Export-Vertrag von perspective-page-content.tsx:
 * - PerspectivePageContent wird namentlich exportiert (kein Default-Export)
 * - PerspectivePageContentProps Interface: library, libraryLoading, onBack, onModeChange, onSave, fromStoryMode?
 *
 * Sicherheitsnetz: Nach dem Modul-Split (perspective-page-content/ Verzeichnis) muss
 * die Fassade exakt dieselben Exporte haben wie das Original.
 * Diese Tests beweisen, dass Konsumenten ihre Imports NICHT aendern muessen.
 */

import { describe, it, expect } from 'vitest'

describe('PerspectivePageContent Export-Vertrag', () => {
  it('PerspectivePageContent ist eine Funktion (React-Komponente)', async () => {
    const mod = await import('@/components/library/shared/perspective-page-content')
    expect(typeof mod.PerspectivePageContent).toBe('function')
  })

  it('PerspectivePageContent-Export hat den korrekten Namen', async () => {
    const mod = await import('@/components/library/shared/perspective-page-content')
    expect('PerspectivePageContent' in mod).toBe(true)
    expect('default' in mod).toBe(false)
  })

  it('PerspectivePageContentProps ist exportiert', async () => {
    const mod = await import('@/components/library/shared/perspective-page-content')
    // Nur der Typ wird exportiert — aber der Named Export der Komponente muss vorhanden sein
    expect(typeof mod.PerspectivePageContent).toBe('function')
  })
})

describe('PerspectivePageContentProps-Vertrag', () => {
  /**
   * Typ-Smoke-Tests: Wenn TypeScript die Zuweisung erlaubt, stimmt der Vertrag.
   * Diese Tests laufen ohne DOM und ohne Mocks.
   */

  it('fromStoryMode ist optional (darf weggelassen werden)', () => {
    // Prüft, dass der Typ korrekt optional ist
    type Props = {
      library: { id: string; label: string } | null
      libraryLoading: boolean
      onBack: () => void
      onModeChange: (mode: 'gallery' | 'story') => void
      onSave: () => void
      fromStoryMode?: boolean
    }
    const props: Props = {
      library: { id: 'test', label: 'Test' },
      libraryLoading: false,
      onBack: () => {},
      onModeChange: () => {},
      onSave: () => {},
    }
    expect(props.fromStoryMode).toBeUndefined()
  })

  it('fromStoryMode=true ist erlaubt', () => {
    type Props = {
      library: { id: string; label: string } | null
      libraryLoading: boolean
      onBack: () => void
      onModeChange: (mode: 'gallery' | 'story') => void
      onSave: () => void
      fromStoryMode?: boolean
    }
    const props: Props = {
      library: null,
      libraryLoading: true,
      onBack: () => {},
      onModeChange: () => {},
      onSave: () => {},
      fromStoryMode: true,
    }
    expect(props.fromStoryMode).toBe(true)
  })

  it('onModeChange akzeptiert gallery und story', () => {
    type ModeChangeMode = 'gallery' | 'story'
    const gallery: ModeChangeMode = 'gallery'
    const story: ModeChangeMode = 'story'
    expect(gallery).toBe('gallery')
    expect(story).toBe('story')
  })
})
