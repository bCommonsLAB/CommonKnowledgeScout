import { describe, expect, it } from 'vitest'
import { extractSecretaryAudioText } from '@/lib/secretary/extract-audio-text'

describe('extractSecretaryAudioText', () => {
  it('bevorzugt output_text vor transcription.text', () => {
    const response = {
      data: {
        output_text: 'Satz 1. Satz 2. Satz 3.',
        transcription: { text: 'Satz 3.' },
      },
    }

    expect(extractSecretaryAudioText(response)).toBe('Satz 1. Satz 2. Satz 3.')
  })

  it('nutzt translated_text wenn output_text fehlt', () => {
    const response = {
      data: {
        translated_text: 'Uebersetzter Text',
      },
    }

    expect(extractSecretaryAudioText(response)).toBe('Uebersetzter Text')
  })

  it('faellt auf original_text zurueck', () => {
    const response = {
      data: {
        original_text: 'Original Volltext',
      },
    }

    expect(extractSecretaryAudioText(response)).toBe('Original Volltext')
  })

  it('faellt auf transcription.text zurueck', () => {
    const response = {
      data: {
        transcription: { text: 'Transkript' },
      },
    }

    expect(extractSecretaryAudioText(response)).toBe('Transkript')
  })

  it('baut Text aus segments wenn sonst nichts vorhanden', () => {
    const response = {
      data: {
        segments: [{ text: 'Teil A' }, { text: 'Teil B' }],
      },
    }

    expect(extractSecretaryAudioText(response)).toBe('Teil A Teil B')
  })

  it('gibt leer zurueck bei ungueltiger Struktur', () => {
    expect(extractSecretaryAudioText(null)).toBe('')
    expect(extractSecretaryAudioText({})).toBe('')
    expect(extractSecretaryAudioText({ data: null })).toBe('')
  })
})
