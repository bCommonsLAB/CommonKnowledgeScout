// @vitest-environment node
/**
 * Audio-Guard fuer die Ereignis-Ansicht: nur Funkwhale/open.audio-Embeds als iframe,
 * direkte Audio-Dateien als <audio>, alles andere (relative Namen, Webseiten) nicht.
 */
import { describe, it, expect } from 'vitest'
import { isSafeAudioIframeSrc, isDirectAudioFileUrl } from '@/lib/media/safe-video-iframe'

describe('isSafeAudioIframeSrc', () => {
  it('erlaubt den open.audio-Embed aus der Karten-Markdown', () => {
    expect(isSafeAudioIframeSrc('https://open.audio/embed.html?type=track&id=467545')).toBe(true)
  })
  it('lehnt Watch-Seiten, relative Namen und mp3-Dateien ab', () => {
    expect(isSafeAudioIframeSrc('https://open.audio/library/tracks/467545/')).toBe(false)
    expect(isSafeAudioIframeSrc('aufnahme.mp3')).toBe(false)
    expect(isSafeAudioIframeSrc('https://example.org/a.mp3')).toBe(false)
  })
})

describe('isDirectAudioFileUrl', () => {
  it('erkennt direkte Audio-Dateien ueber https', () => {
    expect(isDirectAudioFileUrl('https://blob.example/a.mp3?sv=1')).toBe(true)
    expect(isDirectAudioFileUrl('https://blob.example/a.ogg')).toBe(true)
  })
  it('lehnt Embeds und relative Namen ab', () => {
    expect(isDirectAudioFileUrl('https://open.audio/embed.html?type=track&id=1')).toBe(false)
    expect(isDirectAudioFileUrl('a.mp3')).toBe(false)
  })
})
