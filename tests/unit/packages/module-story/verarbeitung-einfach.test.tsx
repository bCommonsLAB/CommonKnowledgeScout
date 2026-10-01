// @vitest-environment jsdom

/**
 * Verarbeitungsschritte in einfachen Worten (D2): Die technischen Schritte
 * des Chat-Streams werden zu Saetzen fuer Nicht-Fachleute — eine Zeile je
 * Phase, laufend oder fertig, Fehler sichtbar.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { ChatProcessingStep } from '@ks/contracts'
import { VerarbeitungEinfach, verarbeitungInWorten } from '@ks/module-story/react'

vi.mock('@ks/i18n/react', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'de' }),
}))

const t = (key: string, params?: Record<string, string | number>) =>
  params ? `${key}:${Object.values(params).join(',')}` : key

afterEach(cleanup)

describe('verarbeitungInWorten', () => {
  it('ohne Schritte keine Zeile', () => {
    expect(verarbeitungInWorten([], t)).toEqual([])
  })

  it('laufende Phasen als „laeuft", abgeschlossene als „fertig"', () => {
    const schritte: ChatProcessingStep[] = [
      { type: 'cache_check', parameters: {} },
      { type: 'cache_check_complete', found: false },
      { type: 'question_analysis_start', question: 'Wie heizen wir morgen?' },
      { type: 'question_analysis_result', recommendation: 'chunk', confidence: 'high' },
      { type: 'retriever_selected', retriever: 'chunk' },
      { type: 'retrieval_start', retriever: 'chunk' },
    ]
    expect(verarbeitungInWorten(schritte, t)).toEqual([
      { text: 'processing.plain.notFoundYet', zustand: 'fertig' },
      { text: 'processing.plain.readPassages', zustand: 'fertig' },
      { text: 'processing.plain.reading', zustand: 'laeuft' },
    ])
  })

  it('zaehlt Fundstellen und Dokumente in Worten, Einzahl gesondert', () => {
    expect(verarbeitungInWorten([{ type: 'retrieval_complete', sourcesCount: 7, uniqueFileIdsCount: 3, timingMs: 12 }], t)).toEqual([
      { text: 'processing.plain.passagesManyIn:7,processing.plain.documentsMany:3', zustand: 'fertig' },
    ])
    expect(verarbeitungInWorten([{ type: 'retrieval_complete', sourcesCount: 1, uniqueFileIdsCount: 1, timingMs: 12 }], t)).toEqual([
      { text: 'processing.plain.passagesOneIn:processing.plain.documentsOne', zustand: 'fertig' },
    ])
    expect(verarbeitungInWorten([{ type: 'retrieval_complete', sourcesCount: 2, timingMs: 12 }], t)).toEqual([
      { text: 'processing.plain.passagesMany:2', zustand: 'fertig' },
    ])
  })

  it('keine Technikbegriffe: Token, Modell und Millisekunden tauchen nicht auf', () => {
    const schritte: ChatProcessingStep[] = [
      { type: 'prompt_complete', promptLength: 20000, documentsUsed: 4, tokenCount: 5000 },
      { type: 'llm_start', model: 'gpt-x' },
      { type: 'llm_complete', timingMs: 1234, promptTokens: 5000, completionTokens: 300 },
      { type: 'parsing_response' },
    ]
    const texte = verarbeitungInWorten(schritte, t).map((z) => z.text)
    expect(texte).toEqual(['processing.plain.composedMany:4', 'processing.plain.written', 'processing.plain.finishing'])
    expect(texte.join(' ')).not.toMatch(/gpt-x|1234|5000/)
  })

  it('Fehler wird als eigene Zeile mit Meldung gezeigt', () => {
    expect(verarbeitungInWorten([{ type: 'error', error: 'Dienst nicht erreichbar' }], t)).toEqual([
      { text: 'processing.plain.failed:Dienst nicht erreichbar', zustand: 'fehler' },
    ])
  })
})

describe('VerarbeitungEinfach', () => {
  it('rendert die Zeilen als Liste', () => {
    render(<VerarbeitungEinfach schritte={[{ type: 'llm_start', model: 'x' }, { type: 'complete', answer: 'a', references: [], suggestedQuestions: [], queryId: 'q', chatId: 'c' }]} />)
    expect(screen.getByText('processing.plain.writing')).toBeTruthy()
    expect(screen.getByText('processing.plain.done')).toBeTruthy()
  })

  it('ohne Schritte nichts', () => {
    const { container } = render(<VerarbeitungEinfach schritte={[]} />)
    expect(container.innerHTML).toBe('')
  })
})
