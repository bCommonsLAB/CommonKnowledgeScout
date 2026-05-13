/**
 * @fileoverview User-Display-Name-Helper (Clerk-kapseln)
 *
 * Hintergrund:
 * - Sterne-Voter sollen ihren Anzeigenamen zur Schreibzeit eingefroren
 *   bekommen, damit der Read-Pfad (Tooltip in der Galerie) den
 *   Auth-Provider nicht mehr fragen muss.
 * - Diese Datei kapselt den Provider-Zugriff: alles, was Clerk-spezifisch
 *   ist, geschieht in `getPreferredUserDisplayName`. Spaetere
 *   Provider-Wechsel beruehren nur diese Funktion.
 *
 * Reihenfolge der Quellen:
 * 1. `firstName + lastName` (vollstaendiger Name, wenn beides gesetzt)
 * 2. `firstName` allein
 * 3. `lastName` allein
 * 4. `username`
 * 5. E-Mail-Prefix (vor `@`)
 * 6. Leerer String, wenn nichts vorhanden
 */

import { getPreferredUserEmail, type ClerkUserLike as EmailClerkUserLike } from './user-email'

/**
 * Erweiterte Clerk-User-Form, die zusaetzlich Name-Felder mitbringt.
 * Bewusst minimal gehalten - so kann der Helper auch in Tests mit
 * einfachen Objekt-Stubs verwendet werden.
 */
export type ClerkUserWithName = EmailClerkUserLike & {
  firstName?: string | null
  lastName?: string | null
  username?: string | null
}

function trimOrEmpty(value: string | null | undefined): string {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function emailPrefix(email: string): string {
  if (!email) return ''
  const at = email.indexOf('@')
  if (at <= 0) return email
  return email.slice(0, at)
}

/**
 * Liefert den bevorzugten Anzeigenamen fuer einen Clerk-User.
 *
 * Niemals leer, solange irgendeine Quelle vorhanden ist - im
 * absoluten Notfall wird der E-Mail-Prefix verwendet. Wenn auch
 * keine E-Mail vorhanden ist, kommt ein leerer String zurueck (das
 * passiert nur fuer Stub-User in Tests).
 */
export function getPreferredUserDisplayName(user: ClerkUserWithName): string {
  if (!user) return ''
  const first = trimOrEmpty(user.firstName)
  const last = trimOrEmpty(user.lastName)

  if (first && last) return `${first} ${last}`
  if (first) return first
  if (last) return last

  const username = trimOrEmpty(user.username)
  if (username) return username

  const email = getPreferredUserEmail(user)
  return emailPrefix(email)
}
