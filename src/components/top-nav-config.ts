export interface NavItem {
  name: string
  href: string
  newTab?: boolean
}

interface BuildTopNavConfigArgs {
  isCreator: boolean
  webViewEnabled: boolean
  webViewTestHref: string
  t: (key: string) => string
}

interface TopNavConfig {
  publicNavItems: NavItem[]
  primaryProtectedNavItems: NavItem[]
  secondaryNavItems: NavItem[]
  showMoreMenu: boolean
}

/**
 * Hält die sichtbare Top-Navigation als reine Funktion.
 * So können wir das Verhalten für anonyme und Creator-Nutzer gezielt testen.
 */
export function buildTopNavConfig({
  isCreator,
  webViewEnabled,
  webViewTestHref,
  t,
}: BuildTopNavConfigArgs): TopNavConfig {
  const publicNavItems: NavItem[] = [
    {
      name: t('navigation.home'),
      href: '/',
    },
    ...(isCreator ? [{
      name: t('navigation.docs'),
      href: '/docs/',
    }] : []),
  ]

  const primaryProtectedNavItems: NavItem[] = isCreator ? [
    {
      name: t('navigation.library'),
      href: '/library',
    },
    {
      name: t('navigation.gallery'),
      href: '/library/gallery',
    },
    ...(webViewEnabled && webViewTestHref ? [{
      name: t('navigation.webView'),
      href: webViewTestHref,
      newTab: true,
    }] : []),
    {
      name: 'Story',
      href: '/library/gallery?mode=story',
    },
  ] : []

  const secondaryNavItems: NavItem[] = isCreator ? [
    {
      name: t('navigation.templates'),
      href: '/templates',
    },
    {
      name: t('navigation.eventMonitor'),
      href: '/event-monitor',
    },
    {
      name: t('navigation.sessionManager'),
      href: '/session-manager',
    },
  ] : []

  return {
    publicNavItems,
    primaryProtectedNavItems,
    secondaryNavItems,
    showMoreMenu: isCreator,
  }
}
