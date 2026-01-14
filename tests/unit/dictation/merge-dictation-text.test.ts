import { describe, it, expect } from 'vitest'
import { mergeDictationText } from '@/components/shared/use-dictation-transcription'

describe('mergeDictationText', () => {
  it('sollte neuen Text an bestehenden anhängen (mit Leerzeile)', () => {
    const existing = 'Erster Text'
    const newText = 'Zweiter Text'
    const result = mergeDictationText(existing, newText)
    expect(result).toBe('Erster Text\n\nZweiter Text')
  })

  it('sollte neuen Text zurückgeben, wenn existing leer ist', () => {
    const existing = ''
    const newText = 'Neuer Text'
    const result = mergeDictationText(existing, newText)
    expect(result).toBe('Neuer Text')
  })

  it('sollte existing zurückgeben, wenn newText leer ist', () => {
    const existing = 'Bestehender Text'
    const newText = ''
    const result = mergeDictationText(existing, newText)
    expect(result).toBe('Bestehender Text')
  })

  it('sollte Whitespace trimmen', () => {
    const existing = '  Text mit Leerzeichen  '
    const newText = '  Neuer Text  '
    const result = mergeDictationText(existing, newText)
    expect(result).toBe('Text mit Leerzeichen\n\nNeuer Text')
  })

  it('sollte beide leer sein, wenn beide leer sind', () => {
    const existing = ''
    const newText = ''
    const result = mergeDictationText(existing, newText)
    expect(result).toBe('')
  })

  it('sollte mehrere Absätze korrekt zusammenfügen', () => {
    const existing = 'Erster Absatz\n\nZweiter Absatz'
    const newText = 'Dritter Absatz'
    const result = mergeDictationText(existing, newText)
    expect(result).toBe('Erster Absatz\n\nZweiter Absatz\n\nDritter Absatz')
  })

  it('sollte mit null/undefined umgehen', () => {
    expect(mergeDictationText(null as unknown as string, 'Text')).toBe('Text')
    expect(mergeDictationText('Text', null as unknown as string)).toBe('Text')
    expect(mergeDictationText(null as unknown as string, null as unknown as string)).toBe('')
  })
})
