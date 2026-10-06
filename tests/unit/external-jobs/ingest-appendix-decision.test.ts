import { describe, expect, it } from 'vitest'
import { resolveAppendixDecision } from '@/lib/external-jobs/ingest-appendix-decision'
import { configToJobParameters, createDefaultConfig } from '@/lib/pipeline/pipeline-config'

describe('resolveAppendixDecision (P6)', () => {
  it('Lauf vor Library vor Standard — mit sichtbarer Quelle', () => {
    expect(resolveAppendixDecision({ parameters: { appendixInSearch: false }, library: { config: { ingestSourceAppendix: true } } }))
      .toEqual({ anhang: false, quelle: 'lauf' })
    expect(resolveAppendixDecision({ parameters: {}, library: { config: { ingestSourceAppendix: false } } }))
      .toEqual({ anhang: false, quelle: 'library' })
    expect(resolveAppendixDecision({ parameters: undefined, library: { config: {} } }))
      .toEqual({ anhang: true, quelle: 'standard' })
    expect(resolveAppendixDecision({ parameters: undefined, library: undefined }))
      .toEqual({ anhang: true, quelle: 'standard' })
  })

  it('nimmt nur echte Booleans als Lauf-Entscheidung', () => {
    expect(resolveAppendixDecision({ parameters: { appendixInSearch: 'false' }, library: undefined }).quelle).toBe('standard')
  })
})

describe('configToJobParameters — Idee-F-Optionen (P6)', () => {
  it('reicht nur explizite Booleans durch, nie einen geratenen Wert', () => {
    const ohne = configToJobParameters(createDefaultConfig())
    expect('slidesAsTable' in ohne).toBe(false)
    expect('appendixInSearch' in ohne).toBe(false)

    const mit = configToJobParameters(createDefaultConfig({ slidesAsTable: false, appendixInSearch: true }))
    expect(mit.slidesAsTable).toBe(false)
    expect(mit.appendixInSearch).toBe(true)
  })
})
