// @vitest-environment jsdom

/**
 * `useAnsichtErklaerung` (D10b): beim ersten Besuch offen, Einklappen merkt
 * sich der Browser je Ansicht, Aufklappen loescht die Marke.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { ANSICHT_ERKLAERUNG_KEY_PREFIX, useAnsichtErklaerung } from '../../../../packages/ui/src/use-ansicht-erklaerung'

afterEach(() => localStorage.clear())

describe('useAnsichtErklaerung', () => {
  it('offen beim ersten Besuch; toggle merkt zu und wieder auf', () => {
    const { result } = renderHook(() => useAnsichtErklaerung('story'))
    expect(result.current.offen).toBe(true)

    act(() => result.current.toggle())
    expect(result.current.offen).toBe(false)
    expect(localStorage.getItem(ANSICHT_ERKLAERUNG_KEY_PREFIX + 'story')).toBe('true')

    act(() => result.current.toggle())
    expect(result.current.offen).toBe(true)
    expect(localStorage.getItem(ANSICHT_ERKLAERUNG_KEY_PREFIX + 'story')).toBeNull()
  })

  it('je Ansicht getrennt gemerkt', () => {
    localStorage.setItem(ANSICHT_ERKLAERUNG_KEY_PREFIX + 'galerie', 'true')
    const galerie = renderHook(() => useAnsichtErklaerung('galerie'))
    const story = renderHook(() => useAnsichtErklaerung('story'))
    expect(galerie.result.current.offen).toBe(false)
    expect(story.result.current.offen).toBe(true)
  })
})
