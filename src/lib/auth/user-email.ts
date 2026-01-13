/**
 * @fileoverview User email helpers (Clerk + normalization)
 *
 * Hintergrund:
 * - In mehreren Flows wird der User über seine E-Mail-Adresse identifiziert (MongoDB-Key).
 * - E-Mails sind praktisch case-insensitive, Mongo-Queries hier aber standardmäßig case-sensitiv.
 * - Clerk liefert teils mehrere Email-Adressen; `emailAddresses[0]` ist nicht garantiert die primäre.
 *
 * Ziel:
 * - Eine kleine, testbare Stelle, die "beste" E-Mail auswählt und normalisiert.
 * - Optional: Helpers für case-insensitive MongoDB-Queries.
 */

export type ClerkUserLike = {
  primaryEmailAddress?: { emailAddress?: string | null } | null
  emailAddresses?: Array<{ emailAddress?: string | null }> | null
} | null | undefined

/**
 * Normalisiert eine E-Mail für Storage-/DB-Schlüssel:
 * - trim
 * - lower-case
 *
 * Wichtig:
 * - Wir behalten hier bewusst NICHT die Originalschreibweise, damit Vergleiche robust sind.
 */
export function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase()
}

/**
 * Wählt die "beste" E-Mail aus einem Clerk-User-Objekt:
 * - bevorzugt `primaryEmailAddress`
 * - sonst erstes Element aus `emailAddresses`
 * - sonst leerer String
 *
 * Rückgabe ist immer normalisiert (siehe `normalizeEmail`).
 */
export function getPreferredUserEmail(user: ClerkUserLike): string {
  const primary = user?.primaryEmailAddress?.emailAddress
  if (typeof primary === 'string' && primary.trim()) return normalizeEmail(primary)

  const first = user?.emailAddresses?.[0]?.emailAddress
  if (typeof first === 'string' && first.trim()) return normalizeEmail(first)

  return ''
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Case-insensitive, exakt matchender Regex für MongoDB (anchored).
 *
 * Hinweis:
 * - Das ist ein Fallback für alte Datensätze mit abweichender Groß-/Kleinschreibung.
 * - Langfristig sollten wir E-Mails beim Schreiben konsequent normalisieren.
 */
export function buildCaseInsensitiveEmailRegex(email: string): RegExp {
  const normalized = normalizeEmail(email)
  return new RegExp(`^${escapeRegExp(normalized)}$`, 'i')
}

