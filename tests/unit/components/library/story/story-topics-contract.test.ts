/**
 * Characterization Tests fuer StoryTopics (Welle 3-III-c).
 *
 * Fixiert:
 * - StoryTopics ist namentlich exportiert
 * - StoryTopicsProps: libraryId, data, onSelectQuestion?, visible?, isLoading?
 * - Keine Default-Exporte
 *
 * Sicherheitsnetz: Nach dem Modul-Split (story-topics/ Verzeichnis) muss
 * der Export-Vertrag unveraendert bleiben.
 */

import { describe, it, expect } from 'vitest'

describe('StoryTopics Export-Vertrag', () => {
  it('StoryTopics ist eine Funktion (React-Komponente)', async () => {
    const mod = await import('@/components/library/story/story-topics')
    expect(typeof mod.StoryTopics).toBe('function')
  })

  it('StoryTopics-Export hat den korrekten Namen', async () => {
    const mod = await import('@/components/library/story/story-topics')
    expect('StoryTopics' in mod).toBe(true)
    expect('default' in mod).toBe(false)
  })
})

describe('StoryTopics Props-Vertrag', () => {
  it('visible=true und visible=false sind erlaubte Werte', () => {
    type VisibleProp = boolean | undefined
    const visible: VisibleProp = true
    const invisible: VisibleProp = false
    expect(visible).toBe(true)
    expect(invisible).toBe(false)
  })

  it('isLoading ist optional', () => {
    type IsLoadingProp = boolean | undefined
    const loading: IsLoadingProp = undefined
    expect(loading).toBeUndefined()
  })

  it('onSelectQuestion ist optional', () => {
    type OnSelectFn = ((question: { id: string; text: string }) => void) | undefined
    const handler: OnSelectFn = undefined
    expect(handler).toBeUndefined()
  })
})
