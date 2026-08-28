/**
 * `@ks/i18n` — Locale-Ermittlung und Uebersetzungen (Modul-Landkarte §1).
 *
 * Dieses Barrel ist bewusst FREI von React und Jotai: Middleware (Edge-Runtime),
 * API-Routen und `layout.tsx` lesen hier — 13 serverseitige Aufrufer. Die Hooks
 * und der Locale-Provider liegen unter `@ks/i18n/react`.
 *
 * Der Schnitt ist keine Stilfrage: `jotai/react` ruft beim Laden
 * `createContext` auf. Laege der Hook hier, zoege jede Server-Datei ihn in den
 * react-server-Layer — genau der Build-Fehler aus Welle M4b, nur mit Jotai
 * statt Radix (siehe Landkarte §4, Client-Grenze).
 */

export {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  getLocale,
  getTranslations,
  t,
} from './core'
export type { Locale } from './core'
export type { TranslationKeys, TranslationKey, TranslationParams } from './types'
