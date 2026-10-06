import { describe, expect, it } from 'vitest'
import {
  applySpeakersFrontmatter,
  extractSpeakerTranscript,
  readAudioSpeakersFromCallback,
} from '@/lib/external-jobs/audio-speakers'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import { stampTwinCoreFrontmatter } from '@/lib/shadow-twin/twin-core-stamp'

const diarizedBody = {
  phase: 'completed',
  data: {
    transcription: { text: 'Guten Morgen. Danke fuer die Einladung.' },
    speakers: ['Sprecher A', 'Sprecher B'],
    segments: [
      { speaker: 'Sprecher A', start: 0, end: 1.2, text: 'Guten Morgen.' },
      { speaker: 'Sprecher B', start: 1.4, end: 3, text: 'Danke fuer die Einladung.' },
    ],
  },
}

describe('audio-speakers (P3a, C2)', () => {
  it('liest Sprecher-Transkript und -Liste aus dem Callback-Body', () => {
    const transcript = extractSpeakerTranscript(diarizedBody)
    expect(transcript?.text).toBe('**Sprecher A:** Guten Morgen.\n\n**Sprecher B:** Danke fuer die Einladung.')
    expect(readAudioSpeakersFromCallback(diarizedBody)).toEqual(['Sprecher A', 'Sprecher B'])
  })

  it('ohne Sprecher-Segmente: null bzw. leere Liste, Markdown unveraendert', () => {
    const body = { phase: 'completed', data: { transcription: { text: 'Nur Text' } } }
    expect(extractSpeakerTranscript(body)).toBeNull()
    expect(readAudioSpeakersFromCallback(body)).toEqual([])
    expect(applySpeakersFrontmatter('Nur Text', [])).toBe('Nur Text')
  })

  it('schreibt speakers als flaches Frontmatter-Feld, das den Twin-Kern-Stempel ueberlebt', () => {
    const md = applySpeakersFrontmatter('**Sprecher A:** Hallo', ['Sprecher A', 'Sprecher B'])
    const stamped = stampTwinCoreFrontmatter(md, {
      kind: 'transcript', sourceFileName: 'a.m4a', targetLanguage: 'de', generatedBy: 'knowledgescout/pipeline',
    })
    const { meta, body } = parseFrontmatter(stamped)
    expect(meta.speakers).toEqual(['Sprecher A', 'Sprecher B'])
    expect(meta.type).toBe('transcript')
    expect(body.trim()).toBe('**Sprecher A:** Hallo')
    // Idempotent: nochmal anwenden aendert nichts
    expect(applySpeakersFrontmatter(stamped, ['Sprecher A', 'Sprecher B'])).toBe(stamped)
  })
})
