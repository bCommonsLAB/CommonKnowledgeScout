import { describe, it, expect } from 'vitest'
import {
  DEFAULT_SITE_CONFIG,
  DEFAULT_SITE_ID,
  buildSiteRegistry,
  resolveSiteConfigForHost,
} from '@ks/shell'
import { isSitePrimaryBySlug } from '@ks/contracts'

const REGISTRY = buildSiteRegistry({ 'oldiesforfuture.org': 'oldiesforfuture' })

describe('buildSiteRegistry', () => {
  it('macht aus jeder gemappten Domain eine Site mit fest gebundener Primaer-Library', () => {
    const site = REGISTRY.byHost['oldiesforfuture.org']
    expect(site).toBeDefined()
    expect(isSitePrimaryBySlug(site.libraries.primary)).toBe(true)
    expect(site.libraries.primary).toEqual({ slug: 'oldiesforfuture' })
    expect(site.domains).toEqual(['oldiesforfuture.org'])
  })

  it('normalisiert Domain-Schluessel (www/Port/Grossschreibung)', () => {
    const registry = buildSiteRegistry({ 'WWW.Example.ORG:8080': 'beispiel' })
    expect(Object.keys(registry.byHost)).toEqual(['example.org'])
  })

  it('gibt host-gebundenen Sites denselben Modul-Umfang wie der Voll-App (verhaltensneutral)', () => {
    expect(REGISTRY.byHost['oldiesforfuture.org'].modules).toEqual(DEFAULT_SITE_CONFIG.modules)
  })

  it('behaelt die Voll-App als Default-Site: Nutzer waehlt die Library selbst', () => {
    expect(REGISTRY.defaultSite.id).toBe(DEFAULT_SITE_ID)
    expect(REGISTRY.defaultSite.libraries.primary).toEqual({ mode: 'user-selected' })
    expect(isSitePrimaryBySlug(REGISTRY.defaultSite.libraries.primary)).toBe(false)
  })

  it('fuehrt keine noch nicht gebauten Modul-Kandidaten auf', () => {
    expect(DEFAULT_SITE_CONFIG.modules).not.toContain('import')
    expect(DEFAULT_SITE_CONFIG.modules).not.toContain('workbench')
  })
})

describe('resolveSiteConfigForHost', () => {
  it('loest einen gemappten Host auf seine Site auf — auch mit www und Port', () => {
    expect(resolveSiteConfigForHost('oldiesforfuture.org', REGISTRY).id).toBe('domain:oldiesforfuture.org')
    expect(resolveSiteConfigForHost('WWW.OldiesForFuture.org:443', REGISTRY).id).toBe('domain:oldiesforfuture.org')
  })

  it('faellt fuer jeden anderen Host auf die Default-Site (Voll-App)', () => {
    expect(resolveSiteConfigForHost('knowledgescout.org', REGISTRY).id).toBe(DEFAULT_SITE_ID)
    expect(resolveSiteConfigForHost('localhost:3000', REGISTRY).id).toBe(DEFAULT_SITE_ID)
  })

  it('faellt ohne Host auf die Default-Site', () => {
    expect(resolveSiteConfigForHost(null, REGISTRY).id).toBe(DEFAULT_SITE_ID)
    expect(resolveSiteConfigForHost(undefined, REGISTRY).id).toBe(DEFAULT_SITE_ID)
    expect(resolveSiteConfigForHost('   ', REGISTRY).id).toBe(DEFAULT_SITE_ID)
  })

  it('bildet die bisherige Domain-Map-Aufloesung 1:1 ab', () => {
    // Vor M3: getDomainLibraryMap()[normalizeHost(host)] -> slug | undefined.
    const map: Record<string, string> = { 'oldiesforfuture.org': 'oldiesforfuture' }
    const registry = buildSiteRegistry(map)
    for (const host of ['oldiesforfuture.org', 'www.oldiesforfuture.org:443', 'knowledgescout.org', 'localhost']) {
      const primary = resolveSiteConfigForHost(host, registry).libraries.primary
      const viaRegistry = isSitePrimaryBySlug(primary) ? primary.slug : undefined
      const viaMap = map[host.trim().toLowerCase().replace(/:\d+$/, '').replace(/^www\./, '')]
      expect(viaRegistry).toBe(viaMap)
    }
  })
})
