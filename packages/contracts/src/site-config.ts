/**
 * SiteConfig — Laufzeit-Konfiguration EINER Site (Host).
 *
 * Zielbild: Modul-Landkarte §2 + ADR 0008 („ein Deployment, viele Sites"):
 * Sites sind DATEN, keine Build-Artefakte. Die eine Instanz loest pro Request
 * den Host gegen eine Registry auf; die Voll-App ist deren Default-Site.
 *
 * Abgrenzung zur Library-Config (`src/types/library.ts`, MongoDB): Die
 * Library-Config beschreibt EINE Library (Facetten, detailViewType, Galerie-
 * Texte) und gilt auf jeder Site gleich. Die SiteConfig beschreibt EINE Site
 * (Module, Library-Bindung, Chrome, Auth).
 *
 * Stand Welle M3: Der Resolver (`@ks/shell`) liefert diese Struktur, aber nur
 * `libraries.primary` wird bereits ausgewertet (Root-Landingpage). Die uebrigen
 * Felder sind der verbindlich deklarierte Vertrag fuer M4 (Modul-Gate) und M6
 * (erste eigenstaendige Site) — sie werden bewusst noch von niemandem gelesen,
 * damit Welle M3 verhaltensneutral bleibt (Migrationsstrategie G4).
 */

/** Aktivierbare Module — bestimmt Client-Chunks UND freigeschaltete API-Handler. */
export type SiteModule =
  | 'explorer'
  | 'archive'
  | 'agent-view'
  | 'creation'
  | 'templates'
  | 'jobs'
  | 'settings'
  | 'import'
  | 'workbench'

/** Primaer-Library fest an die Site gebunden (z.B. eigene Domain). */
export interface SitePrimaryLibraryBySlug {
  slug: string
}

/** Nutzer waehlt die aktive Library selbst (Verhalten der Voll-App). */
export interface SitePrimaryLibraryUserSelected {
  mode: 'user-selected'
}

export type SitePrimaryLibrary = SitePrimaryLibraryBySlug | SitePrimaryLibraryUserSelected

/** Rolle einer zusaetzlich eingebundenen Library (Foederation, ADR 0009). */
export type SiteFederatedLibraryRole = 'question-bridge' | 'content-bridge' | 'capture-target'

export interface SiteFederatedLibrary {
  slug: string
  role: SiteFederatedLibraryRole
}

export interface SiteChrome {
  topNav: 'app-menu' | 'library-menu' | 'none'
  footer?: 'site' | 'none'
}

export type SiteAuth = { mode: 'public' } | { mode: 'clerk'; optional?: boolean }

/** Datenzugang (ADR 0008 §3): `local` = diese Instanz; `remote` nur fuer Embed-/Electron-Huellen. */
export type SiteApi = { mode: 'local' } | { mode: 'remote'; baseUrl: string }

export interface SiteConfig {
  /**
   * Stabile Kennung der Site. Nicht im urspruenglichen Zielbild-Entwurf
   * (Landkarte §2) enthalten, aber noetig, damit Registry-Eintraege in Logs
   * und Fehlermeldungen benennbar sind — ohne sie waere „welche Site war das?"
   * nur ueber den Host rekonstruierbar.
   */
  id: string
  modules: SiteModule[]
  libraries: {
    primary: SitePrimaryLibrary
    federated?: SiteFederatedLibrary[]
  }
  chrome: SiteChrome
  auth: SiteAuth
  api?: SiteApi
  /** PWA-Flag: Manifest + Service Worker fuer diese Site. */
  pwa?: boolean
  /** Hosts, die auf diese Site aufloesen (verallgemeinert `PUBLIC_DOMAIN_LIBRARY_MAP`). */
  domains?: string[]
}

/**
 * Type-Guard: Ist die Primaer-Library fest an die Site gebunden?
 * Ohne den Guard muesste jeder Aufrufer auf `'slug' in primary` pruefen —
 * das ist genau die Stelle, an der still auf einen Default gefallen wuerde.
 */
export function isSitePrimaryBySlug(primary: SitePrimaryLibrary): primary is SitePrimaryLibraryBySlug {
  return 'slug' in primary
}
