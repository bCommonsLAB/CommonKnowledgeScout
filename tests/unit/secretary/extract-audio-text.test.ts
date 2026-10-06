import { describe, expect, it } from 'vitest'
import { extractSecretaryAudioText, extractSecretaryAudioTranscript, buildSpeakerParagraphs } from '@/lib/secretary/extract-audio-text'

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

describe('extractSecretaryAudioTranscript — Sprecher-Segmente (P3a, C2)', () => {
  it('fasst aufeinanderfolgende Segmente desselben Sprechers zu einem Absatz zusammen', () => {
    const response = {
      data: {
        output_text: 'Sprecher A: Guten Morgen. Schoen, dass es geklappt hat. Sprecher B: Danke.',
        speakers: ['Sprecher A', 'Sprecher B'],
        segments: [
          { speaker: 'Sprecher A', start: 0, end: 1, text: 'Guten Morgen.' },
          { speaker: 'Sprecher A', start: 1, end: 2, text: 'Schoen, dass es geklappt hat.' },
          { speaker: 'Sprecher B', start: 2, end: 3, text: 'Danke.' },
          { speaker: 'Sprecher A', start: 3, end: 4, text: 'Gerne.' },
        ],
      },
    }
    const result = extractSecretaryAudioTranscript(response)
    expect(result.text).toBe(
      '**Sprecher A:** Guten Morgen. Schoen, dass es geklappt hat.\n\n**Sprecher B:** Danke.\n\n**Sprecher A:** Gerne.'
    )
    expect(result.speakers).toEqual(['Sprecher A', 'Sprecher B'])
    // Sprecher-Darstellung geht output_text vor
    expect(extractSecretaryAudioText(response)).toBe(result.text)
  })

  it('leitet die Sprecherliste aus den Segmenten ab, wenn speakers fehlt (Reihenfolge des ersten Auftretens)', () => {
    const result = extractSecretaryAudioTranscript({
      data: { transcription: { segments: [
        { speaker: 'Sprecher B', text: 'Hallo' },
        { speaker: 'Sprecher A', text: 'Hi' },
        { speaker: 'Sprecher B', text: 'Wie geht es?' },
      ] } },
    })
    expect(result.speakers).toEqual(['Sprecher B', 'Sprecher A'])
    expect(result.text).toBe('**Sprecher B:** Hallo\n\n**Sprecher A:** Hi\n\n**Sprecher B:** Wie geht es?')
  })

  it('Segmente ohne speaker bleiben Bestandsverhalten (keine Praefixe, keine Sprecher)', () => {
    const result = extractSecretaryAudioTranscript({ data: { segments: [{ text: 'Teil A' }, { text: 'Teil B' }] } })
    expect(result).toEqual({ text: 'Teil A Teil B', speakers: [] })
  })

  it('Segment ohne Label inmitten gelabelter Segmente bleibt sichtbar ohne Praefix', () => {
    expect(buildSpeakerParagraphs([
      { speaker: 'Sprecher A', text: 'Eins' },
      { speaker: '', text: 'Zwei' },
      { speaker: 'Sprecher A', text: 'Drei' },
    ])).toBe('**Sprecher A:** Eins\n\nZwei\n\n**Sprecher A:** Drei')
  })
})
