import { describe, expect, it } from 'vitest'
import { isSafeVideoIframeSrc } from '@/lib/media/safe-video-iframe'

describe('isSafeVideoIframeSrc', () => {
  it('rejects bare filenames and relative paths (would load app HTML in iframe)', () => {
    expect(isSafeVideoIframeSrc('Verwahrloste Bahnhöfe WhatsApp Ptt 2026-02-26 at 17.12.33.ogg')).toBe(false)
    expect(isSafeVideoIframeSrc('/library?x=1')).toBe(false)
    expect(isSafeVideoIframeSrc('')).toBe(false)
  })

  it('accepts YouTube and Vimeo https URLs', () => {
    expect(isSafeVideoIframeSrc('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true)
    expect(isSafeVideoIframeSrc('https://youtu.be/dQw4w9WgXcQ')).toBe(true)
    expect(isSafeVideoIframeSrc('https://vimeo.com/12345')).toBe(true)
  })

  it('rejects https audio — not suitable for video iframe', () => {
    expect(isSafeVideoIframeSrc('https://example.com/a.ogg')).toBe(false)
    expect(isSafeVideoIframeSrc('https://example.com/a.mp3')).toBe(false)
  })

  it('accepts direct https mp4/webm', () => {
    expect(isSafeVideoIframeSrc('https://cdn.example.com/clips/x.mp4')).toBe(true)
    expect(isSafeVideoIframeSrc('https://cdn.example.com/x.webm?token=1')).toBe(true)
  })
})
