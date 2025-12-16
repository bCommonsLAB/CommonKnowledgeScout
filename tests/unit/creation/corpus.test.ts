/**
 * @fileoverview Unit-Tests für Korpus-Builder (Multi-Source Wizard)
 */

import { describe, it, expect } from 'vitest'
import { buildCorpusText, buildSourceSummary, isCorpusTooLarge, truncateCorpus, type WizardSource } from '@/lib/creation/corpus'

describe('buildCorpusText', () => {
  it('sollte leeren String zurückgeben, wenn keine Quellen vorhanden sind', () => {
    expect(buildCorpusText([])).toBe('')
  })

  it('sollte Text-Quelle korrekt formatieren', () => {
    const sources: WizardSource[] = [
      {
        id: 'text-1',
        kind: 'text',
        text: 'Das ist ein Test-Text.',
        createdAt: new Date('2025-12-13T10:00:00Z'),
      },
    ]
    
    const result = buildCorpusText(sources)
    expect(result).toContain('[Quelle: Text |')
    expect(result).toContain('Das ist ein Test-Text.')
  })

  it('sollte URL-Quelle mit rawWebsiteText formatieren', () => {
    const sources: WizardSource[] = [
      {
        id: 'url-1',
        kind: 'url',
        url: 'https://example.com',
        rawWebsiteText: 'Roher Webseiten-Text für LLM',
        summary: 'Summary für UI',
        createdAt: new Date('2025-12-13T10:00:00Z'),
      },
    ]
    
    const result = buildCorpusText(sources)
    expect(result).toContain('[Quelle: Webseite | https://example.com]')
    expect(result).toContain('Roher Webseiten-Text für LLM')
    expect(result).not.toContain('Summary für UI') // Summary sollte NICHT im Korpus sein
  })

  it('sollte Datei-Quelle mit extractedText formatieren', () => {
    const sources: WizardSource[] = [
      {
        id: 'file-1',
        kind: 'file',
        fileName: 'test.pdf',
        extractedText: 'Extrahierter Text aus PDF',
        summary: 'Summary für UI',
        createdAt: new Date('2025-12-13T10:00:00Z'),
      },
    ]
    
    const result = buildCorpusText(sources)
    expect(result).toContain('[Quelle: Datei | test.pdf]')
    expect(result).toContain('Extrahierter Text aus PDF')
    expect(result).not.toContain('Summary für UI') // Summary sollte NICHT im Korpus sein
  })

  it('sollte mehrere Quellen chronologisch sortieren', () => {
    const sources: WizardSource[] = [
      {
        id: 'text-2',
        kind: 'text',
        text: 'Zweiter Text',
        createdAt: new Date('2025-12-13T11:00:00Z'),
      },
      {
        id: 'text-1',
        kind: 'text',
        text: 'Erster Text',
        createdAt: new Date('2025-12-13T10:00:00Z'),
      },
    ]
    
    const result = buildCorpusText(sources)
    const firstIndex = result.indexOf('Erster Text')
    const secondIndex = result.indexOf('Zweiter Text')
    
    expect(firstIndex).toBeLessThan(secondIndex)
  })

  it('sollte Quellen mit Trennern kombinieren', () => {
    const sources: WizardSource[] = [
      {
        id: 'text-1',
        kind: 'text',
        text: 'Text 1',
        createdAt: new Date('2025-12-13T10:00:00Z'),
      },
      {
        id: 'text-2',
        kind: 'text',
        text: 'Text 2',
        createdAt: new Date('2025-12-13T11:00:00Z'),
      },
    ]
    
    const result = buildCorpusText(sources)
    const blocks = result.split('\n\n')
    expect(blocks.length).toBeGreaterThan(1)
  })

  it('sollte Fallback auf Summary verwenden, wenn rawWebsiteText fehlt', () => {
    const sources: WizardSource[] = [
      {
        id: 'url-1',
        kind: 'url',
        url: 'https://example.com',
        summary: 'Fallback Summary',
        createdAt: new Date('2025-12-13T10:00:00Z'),
      },
    ]
    
    const result = buildCorpusText(sources)
    expect(result).toContain('Fallback Summary')
  })
})

describe('buildSourceSummary', () => {
  it('sollte Text-Auszug für Text-Quelle zurückgeben', () => {
    const source: WizardSource = {
      id: 'text-1',
      kind: 'text',
      text: 'Das ist ein sehr langer Text, der mehr als 200 Zeichen hat. '.repeat(10),
      createdAt: new Date(),
    }
    
    const summary = buildSourceSummary(source)
    expect(summary.length).toBeLessThanOrEqual(203) // 200 + "..."
    expect(summary).toContain('...')
  })

  it('sollte Summary für URL-Quelle zurückgeben', () => {
    const source: WizardSource = {
      id: 'url-1',
      kind: 'url',
      url: 'https://example.com',
      summary: 'Key: Value\nAnother: Data',
      createdAt: new Date(),
    }
    
    const summary = buildSourceSummary(source)
    expect(summary).toBe('Key: Value\nAnother: Data')
  })

  it('sollte URL als Fallback zurückgeben, wenn keine Summary vorhanden', () => {
    const source: WizardSource = {
      id: 'url-1',
      kind: 'url',
      url: 'https://example.com',
      createdAt: new Date(),
    }
    
    const summary = buildSourceSummary(source)
    expect(summary).toBe('https://example.com')
  })
})

describe('isCorpusTooLarge', () => {
  it('sollte false zurückgeben für kleinen Text', () => {
    expect(isCorpusTooLarge('Kleiner Text')).toBe(false)
  })

  it('sollte true zurückgeben für sehr großen Text', () => {
    const largeText = 'x'.repeat(500001)
    expect(isCorpusTooLarge(largeText)).toBe(true)
  })

  it('sollte custom maxChars respektieren', () => {
    const text = 'x'.repeat(1001)
    expect(isCorpusTooLarge(text, 1000)).toBe(true)
    expect(isCorpusTooLarge(text, 2000)).toBe(false)
  })
})

describe('truncateCorpus', () => {
  it('sollte Text unverändert zurückgeben, wenn er klein genug ist', () => {
    const text = 'Kleiner Text'
    expect(truncateCorpus(text)).toBe(text)
  })

  it('sollte Text kürzen und Warnung hinzufügen', () => {
    const largeText = 'x'.repeat(500001)
    const result = truncateCorpus(largeText)
    
    expect(result.length).toBeLessThanOrEqual(500000 + 100) // + Warnung
    expect(result).toContain('WARNUNG')
  })

  it('sollte custom maxChars respektieren', () => {
    const text = 'x'.repeat(1001)
    const result = truncateCorpus(text, 1000)
    
    expect(result.length).toBeLessThanOrEqual(1100) // 1000 + Warnung
    expect(result).toContain('WARNUNG')
  })
})





