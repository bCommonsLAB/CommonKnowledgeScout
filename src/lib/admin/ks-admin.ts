/**
 * @fileoverview Plattform-Admin aus der Umgebung (`KS_ADMIN_EMAIL`).
 *
 * @description
 * Rechte in KnowledgeScout gelten sonst je Library (Owner, Mitglieder).
 * Library-uebergreifende Einstellungen — heute die globale Modell-Liste —
 * darf nur aendern, wessen E-Mail in `KS_ADMIN_EMAIL` steht (mehrere mit
 * Komma getrennt). Die Variable gilt je Deployment: ein Server ohne sie hat
 * keinen Admin, obwohl er dieselbe Datenbank nutzen kann.
 *
 * Kein stiller Fallback: fehlt die Variable, ist niemand Admin, und die
 * Pruefung sagt das ausdruecklich (`konfiguriert: false`).
 *
 * @module admin
 */

import { normalizeEmail } from '@/lib/auth/user-email'

export interface AdminStatus {
  /** true, wenn `KS_ADMIN_EMAIL` mindestens eine Adresse enthaelt. */
  konfiguriert: boolean
  /** true, wenn die E-Mail in `KS_ADMIN_EMAIL` steht. */
  istAdmin: boolean
}

/** Liest die Admin-Adressen (normalisiert, ohne Leereintraege). */
export function leseAdminEmails(wert: string | undefined): string[] {
  if (typeof wert !== 'string') return []
  return wert
    .split(',')
    .map((eintrag) => normalizeEmail(eintrag))
    .filter((eintrag) => eintrag.length > 0)
}

/** Prueft eine E-Mail gegen `KS_ADMIN_EMAIL` (oder den uebergebenen Wert, fuer Tests). */
export function adminStatus(email: string, wert: string | undefined = process.env.KS_ADMIN_EMAIL): AdminStatus {
  const liste = leseAdminEmails(wert)
  const normalisiert = normalizeEmail(email)
  return {
    konfiguriert: liste.length > 0,
    istAdmin: normalisiert.length > 0 && liste.includes(normalisiert),
  }
}
