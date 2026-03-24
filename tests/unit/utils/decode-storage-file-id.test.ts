import { describe, expect, it } from 'vitest'
import { tryDecodeRelativePathFromFileId } from '@/utils/decode-storage-file-id'

/** Gleiche Kodierung wie in markdown-metadata (UTF-8 → binary string → btoa) */
function encodePathLikeClient(relativePath: string): string {
  const utf8Bytes = new TextEncoder().encode(relativePath.replace(/^\/+|\/+$/g, ''))
  let binary = ''
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i])
  }
  return btoa(binary)
}

describe('tryDecodeRelativePathFromFileId', () => {
  it('returns null for empty and shadow-twin virtual ids', () => {
    expect(tryDecodeRelativePathFromFileId(undefined)).toBe(null)
    expect(tryDecodeRelativePathFromFileId('')).toBe(null)
    expect(tryDecodeRelativePathFromFileId('mongo-shadow-twin:x::y')).toBe(null)
  })

  it('round-trips UTF-8 path segments (Nextcloud-style fileId)', () => {
    const path = 'OldiesForFuture/Webseite/2024/2024-04 FF-Artikel/foo.pdf'
    const id = encodePathLikeClient(path)
    expect(tryDecodeRelativePathFromFileId(id)).toBe(path)
  })

  it('decodes Umlaut path', () => {
    const path = 'Ordner/MOBILITÄT/datei.pdf'
    const id = encodePathLikeClient(path)
    expect(tryDecodeRelativePathFromFileId(id)).toBe(path)
  })

  it('returns null for non-base64 garbage', () => {
    expect(tryDecodeRelativePathFromFileId('not!!!valid')).toBe(null)
  })
})
