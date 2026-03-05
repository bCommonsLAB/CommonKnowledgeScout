/**
 * @fileoverview Zentrale URL-Auflösung für Secretary Service
 *
 * Relative URLs vom Secretary Service (z.B. /api/pdf/jobs/{id}/download-pages-archive)
 * müssen gegen die korrekte Base-URL aufgelöst werden. Im Desktop-Modus kommt die
 * Base-URL aus der Library-Config, im Standard-Modus aus den ENV-Variablen.
 *
 * @module external-jobs
 */

import { getSecretaryConfig } from '@/lib/env'

export interface SecretaryUrlConfig {
  /** Library-spezifische API-URL (überschreibt ENV) */
  overrideBaseUrl?: string
  /** Library-spezifischer API-Key (überschreibt ENV) */
  overrideApiKey?: string
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
