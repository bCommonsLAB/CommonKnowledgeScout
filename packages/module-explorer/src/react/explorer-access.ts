/**
 * Zugriffsprotokoll des Explorers — ohne React, damit pruefbar.
 *
 * Warum eigenes `fetch` statt `@ks/api-client`: `apiGet` wirft bei jedem
 * Nicht-OK-Response (bewusst, siehe `no-silent-fallbacks.md`). Dieses
 * Protokoll BRAUCHT aber die Status-Codes — 429 heisst „zu viele Anfragen",
 * und die Antwort traegt eine eigene Meldung. Ein geworfener Fehler
 * verschluckt genau diese Unterscheidung.
 */

import type { ExplorerAccessStatus } from './types'

/**
 * Fragt, ob der Betrachter die Library sehen darf.
 *
 * Gibt den Ablehnungsgrund als Ergebnis zurueck statt zu werfen — die
 * Ablehnung IST hier die Antwort, kein Fehlerfall. Nur ein Netzwerkabbruch
 * ist einer, und auch der wird benannt statt verschluckt.
 */
export async function fetchAccessStatus(libraryId: string): Promise<ExplorerAccessStatus> {
  try {
    const response = await fetch(`/api/libraries/${libraryId}/access-check`, {
      cache: 'no-store',
    })

    if (response.ok) {
      return await response.json()
    }

    const errorData = await response.json().catch(() => ({}))

    if (response.status === 429) {
      return {
        hasAccess: false,
        requiresAuth: true,
        message: errorData.message || 'Zu viele Anfragen. Bitte warten Sie einen Moment.',
        rateLimited: true,
      }
    }

    return {
      hasAccess: false,
      requiresAuth: true,
      message: errorData.error || 'Fehler beim Prüfen des Zugriffs',
    }
  } catch (err) {
    console.error('[ExplorerRoot] Fehler beim Prüfen des Zugriffs:', err)
    return {
      hasAccess: false,
      requiresAuth: true,
      message: 'Fehler beim Prüfen des Zugriffs',
    }
  }
}

/**
 * Stellt eine Zugriffsanfrage. Wirft bei Misserfolg — anders als oben ist das
 * hier ein echter Fehlschlag einer Nutzeraktion und gehoert dem Aufrufer
 * gemeldet.
 */
export async function postAccessRequest(libraryId: string): Promise<ExplorerAccessStatus> {
  const response = await fetch(`/api/libraries/${libraryId}/access-request`, {
    method: 'POST',
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || 'Fehler beim Erstellen der Zugriffsanfrage')
  }

  return {
    hasAccess: false,
    status: 'pending',
    requiresAuth: true,
    message: 'Ihre Anfrage wurde erfolgreich erstellt und wird bearbeitet',
  }
}
