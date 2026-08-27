export {
  normalizeHost,
  getDomainLibraryMap,
  isLandingRedirectCandidate,
  resolveForeignExploreRedirect,
} from './domain-library-map'
export {
  DEFAULT_SITE_ID,
  FULL_APP_MODULES,
  DEFAULT_SITE_CONFIG,
  buildSiteRegistry,
  getSiteRegistry,
  resolveSiteConfigForHost,
} from './site-registry'
export type { SiteRegistry } from './site-registry'
