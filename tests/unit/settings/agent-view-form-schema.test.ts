import { describe, it, expect } from 'vitest'
import { libraryFormSchema } from '@/components/settings/library/hooks/use-library-form'

const BASE = {
  label: 'Meine Library',
  path: '/data',
  type: 'local' as const,
  storageConfig: {},
}

describe('libraryFormSchema — Agentensicht-Felder', () => {
  it('akzeptiert leere Felder (dokumentierte Defaults)', () => {
    const parsed = libraryFormSchema.parse(BASE)
    expect(parsed.agentViewVorhabenPattern).toBe('')
    expect(parsed.agentViewIndexDepth).toBe('')
    expect(parsed.agentViewBerichtFreshness).toBe(true)
    expect(parsed.agentViewLocalRootPath).toBe('')
  })

  it('akzeptiert ein gueltiges Vorhaben-Muster und lehnt kaputte Regex laut ab', () => {
    expect(libraryFormSchema.parse({ ...BASE, agentViewVorhabenPattern: '^\\d{2}\\.\\d{2} ' }).agentViewVorhabenPattern).toBe('^\\d{2}\\.\\d{2} ')
    const result = libraryFormSchema.safeParse({ ...BASE, agentViewVorhabenPattern: '([' })
    expect(result.success).toBe(false)
  })

  it('laesst nur ganze Zahlen oder leer als Index-Tiefe zu', () => {
    expect(libraryFormSchema.parse({ ...BASE, agentViewIndexDepth: '2' }).agentViewIndexDepth).toBe('2')
    expect(libraryFormSchema.safeParse({ ...BASE, agentViewIndexDepth: '-1' }).success).toBe(false)
    expect(libraryFormSchema.safeParse({ ...BASE, agentViewIndexDepth: 'zwei' }).success).toBe(false)
  })
})
