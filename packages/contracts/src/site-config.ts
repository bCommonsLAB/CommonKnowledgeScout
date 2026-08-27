/**
 * @ks/contracts/site-config.ts
 *
 * SiteConfig ist Laufzeit-KONFIGURATION pro Site (Host) — kein Build-Artefakt
 * (ADR 0008 §1). Schema 1:1 aus `docs/architecture/modul-landkarte.md` §2.
 * Welle M3 fuehrt das Interface + einen ersten Resolver ein (`@ks/shell`);
 * die Voll-App ist die Default-Site der Registry (unveraendertes Verhalten,
 * G4 — siehe AGENT-BRIEF-M3.md).
 *
 * Abgrenzung zur Library-Config (MongoDB, `src/types/library.ts`): jene
 * beschreibt EINE Library (Facetten, Galerie-Texte, Profile) und bleibt die
 * Quelle fuer Inhalts-Verhalten. SiteConfig beschreibt EINE Site (Module,
 * Library-Bindung, Chrome, Auth).
 */

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

export type FederatedLibraryRole = 'question-bridge' | 'content-bridge' | 'capture-target'

export interface SiteConfig {
  /** Aktive Module — bestimmt geladene Client-Chunks UND freigeschaltete API-Handler. */
  modules: SiteModule[]
  /** Library-Bindung: Primär-Library + optional föderierte Libraries (ADR 0009). */
  libraries: {
    primary: { slug: string } | { mode: 'user-selected' }
    federated?: Array<{
      slug: string
      role: FederatedLibraryRole
    }>
  }
  /** Schale: App-Menü, Library-Menü oder gar keins (vorkonfigurierte Site). */
  chrome: { topNav: 'app-menu' | 'library-menu' | 'none'; footer?: 'site' | 'none' }
  /** Auth: öffentlich, Clerk optional (Login schaltet Profil/Pflege frei) oder Pflicht. */
  auth: { mode: 'public' } | { mode: 'clerk'; optional?: boolean }
  /** Datenzugang (ADR 0008 §3): local = diese Instanz; remote nur für embed/electron-Hüllen. */
  api?: { mode: 'local' } | { mode: 'remote'; baseUrl: string }
  /** PWA-Flag: Manifest + Service Worker für diese Site. */
  pwa?: boolean
  /** Hosts, die auf diese Site auflösen (ersetzt PUBLIC_DOMAIN_LIBRARY_MAP). */
  domains?: string[]
}
