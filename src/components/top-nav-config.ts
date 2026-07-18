export interface NavItem {
  name: string
  href: string
  newTab?: boolean
}

interface BuildTopNavConfigArgs {
  isCreator: boolean
  webViewEnabled: boolean
  webViewTestHref: string
  /**
   * Site-Kontext: Slug der gerade angezeigten Explore-Library mit aktivierter
   * Website (`siteEnabled`). Wenn gesetzt, uebernimmt die TopNav die Modi-
   * Navigation der Website (Home | Inhalte | Story Mode) — die zweite
   * Tab-Ebene in der Galerie entfaellt dann (Redundanz).
   */
  siteExploreSlug?: string | null
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
  siteExploreSlug = null,
  t,
}: BuildTopNavConfigArgs): TopNavConfig {
  // Site-Kontext (Explore-Ansicht einer Library mit eigener Website):
  // Die TopNav bildet die Website-Modi ab — Home (Website), Inhalte (Galerie),
  // Story Mode. Anonyme Besucher sehen NUR diese Punkte (kein KS-Home);
  // Creator behalten zusaetzlich ihre App-Navigation (unten).
  if (siteExploreSlug) {
    const base = `/explore/${encodeURIComponent(siteExploreSlug)}`
    const publicNavItems: NavItem[] = [
      { name: t('navigation.home'), href: base },
      { name: t('gallery.gallery'), href: `${base}?view=gallery` },
      { name: t('gallery.story'), href: `${base}?mode=story` },
    ]
    return {
      publicNavItems,
      primaryProtectedNavItems: isCreator ? [
        { name: t('navigation.library'), href: '/library' },
        { name: 'Wartekorb', href: '/library/inbox' },
      ] : [],
      secondaryNavItems: [],
      showMoreMenu: false,
    }
  }

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
    {
      name: 'Wartekorb',
      href: '/library/inbox',
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
