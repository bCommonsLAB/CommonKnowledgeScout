import { describe, it, expect } from 'vitest'
import { buildTopNavConfig } from '@/components/top-nav-config'

function t(key: string): string {
  return key
}

describe('buildTopNavConfig', () => {
  it('zeigt fuer anonyme Nutzer nur die minimale oeffentliche Navigation und kein Zahnrad-Menue', () => {
    const result = buildTopNavConfig({
      isCreator: false,
      webViewEnabled: false,
      webViewTestHref: '',
      t,
    })

    expect(result.publicNavItems.map((item) => item.href)).toEqual(['/'])
    expect(result.secondaryNavItems).toEqual([])
    expect(result.showMoreMenu).toBe(false)
  })

  it('zeigt fuer Creator die erweiterten Bereiche weiterhin an', () => {
    const result = buildTopNavConfig({
      isCreator: true,
      webViewEnabled: true,
      webViewTestHref: '/explore/test?view=site',
      t,
    })

    expect(result.publicNavItems.map((item) => item.href)).toEqual(['/', '/docs/'])
    expect(result.primaryProtectedNavItems.map((item) => item.href)).toContain('/library')
    expect(result.primaryProtectedNavItems.map((item) => item.href)).toContain('/library/gallery')
    expect(result.primaryProtectedNavItems.map((item) => item.href)).toContain('/library/inbox')
    expect(result.primaryProtectedNavItems.map((item) => item.href)).toContain('/explore/test?view=site')
    expect(result.secondaryNavItems.map((item) => item.href)).toEqual([
      '/templates',
      '/event-monitor',
      '/session-manager',
    ])
    expect(result.showMoreMenu).toBe(true)
  })

  it('Explore-Kontext MIT Website: Home | Inhalte | Story Mode (auch anonym)', () => {
    const result = buildTopNavConfig({
      isCreator: false,
      webViewEnabled: true,
      webViewTestHref: '/explore/oldiesforfuture?view=site',
      exploreContext: { slug: 'oldiesforfuture', siteEnabled: true },
      t,
    })

    expect(result.publicNavItems.map((item) => item.href)).toEqual([
      '/explore/oldiesforfuture',
      '/explore/oldiesforfuture?view=gallery',
      '/explore/oldiesforfuture?mode=story',
    ])
    expect(result.primaryProtectedNavItems).toEqual([])
    expect(result.showMoreMenu).toBe(false)
  })

  it('Explore-Kontext OHNE Website: Home (KS-Startseite) | Inhalte (Basis-Link) | Story Mode', () => {
    const result = buildTopNavConfig({
      isCreator: false,
      webViewEnabled: false,
      webViewTestHref: '',
      exploreContext: { slug: 'klimarat', siteEnabled: false },
      t,
    })

    // C1b: „Home" fuehrt zurueck auf die KnowledgeScout-Startseite —
    // vorher gab es aus einer Library keinen Weg zurueck.
    expect(result.publicNavItems.map((item) => item.href)).toEqual([
      '/',
      '/explore/klimarat',
      '/explore/klimarat?mode=story',
    ])
  })

  it('Explore-Kontext MIT Website: sitePages (z. B. Kontakt) direkt nach Home', () => {
    const result = buildTopNavConfig({
      isCreator: false,
      webViewEnabled: true,
      webViewTestHref: '/explore/oldiesforfuture?view=site',
      exploreContext: {
        slug: 'oldiesforfuture',
        siteEnabled: true,
        sitePages: [{ name: 'Kontakt', href: '/explore/oldiesforfuture?site=kontakt' }],
      },
      t,
    })

    expect(result.publicNavItems.map((item) => item.href)).toEqual([
      '/explore/oldiesforfuture',
      '/explore/oldiesforfuture?site=kontakt',
      '/explore/oldiesforfuture?view=gallery',
      '/explore/oldiesforfuture?mode=story',
    ])
  })

  it('Domain-Root: homeHref `/` + sitePages mit `/?site=`-Links', () => {
    const result = buildTopNavConfig({
      isCreator: false,
      webViewEnabled: false,
      webViewTestHref: '',
      exploreContext: {
        slug: 'oldiesforfuture',
        siteEnabled: true,
        homeHref: '/',
        sitePages: [{ name: 'Kontakt', href: '/?site=kontakt' }],
      },
      t,
    })

    expect(result.publicNavItems.map((item) => item.href)).toEqual([
      '/',
      '/?site=kontakt',
      '/explore/oldiesforfuture?view=gallery',
      '/explore/oldiesforfuture?mode=story',
    ])
  })

  it('Explore-Kontext: Creator behalten Archiv + Wartekorb als geschuetzte Punkte', () => {
    const result = buildTopNavConfig({
      isCreator: true,
      webViewEnabled: true,
      webViewTestHref: '/explore/oldiesforfuture?view=site',
      exploreContext: { slug: 'oldiesforfuture', siteEnabled: true },
      t,
    })

    expect(result.primaryProtectedNavItems.map((item) => item.href)).toEqual([
      '/library',
      '/library/inbox',
    ])
  })
})
