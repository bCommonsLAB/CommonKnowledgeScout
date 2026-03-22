/**
 * @fileoverview Persistenz: Azure-URLs → kanonische Bild-Dateinamen im Markdown-Text.
 */

import { describe, it, expect } from 'vitest'
import {
  buildPersistableImageBinaryFragment,
  rewriteMarkdownAzureUrlsToCanonicalFileNames,
  vaultRelativeShadowTwinImagePath,
} from '@/lib/shadow-twin/shadow-twin-mongo-writer'

describe('vaultRelativeShadowTwinImagePath', () => {
  it('setzt Shadow-Twin-Ordner vor den Basisdateinamen', () => {
    expect(vaultRelativeShadowTwinImagePath('Bericht.pdf', 'img-0.jpeg')).toBe('_Bericht.pdf/img-0.jpeg')
  })

  it('verdoppelt den Ordner nicht, wenn er schon im Pfad steht', () => {
    expect(vaultRelativeShadowTwinImagePath('a.pdf', '_a.pdf/img-1.jpeg')).toBe('_a.pdf/img-1.jpeg')
  })
})

describe('rewriteMarkdownAzureUrlsToCanonicalFileNames', () => {
  it('ersetzt Markdown- und HTML-Bild-URLs durch relativen Vault-Pfad', () => {
    const azure = 'https://store.example/container/lib/src/abc123dead.jpeg'
    const md = `![x](${azure})\n<img src="${azure}">`
    const out = rewriteMarkdownAzureUrlsToCanonicalFileNames(md, [
      { absoluteUrl: azure, canonicalFileName: '_report.pdf/img-2.jpeg' },
    ])
    expect(out).toBe('![x](_report.pdf/img-2.jpeg)\n<img src="_report.pdf/img-2.jpeg">')
  })

  it('längere URLs zuerst (Teilstrings)', () => {
    const long = 'https://a.com/x/y/long.jpeg'
    const short = 'https://a.com/x/y.jpeg'
    const md = `![](${long}) ![](${short})`
    const out = rewriteMarkdownAzureUrlsToCanonicalFileNames(md, [
      { absoluteUrl: short, canonicalFileName: 'a.jpeg' },
      { absoluteUrl: long, canonicalFileName: 'b.jpeg' },
    ])
    expect(out).toBe('![](b.jpeg) ![](a.jpeg)')
  })
})

describe('buildPersistableImageBinaryFragment', () => {
  it('normalisiert neue Mongo-BinaryFragments konsistent', () => {
    const fragment = buildPersistableImageBinaryFragment({
      canonicalName: 'img-0.jpeg',
      blobStyleName: '326c3b8ce2b1ad76.jpeg',
      url: 'https://blob.example/books/326c3b8ce2b1ad76.jpeg',
    })

    expect(fragment).toEqual({
      name: 'img-0.jpeg',
      originalName: '326c3b8ce2b1ad76.jpeg',
      kind: 'image',
      url: 'https://blob.example/books/326c3b8ce2b1ad76.jpeg',
      hash: '326c3b8ce2b1ad76',
      mimeType: 'image/jpeg',
      size: undefined,
      createdAt: expect.any(String),
    })
  })
})
