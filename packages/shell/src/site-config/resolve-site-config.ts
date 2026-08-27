/**
 * @ks/shell/site-config/resolve-site-config.ts
 *
 * Host->SiteConfig-Resolver: verallgemeinert `PUBLIC_DOMAIN_LIBRARY_MAP`
 * (bisher `getRootLandingTargetForHost()`/`domain-library-map.ts` in der
 * App) zu einer vollen SiteConfig. Edge-tauglich (keine DB-/Node-
 * Abhaengigkeiten) — nutzt nur `getDomainLibraryMap()`/`normalizeHost()`.
 *
 * Ohne Host-Treffer: `DEFAULT_SITE_CONFIG` (die Voll-App, user-selected
 * Library, App-Menue). Mit Treffer: die shell-freie Domain-Root-Ansicht
 * einer einzelnen Library — spiegelt das heutige Verhalten von
 * `AppLayout`/`ConditionalFooter` fuer gemappte Domains (Variante B).
 *
 * G4: reiner Lese-/Beweis-Code in M3 — ersetzt noch NICHT
 * `getRootLandingTargetForHost()` in `layout.tsx` (siehe AGENT-BRIEF-M3.md,
 * Stop-Bedingungen).
 */
import type { SiteConfig } from '@ks/contracts'
import { DEFAULT_SITE_CONFIG } from './registry'
import { getDomainLibraryMap, normalizeHost } from './domain-library-map'

export function resolveSiteConfig(host: string | null): SiteConfig {
  if (!host) return DEFAULT_SITE_CONFIG
  const normalized = normalizeHost(host)
  const slug = getDomainLibraryMap()[normalized]
  if (!slug) return DEFAULT_SITE_CONFIG

  return {
    modules: ['explorer'],
    libraries: { primary: { slug } },
    chrome: { topNav: 'none', footer: 'site' },
    auth: { mode: 'clerk', optional: true },
    api: { mode: 'local' },
    domains: [normalized],
  }
}
