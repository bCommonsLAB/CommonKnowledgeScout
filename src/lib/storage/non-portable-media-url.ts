/**
 * Erkennt absolute Medien-URLs, die nur auf der Entwicklungsmaschine erreichbar sind.
 *
 * Wenn solche URLs aus Mongo (`binaryFragments.url`) oder aus älteren Jobs stammen,
 * versucht die Produktions-UI sie zu laden → net::ERR_SSL_PROTOCOL_ERROR (HTTPS-App vs. localhost).
 *
 * Relative Pfade (`/api/storage/...`) sind gültig: Der Browser nutzt den aktuellen Host.
 */
export function isAbsoluteLoopbackMediaUrl(url: string): boolean {
  const t = url.trim()
  if (!t) return false
  if (t.startsWith('/')) return false
  try {
    const u = new URL(t)
    const h = u.hostname.toLowerCase()
    return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '[::1]'
  } catch {
    return false
  }
}
