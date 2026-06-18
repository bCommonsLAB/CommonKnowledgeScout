/**
 * Tests fuer die sourceId-praezise Bild-Aufloesung in `resolveImageUrl`.
 *
 * Hintergrund (Befund 2 „fremde Bilder"): generische OCR-Bildnamen wie
 * `img-0.jpeg` wurden in der Lese-Route library-weit aufgeloest und konnten so
 * auf ein fremdes Dokument zeigen. Der Fix reicht die `sourceId` (Traeger-fileId)
 * als `&sourceId=` an die `streaming-url` durch, damit die Route praezise auf den
 * richtigen Shadow-Twin scopen kann. Diese Tests fixieren genau dieses Anhaengen.
 */
import { describe, it, expect } from 'vitest'
import { resolveImageUrl } from '@/components/library/markdown-preview/markdown-helpers'

describe('resolveImageUrl – sourceId-Scoping', () => {
  const libraryId = 'lib-1'

  it('haengt &sourceId= an, wenn eine sourceId uebergeben wird', () => {
    const url = resolveImageUrl('img-0.jpeg', 'root', libraryId, 'SRC-123')
    expect(url).toContain('/api/storage/streaming-url?')
    expect(url).toContain(`libraryId=${libraryId}`)
    expect(url).toContain('&sourceId=SRC-123')
  })

  it('haengt KEIN sourceId an, wenn keine sourceId uebergeben wird (Legacy)', () => {
    const url = resolveImageUrl('img-0.jpeg', 'root', libraryId)
    expect(url).toContain('/api/storage/streaming-url?')
    expect(url).not.toContain('sourceId=')
  })

  it('kodiert die sourceId URL-sicher', () => {
    const url = resolveImageUrl('img-0.jpeg', 'root', libraryId, 'a b/c')
    expect(url).toContain('&sourceId=a%20b%2Fc')
  })

  it('laesst absolute http-URLs unveraendert (kein Scoping noetig)', () => {
    const absolute = 'https://example.com/img-0.jpeg'
    expect(resolveImageUrl(absolute, 'root', libraryId, 'SRC-123')).toBe(absolute)
  })

  it('gibt den Pfad unveraendert zurueck, wenn libraryId fehlt', () => {
    expect(resolveImageUrl('img-0.jpeg', 'root', undefined, 'SRC-123')).toBe('img-0.jpeg')
  })
})
