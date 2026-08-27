/**
 * @ks/shell/site-config/registry.ts
 *
 * Registry-Ablage: Datei (Startpunkt laut `modul-landkarte.md` §2 — auditier-
 * bar, kein Migrationsaufwand; MongoDB-Ablage bleibt spaetere Option, siehe
 * AGENT-BRIEF-M3.md "offene Frage 3").
 *
 * `DEFAULT_SITE_CONFIG` beschreibt die Voll-App: alle Module, Library
 * user-selected (kein Domain-Zwang), App-Menue, Clerk optional (heutiges
 * Verhalten — anonymer Zugriff moeglich, Login schaltet Profil/Pflege frei).
 */
import type { SiteConfig } from '@ks/contracts'

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  modules: [
    'explorer',
    'archive',
    'agent-view',
    'creation',
    'templates',
    'jobs',
    'settings',
    'import',
    'workbench',
  ],
  libraries: { primary: { mode: 'user-selected' } },
  chrome: { topNav: 'app-menu' },
  auth: { mode: 'clerk', optional: true },
  api: { mode: 'local' },
}
