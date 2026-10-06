import { describe, it, expect } from 'vitest'
import { libraryFormSchema } from '@/components/settings/library/hooks/use-library-form'

const BASE = { label: 'Meine Library', path: '/data', type: 'local' as const, storageConfig: {} }

describe('libraryFormSchema — ingestSourceAppendix (P6)', () => {
  it('Default ist an (Owner-Entscheidung 05.10.2026: ganze Tiefe in die Suche)', () => {
    expect(libraryFormSchema.parse(BASE).ingestSourceAppendix).toBe(true)
  })

  it('nimmt false an und lehnt Nicht-Booleans ab', () => {
    expect(libraryFormSchema.parse({ ...BASE, ingestSourceAppendix: false }).ingestSourceAppendix).toBe(false)
    expect(libraryFormSchema.safeParse({ ...BASE, ingestSourceAppendix: 'nein' }).success).toBe(false)
  })
})
