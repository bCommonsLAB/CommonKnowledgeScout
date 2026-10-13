import { describe, it, expect } from 'vitest'
import { agentViewFormSchema } from '@/components/settings/library/advanced/agent-view-form-model'

// Seit Teil B (Seitenmenue Erweitert) hat die Agentensicht ein eigenes Schema
// ohne die Grundlagen-Felder (label/path/type).
const BASE = {}

describe('agentViewFormSchema — Agentensicht-Felder', () => {
  it('akzeptiert leere Felder (dokumentierte Defaults)', () => {
    const parsed = agentViewFormSchema.parse(BASE)
    expect(parsed.agentViewVorhabenPattern).toBe('')
    expect(parsed.agentViewIndexDepth).toBe('')
    expect(parsed.agentViewBerichtFreshness).toBe(true)
    expect(parsed.agentViewLocalRootPath).toBe('')
  })

  it('akzeptiert ein gueltiges Vorhaben-Muster und lehnt kaputte Regex laut ab', () => {
    expect(agentViewFormSchema.parse({ ...BASE, agentViewVorhabenPattern: '^\\d{2}\\.\\d{2} ' }).agentViewVorhabenPattern).toBe('^\\d{2}\\.\\d{2} ')
    const result = agentViewFormSchema.safeParse({ ...BASE, agentViewVorhabenPattern: '([' })
    expect(result.success).toBe(false)
  })

  it('laesst nur ganze Zahlen oder leer als Index-Tiefe zu', () => {
    expect(agentViewFormSchema.parse({ ...BASE, agentViewIndexDepth: '2' }).agentViewIndexDepth).toBe('2')
    expect(agentViewFormSchema.safeParse({ ...BASE, agentViewIndexDepth: '-1' }).success).toBe(false)
    expect(agentViewFormSchema.safeParse({ ...BASE, agentViewIndexDepth: 'zwei' }).success).toBe(false)
  })
})
