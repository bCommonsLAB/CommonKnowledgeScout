/**
 * `@ks/shell` — App-Schale (Modul-Landkarte §1, Schicht 2).
 *
 * Dieses Barrel ist bewusst FREI von React: Die Middleware (Edge-Runtime) liest
 * hier die Host-/Site-Aufloesung. Die Provider-Kette liegt unter dem Subpfad
 * `@ks/shell/providers`, damit sie nicht in den Edge-Bundle gezogen wird.
 */

export * from './site'
export { siteGate, getRequestHost, isModuleActiveForHost } from './api/site-gate'
export type { SiteGateRequest } from './api/site-gate'
export { buildTopNavConfig } from './nav/top-nav-config'
export type { NavItem } from './nav/top-nav-config'
