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
   * Explore-Kontext: gerade angezeigte Library auf `/explore/<slug>` ODER
   * auf der Domain-Root (`/` mit host-gemappter Root-Library, Variante B).
   * Wenn gesetzt, bildet die TopNav die Modi der Library dynamisch ab
   * (Inhalte | Story Mode; bei `siteEnabled` zusaetzlich Home = Website).
   * `homeHref` ueberschreibt das Home-Ziel (Domain-Root: `/` statt
   * `/explore/<slug>`). Gilt fuer anonyme UND eingeloggte Nutzer.
   * `sitePages` (C1b): dokumentgetriebene Website-Seiten (z. B. Kontakt),
   * direkt nach „Home" — ersetzt die zweite Menue-Leiste der Website.
   */
  exploreContext?: {
    slug: string
    siteEnabled: boolean
    homeHref?: string
    sitePages?: NavItem[]
  } | null
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
  exploreContext = null,
  t,
}: BuildTopNavConfigArgs): TopNavConfig {
  // Explore-Kontext: Die TopNav bildet die Modi der angezeigten Library
  // dynamisch ab — auch fuer anonyme Besucher. Bei Libraries MIT Website
  // (siteEnabled) ist „Home" die Website; die Website-Seiten (sitePages, C1b)
  // stehen ANS ENDE der Liste — untereinander dokumentgetrieben sortiert
  // (`menu_order`-Frontmatter, siehe useSiteMenuItems/selectMainMenuDocs).
  // OHNE Website fuehrt „Home" zurueck auf die KnowledgeScout-Startseite
  // (C1b: vorher gab es keinen Weg zurueck).
  // Creator behalten zusaetzlich ihre App-Navigation.
  if (exploreContext) {
    const base = `/explore/${encodeURIComponent(exploreContext.slug)}`
    const publicNavItems: NavItem[] = [
      ...(exploreContext.siteEnabled
        ? [{ name: t('navigation.home'), href: exploreContext.homeHref ?? base }]
        : [{ name: t('navigation.home'), href: '/' }]),
      {
        name: t('gallery.gallery'),
        href: exploreContext.siteEnabled ? `${base}?view=gallery` : base,
      },
      { name: t('gallery.story'), href: `${base}?mode=story` },
      ...(exploreContext.siteEnabled ? exploreContext.sitePages ?? [] : []),
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
