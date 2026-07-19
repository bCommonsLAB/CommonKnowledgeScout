import { describe, it, expect } from 'vitest'
import { normalizeHost, resolveForeignExploreRedirect } from '@/lib/domain-library-map'

const MAP = { 'oldiesforfuture.org': 'oldiesforfuture' }
const APP_URL = 'https://knowledgescout.org'

describe('normalizeHost', () => {
  it('entfernt Port und www, lowercased', () => {
    expect(normalizeHost('WWW.OldiesForFuture.org:443')).toBe('oldiesforfuture.org')
    expect(normalizeHost('localhost:3000')).toBe('localhost')
  })
})

describe('resolveForeignExploreRedirect (Domain-Kopplung)', () => {
  it('erlaubt die eigene Library (inkl. Unterpfade und Query)', () => {
    expect(resolveForeignExploreRedirect({
      host: 'oldiesforfuture.org',
      pathname: '/explore/oldiesforfuture',
      search: '?view=gallery',
      appUrl: APP_URL,
      map: MAP,
    })).toBeNull()
    expect(resolveForeignExploreRedirect({
      host: 'www.oldiesforfuture.org',
      pathname: '/explore/oldiesforfuture/perspective',
      search: '',
      appUrl: APP_URL,
      map: MAP,
    })).toBeNull()
  })

  it('leitet fremde Libraries zur Hauptplattform um (Pfad + Query erhalten)', () => {
    expect(resolveForeignExploreRedirect({
      host: 'oldiesforfuture.org',
      pathname: '/explore/klimamassnahmen',
      search: '?view=gallery',
      appUrl: APP_URL,
      map: MAP,
    })).toBe('https://knowledgescout.org/explore/klimamassnahmen?view=gallery')
  })

  it('ignoriert nicht gemappte Hosts und Nicht-Explore-Pfade', () => {
    expect(resolveForeignExploreRedirect({
      host: 'knowledgescout.org',
      pathname: '/explore/klimamassnahmen',
      search: '',
      appUrl: APP_URL,
      map: MAP,
    })).toBeNull()
    expect(resolveForeignExploreRedirect({
      host: 'oldiesforfuture.org',
      pathname: '/',
      search: '',
      appUrl: APP_URL,
      map: MAP,
    })).toBeNull()
    expect(resolveForeignExploreRedirect({
      host: null,
      pathname: '/explore/klimamassnahmen',
      search: '',
      appUrl: APP_URL,
      map: MAP,
    })).toBeNull()
  })

  it('Loop-Schutz: appUrl auf derselben Domain -> Redirect auf /', () => {
    expect(resolveForeignExploreRedirect({
      host: 'localhost:3000',
      pathname: '/explore/klimamassnahmen',
      search: '',
      appUrl: 'http://localhost:3000',
      map: { localhost: 'oldiesforfuture' },
    })).toBe('/')
  })

  it('fehlende/ungueltige appUrl -> Redirect auf /', () => {
    expect(resolveForeignExploreRedirect({
      host: 'oldiesforfuture.org',
      pathname: '/explore/klimamassnahmen',
      search: '',
      appUrl: undefined,
      map: MAP,
    })).toBe('/')
  })
})
