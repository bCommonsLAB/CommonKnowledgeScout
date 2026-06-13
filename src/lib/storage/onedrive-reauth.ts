/**
 * OneDrive-Re-Auth — app-weit wiederverwendbarer Anmelde-Schritt
 * (Welle 3-IV-UX-3c, F2).
 *
 * Extrahiert den Kern des Anmelde-Flows aus den Storage-Settings:
 * - startOneDriveReauth: OAuth-Redirect mit Ruecksprung zur aktuellen
 *   Seite (state.redirect) — nutzbar von ueberall in der App.
 * - processOneDriveAuthReturn: holt nach der Rueckkehr die temporaer
 *   gespeicherten Tokens ab und legt sie in localStorage ab.
 *
 * Hinweis: use-storage-form.ts behaelt seinen eigenen Auth-Start
 * (zusaetzliche Formular-Logik: Dirty-Save, Credential-Pruefung).
 */

import { StorageFactory } from "@/lib/storage/storage-factory"

/** Startet den OAuth-Flow; kehrt danach zur aktuellen URL zurueck. */
export async function startOneDriveReauth(libraryId: string): Promise<void> {
  const response = await fetch(`/api/libraries/${libraryId}`)
  if (!response.ok) {
    throw new Error(`Bibliothek konnte nicht geladen werden: ${response.statusText}`)
  }
  const library = await response.json()

  const provider = StorageFactory.getInstance().createOneDriveProviderForAuth(library)
  const authUrlString = await provider.getAuthUrl()

  const stateObj = { libraryId, redirect: window.location.href }
  const urlWithState = new URL(authUrlString)
  urlWithState.searchParams.set("state", JSON.stringify(stateObj))

  window.location.href = urlWithState.toString()
}

/**
 * Verarbeitet die OAuth-Rueckkehr (?authSuccess=true&libraryId=...):
 * Tokens vom Server abholen, in localStorage ablegen, Provider-Cache
 * leeren. Gibt true zurueck, wenn Tokens uebernommen wurden.
 */
export async function processOneDriveAuthReturn(libraryId: string): Promise<boolean> {
  const tokenResponse = await fetch(`/api/libraries/${libraryId}/tokens`, { method: "POST" })
  if (!tokenResponse.ok) {
    throw new Error(`Tokens konnten nicht abgeholt werden: ${tokenResponse.statusText}`)
  }
  const tokenData = await tokenResponse.json()
  if (!tokenData.success || !tokenData.tokens) return false

  const localStorageKey = `onedrive_tokens_${libraryId}`
  localStorage.setItem(
    localStorageKey,
    JSON.stringify({
      accessToken: tokenData.tokens.accessToken,
      refreshToken: tokenData.tokens.refreshToken,
      expiry: parseInt(tokenData.tokens.tokenExpiry, 10),
    })
  )

  try {
    await StorageFactory.getInstance().clearProvider(libraryId)
  } catch (error) {
    console.error("[OneDriveReauth] Provider-Cache konnte nicht geleert werden:", error)
  }

  return true
}
