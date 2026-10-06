import { describe, it, expect } from 'vitest'
import { libraryFormSchema } from '@/components/settings/library/hooks/use-library-form'

const BASE = { label: 'Meine Library', path: '/data', type: 'local' as const, storageConfig: {} }

describe('libraryFormSchema — transcriptionSpeakerMode (P3a)', () => {
  it('Default ist aus (dokumentiert: Kontext-Weg ohne Sprecher)', () => {
    expect(libraryFormSchema.parse(BASE).transcriptionSpeakerMode).toBe(false)
  })

  it('nimmt true an und lehnt Nicht-Booleans ab', () => {
    expect(libraryFormSchema.parse({ ...BASE, transcriptionSpeakerMode: true }).transcriptionSpeakerMode).toBe(true)
    expect(libraryFormSchema.safeParse({ ...BASE, transcriptionSpeakerMode: 'ja' }).success).toBe(false)
  })
})
