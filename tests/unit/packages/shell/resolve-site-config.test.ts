import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { resolveSiteConfig, DEFAULT_SITE_CONFIG } from '@ks/shell'

const ORIGINAL_MAP = process.env.PUBLIC_DOMAIN_LIBRARY_MAP

describe('resolveSiteConfig', () => {
  afterEach(() => {
    if (ORIGINAL_MAP === undefined) {
      delete process.env.PUBLIC_DOMAIN_LIBRARY_MAP
    } else {
      process.env.PUBLIC_DOMAIN_LIBRARY_MAP = ORIGINAL_MAP
    }
  })

  it('liefert DEFAULT_SITE_CONFIG (Voll-App) ohne Host', () => {
    expect(resolveSiteConfig(null)).toEqual(DEFAULT_SITE_CONFIG)
  })

  it('liefert DEFAULT_SITE_CONFIG fuer einen nicht gemappten Host', () => {
    delete process.env.PUBLIC_DOMAIN_LIBRARY_MAP
    expect(resolveSiteConfig('knowledgescout.org')).toEqual(DEFAULT_SITE_CONFIG)
  })

  it('DEFAULT_SITE_CONFIG beschreibt die Voll-App: alle Module, user-selected Library, App-Menue', () => {
    expect(DEFAULT_SITE_CONFIG.libraries.primary).toEqual({ mode: 'user-selected' })
    expect(DEFAULT_SITE_CONFIG.chrome.topNav).toBe('app-menu')
    expect(DEFAULT_SITE_CONFIG.modules).toContain('explorer')
    expect(DEFAULT_SITE_CONFIG.modules).toContain('archive')
  })

  it('liefert eine shell-freie Single-Library-Site fuer einen gemappten Host (Variante B)', () => {
    process.env.PUBLIC_DOMAIN_LIBRARY_MAP = JSON.stringify({ 'oldiesforfuture.org': 'oldiesforfuture' })
    const config = resolveSiteConfig('www.OldiesForFuture.org:443')
    expect(config.libraries.primary).toEqual({ slug: 'oldiesforfuture' })
    expect(config.chrome.topNav).toBe('none')
    expect(config.domains).toEqual(['oldiesforfuture.org'])
    expect(config.modules).toEqual(['explorer'])
  })
})
