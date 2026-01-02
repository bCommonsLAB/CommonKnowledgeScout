import { describe, expect, it } from 'vitest'
import { normalizeSuggestedQuestionsToSeven } from '@/lib/chat/common/normalize-suggested-questions'

describe('normalizeSuggestedQuestionsToSeven', () => {
  it('trims, removes empty strings, de-duplicates and truncates to 7', () => {
    const result = normalizeSuggestedQuestionsToSeven({
      seedQuestion: 'Ecommony',
      suggestedQuestions: [
        '  Frage A  ',
        '',
        'Frage B',
        'Frage A',
        'Frage C',
        'Frage D',
        'Frage E',
        'Frage F',
        'Frage G',
        'Frage H',
      ],
    })

    expect(result).toHaveLength(7)
    expect(result).toEqual([
      'Frage A',
      'Frage B',
      'Frage C',
      'Frage D',
      'Frage E',
      'Frage F',
      'Frage G',
    ])
  })

  it('pads deterministically with fallback questions when fewer than 7 are provided', () => {
    const result = normalizeSuggestedQuestionsToSeven({
      seedQuestion: 'Was ist eine Ecommony?',
      suggestedQuestions: ['Was sind die Grundideen?'],
    })

    expect(result).toHaveLength(7)
    expect(result[0]).toBe('Was sind die Grundideen?')
    expect(result).toContain('Kannst du Was ist eine Ecommony? in einfachen Worten erklären?')
  })
})






