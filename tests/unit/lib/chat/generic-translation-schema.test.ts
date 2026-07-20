import { describe, expect, it } from 'vitest'
import { buildGenericTranslationSchema } from '@/lib/chat/common/document-translation'

describe('buildGenericTranslationSchema', () => {
  it('akzeptiert null fuer optionale Textfelder (Secretary/LLM-Ausgabe)', () => {
    const schema = buildGenericTranslationSchema(['title', 'hero_subtitle'], [], [])
    const parsed = schema.parse({
      title: 'Impressum',
      hero_subtitle: null,
    })
    expect(parsed.title).toBe('Impressum')
    expect(parsed.hero_subtitle).toBeUndefined()
  })

  it('validiert nur Felder die im Schema stehen (keine Pflicht fuer nicht gelistete Keys)', () => {
    const schema = buildGenericTranslationSchema(['markdown'], [], [])
    expect(() =>
      schema.parse({
        markdown: '# Footer',
        cta_label: null,
      }),
    ).not.toThrow()
  })
})
