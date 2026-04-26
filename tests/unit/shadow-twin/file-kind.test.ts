/**
 * Unit-Tests fuer pure Helper aus `src/lib/shadow-twin/file-kind.ts`.
 *
 * Welle 2, Schritt 3+4: Helper aus `shadow-twin-migration-writer.ts`
 * extrahiert, hier wird das beobachtete Verhalten als Char-Test
 * festgeschrieben.
 */

import { describe, expect, it } from 'vitest'
import { getFileKind, getMimeTypeFromFileName } from '@/lib/shadow-twin/file-kind'

describe('getFileKind', () => {
  it('erkennt Markdown via Endung (.md, .mdx, .txt)', () => {
    expect(getFileKind('note.md')).toBe('markdown')
    expect(getFileKind('doc.mdx')).toBe('markdown')
    expect(getFileKind('readme.txt')).toBe('markdown')
  })

  it('erkennt Markdown via MIME-Type (auch ohne passende Endung)', () => {
    expect(getFileKind('note.bin', 'text/markdown')).toBe('markdown')
    expect(getFileKind('note.bin', 'application/x-markdown')).toBe('markdown')
  })

  it('erkennt Bilder via Endung und MIME-Type', () => {
    expect(getFileKind('cover.png')).toBe('image')
    expect(getFileKind('cover.jpg')).toBe('image')
    expect(getFileKind('cover.jpeg')).toBe('image')
    expect(getFileKind('logo.svg')).toBe('image')
    expect(getFileKind('icon.bmp')).toBe('image')
    expect(getFileKind('cover.bin', 'image/png')).toBe('image')
    expect(getFileKind('cover.bin', 'image/webp')).toBe('image')
  })

  it('erkennt Audio via Endung und MIME-Type', () => {
    expect(getFileKind('voice.mp3')).toBe('audio')
    expect(getFileKind('clip.m4a')).toBe('audio')
    expect(getFileKind('clip.flac')).toBe('audio')
    expect(getFileKind('clip.bin', 'audio/mpeg')).toBe('audio')
  })

  it('erkennt Video via Endung und MIME-Type', () => {
    expect(getFileKind('clip.mp4')).toBe('video')
    expect(getFileKind('clip.mov')).toBe('video')
    expect(getFileKind('clip.webm')).toBe('video')
    expect(getFileKind('clip.bin', 'video/mp4')).toBe('video')
  })

  it('liefert "binary" als Default fuer unbekannte Endungen', () => {
    expect(getFileKind('archive.zip')).toBe('binary')
    expect(getFileKind('data.dat')).toBe('binary')
    expect(getFileKind('blob')).toBe('binary')
  })

  it('ist case-insensitive bei Endung und MIME-Type', () => {
    expect(getFileKind('COVER.PNG')).toBe('image')
    expect(getFileKind('clip.MP4', 'VIDEO/MP4')).toBe('video')
  })

  it('priorisiert Markdown vor Image bei Mehrdeutigkeit', () => {
    // Falls jemand ein .md mit image-MIME schickt: Markdown gewinnt
    // (Markdown-Branch kommt im Code zuerst).
    expect(getFileKind('note.md', 'image/png')).toBe('markdown')
  })
})

describe('getMimeTypeFromFileName', () => {
  it('liefert MIME-Type fuer bekannte Bild-Endungen', () => {
    expect(getMimeTypeFromFileName('cover.png')).toBe('image/png')
    expect(getMimeTypeFromFileName('cover.jpg')).toBe('image/jpeg')
    expect(getMimeTypeFromFileName('cover.jpeg')).toBe('image/jpeg')
    expect(getMimeTypeFromFileName('logo.svg')).toBe('image/svg+xml')
  })

  it('liefert MIME-Type fuer bekannte Audio-Endungen', () => {
    expect(getMimeTypeFromFileName('voice.mp3')).toBe('audio/mpeg')
    expect(getMimeTypeFromFileName('voice.m4a')).toBe('audio/mp4')
    expect(getMimeTypeFromFileName('voice.flac')).toBe('audio/flac')
  })

  it('liefert MIME-Type fuer bekannte Video-Endungen', () => {
    expect(getMimeTypeFromFileName('clip.mp4')).toBe('video/mp4')
    expect(getMimeTypeFromFileName('clip.mov')).toBe('video/quicktime')
    expect(getMimeTypeFromFileName('clip.webm')).toBe('video/webm')
  })

  it('liefert text/markdown fuer .md/.mdx', () => {
    expect(getMimeTypeFromFileName('note.md')).toBe('text/markdown')
    expect(getMimeTypeFromFileName('note.mdx')).toBe('text/markdown')
  })

  it('ist case-insensitive bei der Endung', () => {
    expect(getMimeTypeFromFileName('COVER.PNG')).toBe('image/png')
    expect(getMimeTypeFromFileName('VOICE.MP3')).toBe('audio/mpeg')
  })

  it('liefert undefined fuer unbekannte Endungen', () => {
    expect(getMimeTypeFromFileName('archive.zip')).toBeUndefined()
    expect(getMimeTypeFromFileName('data.xyz')).toBeUndefined()
  })

  it('liefert undefined fuer Dateien ohne Endung oder mit Trailing-Dot', () => {
    expect(getMimeTypeFromFileName('blob')).toBeUndefined()
    expect(getMimeTypeFromFileName('.gitignore')).toBeUndefined() // ext='gitignore', kein Match in mimeMap
    expect(getMimeTypeFromFileName('file.')).toBeUndefined()
  })
})
