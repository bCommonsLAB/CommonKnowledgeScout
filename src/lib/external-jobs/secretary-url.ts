/**
 * @fileoverview Zentrale URL- und Konfig-Auflösung für Secretary Service
 *
 * Relative URLs vom Secretary Service (z.B. /api/pdf/jobs/{id}/download-pages-archive)
 * müssen gegen die korrekte Base-URL aufgelöst werden. Im Desktop-Modus kommt die
 * Base-URL aus der Library-Config, im Standard-Modus aus den ENV-Variablen.
 *
 * `resolveLibrarySecretaryConfig` ist die EINZIGE zulaessige Quelle fuer die
 * Auswertung von `library.config.secretaryService` in Bezug auf Verbindungsdaten.
 * Hintergrund: bisher gab es zwei parallele Logiken (POST in `start/route.ts`
 * mit `useCustomConfig`-Gate vs. Callback in `route.ts` ohne Gate). Folge war
 * ein "Konfig-Drift": POST ging an die ENV-URL (z.B. localhost), Downloads
 * dagegen an die Library-`apiUrl` -> 404 -> Bilder verloren. Diese Funktion
 * vermeidet diese Klasse von Bugs strukturell.
 *
 * @module external-jobs
 */

import type { Library } from '@/types/library'
import { getSecretaryConfig } from '@/lib/env'

export interface SecretaryUrlConfig {
  /** Library-spezifische API-URL (überschreibt ENV) */
  overrideBaseUrl?: string
  /** Library-spezifischer API-Key (überschreibt ENV) */
  overrideApiKey?: string
}

/** Vollstaendige Secretary-Config einer Library (gleiches Shape wie `Library.config.secretaryService`). */
export type LibrarySecretaryServiceConfig = NonNullable<NonNullable<Library['config']>['secretaryService']>

/**
 * Ergebnis von `resolveLibrarySecretaryConfig`.
 * - `effective` enthaelt die Transformations-Felder (template, llmModel, ...) wie bisher.
 *   Verbindungsfelder (`apiUrl`, `apiKey`) sind nur dann gesetzt, wenn `useCustomConfig=true`,
 *   sonst leer (Verhalten 1:1 wie bisher in `start/route.ts`).
 * - `override` ist genau der Bag, der an `prepareSecretaryRequest`/`resolveSecretaryUrl`/etc.
 *   weitergereicht werden soll. Er ist **nur** befuellt, wenn `useCustomConfig=true`
 *   UND eine echte `apiUrl` vorhanden ist. Sonst leer => Konsumenten fallen auf ENV.
 * - `source` ist ein Diagnose-Flag fuer Logs/Trace.
 */
export interface ResolvedLibrarySecretaryConfig {
  effective?: LibrarySecretaryServiceConfig
  override: SecretaryUrlConfig
  source: 'library-custom' | 'env'
}

/** Mindest-Shape, das die Resolver-Funktion akzeptiert (bewusst klein, damit Tests einfach bleiben). */
export interface LibraryLikeForSecretaryConfig {
  config?: {
    secretaryService?: LibrarySecretaryServiceConfig
  } | null
}

/**
 * EINZIGE zulaessige Quelle fuer die Auswertung von `library.config.secretaryService`
 * in Bezug auf Verbindungsdaten. Verhalten:
 *
 *  - `useCustomConfig === true` UND `apiUrl` gesetzt:
 *      - `effective` = vollstaendige Config (Transformations- + Verbindungsfelder)
 *      - `override` = `{ overrideBaseUrl: apiUrl, overrideApiKey: apiKey }`
 *      - `source` = 'library-custom'
 *  - sonst (insbesondere `useCustomConfig === false`):
 *      - `effective` = Config mit GELEERTEN Verbindungsfeldern (apiUrl='', apiKey='')
 *        damit nachgelagerter Code nicht versehentlich die "ruhenden" Werte verwendet.
 *      - `override` = `{}` (Konsumenten fallen auf `getSecretaryConfig()` aus ENV zurueck)
 *      - `source` = 'env'
 *
 * Fehlt `secretaryService` ganz, ist `effective` undefined und `override` leer.
 */
export function resolveLibrarySecretaryConfig(
  library: LibraryLikeForSecretaryConfig | null | undefined,
): ResolvedLibrarySecretaryConfig {
  const cfg = library?.config?.secretaryService
  if (!cfg) {
    return { override: {}, source: 'env' }
  }

  if (cfg.useCustomConfig === true && cfg.apiUrl && cfg.apiUrl.trim().length > 0) {
    return {
      effective: cfg,
      override: {
        overrideBaseUrl: cfg.apiUrl,
        overrideApiKey: cfg.apiKey || undefined,
      },
      source: 'library-custom',
    }
  }

  // useCustomConfig=false ODER apiUrl fehlt: Verbindungsfelder leeren,
  // Transformations-Felder (template, llmModel, ...) erhalten.
  // Auch `useDirectConnection` wird auf false zurueckgesetzt, weil dieser Schalter
  // laut Typ-Doku ausschliesslich mit aktiver Custom-Config gilt (siehe types/library.ts).
  return {
    effective: {
      ...cfg,
      apiUrl: '',
      apiKey: '',
      useDirectConnection: false,
    },
    override: {},
    source: 'env',
  }
}

/**
 * Löst eine relative Secretary-Service-URL gegen die korrekte Base-URL auf.
 *
 * Bereits absolute URLs (https://...) werden unverändert zurückgegeben.
 * Relative URLs werden mit der Base-URL kombiniert, wobei doppelte /api-Pfade
 * vermieden werden.
 */
export function resolveSecretaryUrl(
  relativeUrl: string,
  config?: SecretaryUrlConfig
): string {
  if (/^https?:\/\//i.test(relativeUrl)) return relativeUrl

  const envConfig = getSecretaryConfig()
  const baseRaw = config?.overrideBaseUrl || envConfig.baseUrl
  const base = baseRaw.replace(/\/$/, '')
  const rel = relativeUrl.startsWith('/') ? relativeUrl : `/${relativeUrl}`

  // Doppeltes /api vermeiden: wenn base auf /api endet und rel mit /api/ beginnt
  if (base.endsWith('/api') && rel.startsWith('/api/')) {
    return `${base}${rel.substring(4)}`
  }
  return `${base}${rel}`
}

/**
 * Gibt Auth-Headers für den Secretary Service zurück.
 * Verwendet den Override-API-Key falls vorhanden, sonst ENV.
 */
export function getSecretaryAuthHeaders(
  config?: SecretaryUrlConfig
): Record<string, string> {
  const envConfig = getSecretaryConfig()
  const apiKey = config?.overrideApiKey || envConfig.apiKey
  if (!apiKey) return {}
  return {
    'Authorization': `Bearer ${apiKey}`,
    'X-Secretary-Api-Key': apiKey,
  }
}
