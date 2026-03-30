import { describe, it, expect } from 'vitest'

/**
 * Spiegelt die Logik aus GET /api/public/libraries/[slug] (safeLibrary):
 * Keine Live-URL ohne explizites sitePublished — kein stiller Fallback.
 */
function buildSafePublicSiteFields(pub: {
  siteEnabled?: boolean
  sitePublished?: boolean
  siteUrl?: string
  siteVersion?: number
  sitePublishedAt?: string
}) {
  const siteEnabled = pub.siteEnabled === true
  const sitePublished = pub.sitePublished === true
  return {
    siteEnabled,
    sitePublished,
    siteVersion: sitePublished ? pub.siteVersion : undefined,
    sitePublishedAt: sitePublished ? pub.sitePublishedAt : undefined,
    siteUrl: sitePublished ? pub.siteUrl : undefined,
  }
}

describe('Öffentliche Explore-API: Site-Metadaten (Gating)', () => {
  it('liefert siteUrl nur wenn sitePublished true', () => {
    const a = buildSafePublicSiteFields({
      sitePublished: true,
      siteUrl: 'https://example.blob.core.windows.net/c/x/v1/index.html',
      siteVersion: 3,
      sitePublishedAt: '2025-01-01T00:00:00.000Z',
    })
    expect(a.siteUrl).toBeDefined()
    expect(a.siteVersion).toBe(3)
  })

  it('liefert keine siteUrl bei sitePublished false oder fehlend', () => {
    const b = buildSafePublicSiteFields({
      sitePublished: false,
      siteUrl: 'https://example.blob.core.windows.net/c/x/v1/index.html',
      siteVersion: 3,
    })
    expect(b.siteUrl).toBeUndefined()
    expect(b.siteVersion).toBeUndefined()

    const c = buildSafePublicSiteFields({})
    expect(c.siteUrl).toBeUndefined()
    expect(c.sitePublished).toBe(false)
  })

  it('markiert die Startseite nur als aktivierbar wenn siteEnabled explizit true ist', () => {
    const a = buildSafePublicSiteFields({ siteEnabled: true })
    expect(a.siteEnabled).toBe(true)

    const b = buildSafePublicSiteFields({ siteEnabled: false })
    expect(b.siteEnabled).toBe(false)

    const c = buildSafePublicSiteFields({})
    expect(c.siteEnabled).toBe(false)
  })
})
