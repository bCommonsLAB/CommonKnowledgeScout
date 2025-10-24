/**
 * Zentrale, typisierte Env-/Konfig-Helfer für Servercode.
 * Einheitliche Normalisierung von URLs und Secrets, damit Call-Sites schlank bleiben.
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


