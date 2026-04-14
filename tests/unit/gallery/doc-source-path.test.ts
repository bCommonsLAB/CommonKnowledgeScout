import { describe, expect, it } from 'vitest'
import {
  buildGalleryDocSourcePathLine,
  buildGalleryDocSourcePathParts,
} from '@/lib/gallery/doc-source-path'
import type { DocCardMeta } from '@/lib/gallery/types'

function encodePathLikeClient(relativePath: string): string {
  const utf8Bytes = new TextEncoder().encode(relativePath.replace(/^\/+|\/+$/g, ''))
  let binary = ''
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i])
  }
  return btoa(binary)
}

describe('buildGalleryDocSourcePathLine', () => {
  it('fügt Ingest-Ordner und Quelldatei zu einem Pfad zusammen', () => {
    const doc: DocCardMeta = {
      id: 'x',
      fileId: 'any',
      sourcePath: 'Webseite/2025/Event',
      sourceFileName: 'story.de.md',
    }
    expect(buildGalleryDocSourcePathLine(doc)).toBe('Webseite/2025/Event/story.de.md')
  })

  it('entfernt trailing slash am Ordner vor dem Zusammenfügen', () => {
    const doc: DocCardMeta = {
      id: 'x',
      sourcePath: 'a/b/',
      sourceFileName: 'c.md',
    }
    expect(buildGalleryDocSourcePathLine(doc)).toBe('a/b/c.md')
  })

  it('nutzt dekodierten Speicherpfad aus fileId wenn keine Ingest-Felder', () => {
    const path = 'Lib/Ordner/datei.md'
    const doc: DocCardMeta = {
      id: encodePathLikeClient(path),
      fileId: encodePathLikeClient(path),
      fileName: 'datei.md',
    }
    expect(buildGalleryDocSourcePathLine(doc)).toBe(path)
  })

  it('hängt Index-Dateiname an wenn er nicht schon im dekodierten Pfad endet', () => {
    const path = 'Lib/Ordner/foo.md'
    const doc: DocCardMeta = {
      id: encodePathLikeClient(path),
      fileId: encodePathLikeClient(path),
      fileName: 'index-anders.de.md',
    }
    expect(buildGalleryDocSourcePathLine(doc)).toBe(`${path} · index-anders.de.md`)
  })
})

describe('buildGalleryDocSourcePathParts', () => {
  it('trennt Ingest-Ordner und Dateiname für zwei Zeilen', () => {
    const doc: DocCardMeta = {
      id: 'x',
      sourcePath: 'Webseite/2025/2025-04 Event',
      sourceFileName: 'Story 1dff1a.md',
    }
    expect(buildGalleryDocSourcePathParts(doc)).toEqual({
      directory: 'Webseite/2025/2025-04 Event',
      fileName: 'Story 1dff1a.md',
      joinWithSlash: true,
    })
  })

  it('trennt dekodierten Pfad am letzten Slash; Index-Datei bleibt in der Dateizeile', () => {
    const path = 'Lib/Ordner/foo.md'
    const doc: DocCardMeta = {
      id: encodePathLikeClient(path),
      fileId: encodePathLikeClient(path),
      fileName: 'index-anders.de.md',
    }
    expect(buildGalleryDocSourcePathParts(doc)).toEqual({
      directory: 'Lib/Ordner',
      fileName: 'foo.md · index-anders.de.md',
      joinWithSlash: true,
    })
  })

  it('nutzt bei undekodierbarer ID Punkt-Trennung zwischen ID und Index-Dateiname', () => {
    // mongo-shadow-twin:… wird nicht als Base64-Pfad dekodiert → „opaque“-Zweig wie in der UI
    const doc: DocCardMeta = {
      id: 'mongo-shadow-twin:test',
      fileId: 'mongo-shadow-twin:test',
      fileName: 'published.de.md',
    }
    const p = buildGalleryDocSourcePathParts(doc)
    expect(p.joinWithSlash).toBe(false)
    expect(p.directory).toBe('mongo-shadow-twin:test')
    expect(p.fileName).toBe('published.de.md')
    expect(buildGalleryDocSourcePathLine(doc)).toBe('mongo-shadow-twin:test · published.de.md')
  })
})
