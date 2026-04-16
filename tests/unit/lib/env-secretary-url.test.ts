import { describe, expect, it, afterEach, vi } from 'vitest'
import { buildSecretaryServiceApiUrl } from '@/lib/env'

describe('buildSecretaryServiceApiUrl', () => {
  it('hängt den relativen Pfad an, wenn die Basis mit /api endet', () => {
    expect(buildSecretaryServiceApiUrl('http://localhost:5001/api', 'image-analyzer/process')).toBe(
      'http://localhost:5001/api/image-analyzer/process'
    )
  })

  it('fügt /api ein, wenn die Basis kein /api-Suffix hat', () => {
    expect(buildSecretaryServiceApiUrl('http://localhost:5001', 'imageocr/process')).toBe(
      'http://localhost:5001/api/imageocr/process'
    )
  })

  it('normalisiert doppelte Slashes im relativen Pfad nicht aggressiv (nur führend)', () => {
    expect(buildSecretaryServiceApiUrl('http://h/api', '/x/y')).toBe('http://h/api/x/y')
  })
})

describe('getSecretaryImageAnalyzerRelativePath', () => {
  afterEach(() => {
    delete process.env.SECRETARY_IMAGE_ANALYZER_PATH
    vi.resetModules()
  })

  it('Standard: image-analyzer/process (Secretary-Doku)', async () => {
    delete process.env.SECRETARY_IMAGE_ANALYZER_PATH
    vi.resetModules()
    const { getSecretaryImageAnalyzerRelativePath } = await import('@/lib/env')
    expect(getSecretaryImageAnalyzerRelativePath()).toBe('image-analyzer/process')
  })

  it('SECRETARY_IMAGE_ANALYZER_PATH überschreibt den Default', async () => {
    process.env.SECRETARY_IMAGE_ANALYZER_PATH = '/custom/vision/template'
    vi.resetModules()
    const { getSecretaryImageAnalyzerRelativePath } = await import('@/lib/env')
    expect(getSecretaryImageAnalyzerRelativePath()).toBe('custom/vision/template')
  })
})
