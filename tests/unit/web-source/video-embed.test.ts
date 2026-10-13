import { describe, expect, it } from 'vitest'
import { embedUrlAusAdresse, embedUrlFuerVideo } from '@/lib/web-source/video-embed'
import { mimeFuer } from '@/lib/web-source/media-resolve'

describe('embedUrlAusAdresse', () => {
  it('YouTube watch, youtu.be, shorts → embed', () => {
    expect(embedUrlAusAdresse('https://www.youtube.com/watch?v=jNQXAC9IVRw&t=3')).toBe('https://www.youtube.com/embed/jNQXAC9IVRw')
    expect(embedUrlAusAdresse('https://youtu.be/jNQXAC9IVRw')).toBe('https://www.youtube.com/embed/jNQXAC9IVRw')
    expect(embedUrlAusAdresse('https://www.youtube.com/shorts/abcdefghijk')).toBe('https://www.youtube.com/embed/abcdefghijk')
  })
  it('Vimeo Seite und Player → player', () => {
    expect(embedUrlAusAdresse('https://vimeo.com/123456789')).toBe('https://player.vimeo.com/video/123456789')
    expect(embedUrlAusAdresse('https://player.vimeo.com/video/123456789?h=abc')).toBe('https://player.vimeo.com/video/123456789')
  })
  it('PeerTube /w/ → /videos/embed/', () => {
    expect(embedUrlAusAdresse('https://peertube.uno/w/abcdefgh1234')).toBe('https://peertube.uno/videos/embed/abcdefgh1234')
  })
  it('unbekannte Seiten → null (kein geratenes Embed)', () => {
    expect(embedUrlAusAdresse('https://www.rainews.it/tgr/tagesschau/video/2026/10/x.html')).toBeNull()
    expect(embedUrlAusAdresse('nicht-eine-url')).toBeNull()
  })
})

describe('embedUrlFuerVideo', () => {
  it('nimmt die Seite selbst, sonst ein Embed aus den Medien', () => {
    expect(embedUrlFuerVideo('https://www.youtube.com/watch?v=jNQXAC9IVRw', [])).toBe('https://www.youtube.com/embed/jNQXAC9IVRw')
    expect(embedUrlFuerVideo('https://example.org/artikel', [{ url: 'https://www.youtube.com/embed/jNQXAC9IVRw', art: 'embed', herkunft: 'tag' }])).toBe('https://www.youtube.com/embed/jNQXAC9IVRw')
    expect(embedUrlFuerVideo('https://example.org/artikel', [{ url: 'https://media.example/a.mp3', art: 'audio', herkunft: 'json-ld' }])).toBeNull()
  })
})

describe('mimeFuer', () => {
  it('reine Tonspur im Video-Container gilt als Audio', () => {
    expect(mimeFuer('webm', true, 'application/octet-stream')).toBe('audio/webm')
    expect(mimeFuer('mp4', false, 'application/octet-stream')).toBe('video/mp4')
    expect(mimeFuer('m4a', true, 'application/octet-stream')).toBe('audio/mp4')
    expect(mimeFuer('bin', true, 'application/octet-stream')).toBe('application/octet-stream')
  })
})
