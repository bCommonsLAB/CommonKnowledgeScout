/**
 * @fileoverview Environment Variables and Configuration Helpers
 * 
 * @description
 * Centralized, typed environment variable helpers for server-side code.
 * Provides unified normalization of URLs and secrets to keep call sites clean.
 * Handles configuration for public app URLs, internal server URLs, Secretary Service,
 * and Vimeo API access.
 * 
 * @module core
 * 
 * @exports
 * - getPublicAppUrl(): Returns public base URL of the application
 * - getSelfBaseUrl(): Returns internal base URL for server-to-server requests
 * - getSecretaryConfig(): Returns Secretary Service configuration
 * - getVimeoConfig(): Returns Vimeo API configuration
 * 
 * @usedIn
 * - src/app/api: API routes use these helpers for configuration
 * - src/lib/secretary/client.ts: Uses Secretary configuration
 * - src/lib/external-jobs: External jobs use URL helpers
 * 
 * @dependencies
 * - process.env: Node.js environment variables
 */

interface SecretaryConfig {
  baseUrl: string
  apiKey: string | undefined
}

function normalizeBaseUrl(url: string | undefined): string {
  const raw = (url || '').trim()
  if (!raw) return ''
  return raw.replace(/\/$/, '')
}

/**
 * Öffentliche Basis-URL der App (für externe Callbacks).
 * Bevorzugt NEXT_PUBLIC_APP_URL, fällt andernfalls auf localhost:PORT zurück.
 */
export function getPublicAppUrl(): string {
  const explicit = normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL)
  if (explicit) return explicit
  const port = String(process.env.PORT || '3000')
  return `http://localhost:${port}`
}

/**
 * Interne Basis-URL des eigenen Servers (für Server→Server-Requests gegen eigene Endpoints).
 * Reihenfolge: INTERNAL_SELF_BASE_URL → NEXT_PUBLIC_APP_URL → 127.0.0.1:PORT
 */
export function getSelfBaseUrl(): string {
  const internal = normalizeBaseUrl(process.env.INTERNAL_SELF_BASE_URL)
  if (internal) return internal
  const publicBase = normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL)
  if (publicBase) return publicBase
  const port = String(process.env.PORT || '3000')
  return `http://127.0.0.1:${port}`
}

/**
 * Konfiguration für den Secretary-Service (Worker/Transformer/Extractor).
 * Gibt eine normalisierte Base-URL und das API-Key-Secret (falls gesetzt) zurück.
 */
export function getSecretaryConfig(): SecretaryConfig {
  const base = normalizeBaseUrl(process.env.SECRETARY_SERVICE_URL)
  const baseUrl = base || ''
  const apiKey = process.env.SECRETARY_SERVICE_API_KEY || undefined
  return { baseUrl, apiKey }
}


/**
 * Vimeo API Zugriff (optional). Wenn gesetzt, kann die Server-Route
 * Medien-URLs über die offizielle API auflösen (um Player/CORS/403 zu umgehen).
 */
export function getVimeoConfig(): { accessToken?: string } {
  const accessToken = process.env.VIMEO_ACCESS_TOKEN || undefined
  return { accessToken }
}


