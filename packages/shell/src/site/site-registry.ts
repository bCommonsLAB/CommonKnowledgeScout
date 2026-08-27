/**
 * Host→SiteConfig-Resolver (Welle M3, Modul-Landkarte §2 / ADR 0008).
 *
 * Verallgemeinert die bisherige Domain→Slug-Zuordnung (`PUBLIC_DOMAIN_LIBRARY_MAP`,
 * Variante B) zu einer Site-Registry: Jeder gemappte Host wird zu einer Site mit
 * fest gebundener Primaer-Library; jeder andere Host faellt auf die Default-Site
 * — die heutige Voll-App (Nutzer waehlt die Library selbst).
 *
 * VERHALTENSNEUTRAL (Migrationsstrategie G4): Die Registry beschreibt exakt den
 * heutigen Zustand. Sie ist reine Ableitung aus derselben ENV-Quelle, aus der
 * bisher `getDomainLibraryMap()` gelesen wurde — kein zweiter Konfigurationsweg,
 * keine neuen Hosts, keine geaenderte Aufloesungs-Reihenfolge.
 *
 * Ablage-Entscheidung (offene Frage der Landkarte §6): Startpunkt bleibt die
 * bestehende ENV-Zuordnung, nicht eine neue MongoDB-Collection. Grund: Die
 * ENV-Variable existiert, ist auditierbar und deployment-nah; eine
 * DB-gestuetzte Registry braucht ein Settings-UI und eine Migration und waere
 * damit eine Verhaltensaenderung statt einer Extraktion.
 */

import type { SiteConfig, SiteModule } from '@ks/contracts'
import { getDomainLibraryMap, normalizeHost } from './domain-library-map'

/** Kennung der Default-Site (Voll-App). */
export const DEFAULT_SITE_ID = 'default'

/**
 * Module, die die heutige Voll-App ausliefert. `import` und `workbench` fehlen
 * bewusst: Das sind Modul-KANDIDATEN aus den Steckbriefen (Landkarte §1), sie
 * existieren im Code noch nicht. Sie hier aufzufuehren wuerde eine Faehigkeit
 * behaupten, die es nicht gibt.
 */
export const FULL_APP_MODULES: readonly SiteModule[] = [
  'explorer',
  'archive',
  'agent-view',
  'creation',
  'templates',
  'jobs',
  'settings',
]

/**
 * Die Voll-App als Default-Site der Registry (Landkarte §2).
 * Greift fuer jeden Host, der nicht ausdruecklich gemappt ist — also fuer
 * `knowledgescout.org`, lokale Entwicklung und jeden unbekannten Host.
 */
export const DEFAULT_SITE_CONFIG: SiteConfig = {
  id: DEFAULT_SITE_ID,
  modules: [...FULL_APP_MODULES],
  libraries: { primary: { mode: 'user-selected' } },
  chrome: { topNav: 'app-menu' },
  // Heutiges Verhalten: Clerk ist eingebunden, oeffentliche Seiten
  // (`/explore/*`) sind aber auch anonym erreichbar.
  auth: { mode: 'clerk', optional: true },
  api: { mode: 'local' },
}

/** Host→SiteConfig-Registry: Default-Site plus die host-gebundenen Sites. */
export interface SiteRegistry {
  defaultSite: SiteConfig
  byHost: Record<string, SiteConfig>
}

/**
 * Baut die Registry aus einer Domain→Slug-Zuordnung.
 *
 * Reine Funktion (die Zuordnung wird uebergeben), damit sie ohne ENV testbar
 * bleibt — dasselbe Muster wie `resolveForeignExploreRedirect`.
 *
 * Modul-Umfang der host-gebundenen Sites: bewusst identisch zur Voll-App. Heute
 * liefert eine gemappte Domain dieselbe Anwendung aus; nur `/` zeigt die
 * Landingpage ihrer Library. Ein schlankerer Modul-Satz waere eine
 * Verhaltensaenderung und gehoert nach Welle M6.
 */
export function buildSiteRegistry(domainMap: Record<string, string>): SiteRegistry {
  const byHost: Record<string, SiteConfig> = {}
  for (const [domain, slug] of Object.entries(domainMap)) {
    const host = normalizeHost(domain)
    byHost[host] = {
      id: `domain:${host}`,
      modules: [...FULL_APP_MODULES],
      libraries: { primary: { slug } },
      // Eigene Domain: Navigation der Library, eigene Fusszeile — genau das,
      // was `AppLayout`/`ConditionalFooter` auf der Domain-Root heute tun.
      chrome: { topNav: 'library-menu', footer: 'site' },
      auth: { mode: 'clerk', optional: true },
      api: { mode: 'local' },
      domains: [host],
    }
  }
  return { defaultSite: DEFAULT_SITE_CONFIG, byHost }
}

/** Registry aus der Laufzeit-Umgebung (`PUBLIC_DOMAIN_LIBRARY_MAP`). */
export function getSiteRegistry(): SiteRegistry {
  return buildSiteRegistry(getDomainLibraryMap())
}

/**
 * Loest einen Host gegen die Registry auf. Unbekannter oder fehlender Host
 * ⇒ Default-Site (die Voll-App). Das ist kein stiller Fallback, sondern der
 * definierte Registry-Eintrag fuer „nicht gesondert konfiguriert".
 */
export function resolveSiteConfigForHost(
  host: string | null | undefined,
  registry: SiteRegistry = getSiteRegistry(),
): SiteConfig {
  if (!host) return registry.defaultSite
  const normalized = normalizeHost(host)
  if (!normalized) return registry.defaultSite
  return registry.byHost[normalized] ?? registry.defaultSite
}
