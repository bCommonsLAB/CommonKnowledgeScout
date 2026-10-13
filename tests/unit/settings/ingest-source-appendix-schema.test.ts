import { describe, it, expect } from 'vitest'
import { extractionFormSchema } from '@/components/settings/library/advanced/extraction-form-model'

// Seit Teil B (Seitenmenue Erweitert) liegt das Feld im Extraktions-Schema.
const BASE = {}

describe('extractionFormSchema — ingestSourceAppendix (P6)', () => {
  it('Default ist AN (Owner 05.10.2026)', () => {
    expect(extractionFormSchema.parse(BASE).ingestSourceAppendix).toBe(true)
  })

  it('nimmt false an und lehnt Nicht-Booleans ab', () => {
    expect(extractionFormSchema.parse({ ...BASE, ingestSourceAppendix: false }).ingestSourceAppendix).toBe(false)
    expect(extractionFormSchema.safeParse({ ...BASE, ingestSourceAppendix: 'nein' }).success).toBe(false)
  })
})
