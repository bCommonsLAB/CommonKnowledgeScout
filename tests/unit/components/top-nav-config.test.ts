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
    expect(result.primaryProtectedNavItems.map((item) => item.href)).toContain('/explore/test?view=site')
    expect(result.secondaryNavItems.map((item) => item.href)).toEqual([
      '/templates',
      '/event-monitor',
      '/session-manager',
    ])
    expect(result.showMoreMenu).toBe(true)
  })
})
