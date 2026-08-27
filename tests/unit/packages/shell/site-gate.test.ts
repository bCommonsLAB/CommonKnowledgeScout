import { describe, it, expect, afterEach } from 'vitest'
import {
  siteGate,
  getRequestHost,
  isModuleActiveForHost,
  getSiteRegistry,
  DEFAULT_SITE_ID,
} from '@ks/shell'

/** Minimaler Request nach `SiteGateRequest`. */
function req(headers: Record<string, string>) {
  return { headers: { get: (name: string) => headers[name.toLowerCase()] ?? null } }
}

const ENV_KEY = 'PUBLIC_DOMAIN_LIBRARY_MAP'
const originalEnv = process.env[ENV_KEY]
afterEach(() => {
  if (originalEnv === undefined) delete process.env[ENV_KEY]
  else process.env[ENV_KEY] = originalEnv
})

describe('getRequestHost', () => {
  it('bevorzugt x-forwarded-host vor host (gleiche Reihenfolge wie das Root-Layout)', () => {
    expect(getRequestHost(req({ 'x-forwarded-host': 'aussen.org', host: 'intern:3000' }))).toBe('aussen.org')
  })

  it('faellt auf host zurueck, wenn kein Proxy-Header gesetzt ist', () => {
    expect(getRequestHost(req({ host: 'knowledgescout.org' }))).toBe('knowledgescout.org')
  })

  it('liefert null, wenn beide Header fehlen', () => {
    expect(getRequestHost(req({}))).toBeNull()
  })
})

describe('isModuleActiveForHost', () => {
  it('laesst gebaute Module auf der Default-Site durch', () => {
    expect(isModuleActiveForHost('explorer', 'knowledgescout.org')).toBe(true)
    expect(isModuleActiveForHost('archive', null)).toBe(true)
  })

  it('sperrt Modul-Kandidaten, die es im Code noch nicht gibt', () => {
    expect(isModuleActiveForHost('workbench', 'knowledgescout.org')).toBe(false)
    expect(isModuleActiveForHost('import', null)).toBe(false)
  })
})

describe('siteGate', () => {
  it('gibt null zurueck, wenn das Modul aktiv ist — die Route laeuft normal weiter', () => {
    expect(siteGate('explorer', req({ host: 'knowledgescout.org' }))).toBeNull()
  })

  it('antwortet mit 404 und nennt das Modul, wenn es fuer die Site inaktiv ist', async () => {
    const response = siteGate('workbench', req({ host: 'knowledgescout.org' }))
    expect(response).not.toBeNull()
    expect(response?.status).toBe(404)
    const body = (await response?.json()) as { error: string }
    expect(body.error).toContain('workbench')
  })

  it('entscheidet anhand des Proxy-Hosts, nicht des internen Hosts', () => {
    process.env[ENV_KEY] = JSON.stringify({ 'beispiel.org': 'beispiel' })
    // Beide Sites haben `explorer` aktiv — das Gate laesst hier bewusst durch.
    // Geprueft wird, dass ueberhaupt der Proxy-Host die Site bestimmt.
    const site = getSiteRegistry().byHost['beispiel.org']
    expect(site).toBeDefined()
    expect(siteGate('explorer', req({ 'x-forwarded-host': 'beispiel.org', host: 'intern' }))).toBeNull()
  })
})

describe('getSiteRegistry — Memoisierung', () => {
  it('liefert bei unveraenderter ENV dieselbe Instanz (kein erneutes JSON-Parsen pro Request)', () => {
    process.env[ENV_KEY] = JSON.stringify({ 'a.org': 'a' })
    expect(getSiteRegistry()).toBe(getSiteRegistry())
  })

  it('baut neu, sobald sich die ENV aendert — kein still veralteter Zustand', () => {
    process.env[ENV_KEY] = JSON.stringify({ 'a.org': 'a' })
    const first = getSiteRegistry()
    process.env[ENV_KEY] = JSON.stringify({ 'b.org': 'b' })
    const second = getSiteRegistry()
    expect(second).not.toBe(first)
    expect(Object.keys(second.byHost)).toEqual(['b.org'])
    expect(second.defaultSite.id).toBe(DEFAULT_SITE_ID)
  })
})
