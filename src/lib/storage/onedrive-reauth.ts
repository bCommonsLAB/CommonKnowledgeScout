/**
 * OneDrive-Re-Auth — app-weit wiederverwendbarer Anmelde-Schritt
 * (Welle 3-IV-UX-3c, F2). Seit Teil A des Plans
 * speicher-verbindungen-und-library-anlage laeuft die Anmeldung an der
 * Speicher-Verbindung der Library: die Konto-Route liefert die Microsoft-URL,
 * der Callback legt die Tokens an der Verbindung ab und kehrt an den
 * Rueckweg zurueck; der Browser holt sich die Tokens dann von der Verbindung.
 */

import { StorageFactory } from "@/lib/storage/storage-factory"
import { resolveOneDriveTokenScope } from "@/lib/storage/onedrive/browser-token-key"
import type { ClientLibrary } from "@/types/library"

/** Startet den OAuth-Flow an der Verbindung der Library; kehrt danach zur aktuellen Seite zurueck. */
export async function startOneDriveReauth(library: ClientLibrary): Promise<void> {
  const connectionId = resolveOneDriveTokenScope(library)
  const redirect = `${window.location.pathname}${window.location.search}`
  const response = await fetch(
    `/api/account/storage-connections/${connectionId}/onedrive-login?redirect=${encodeURIComponent(redirect)}`,
  )
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `Anmelde-URL konnte nicht geladen werden (HTTP ${response.status})`)
  }
  const { url } = (await response.json()) as { url: string }
  window.location.href = url
}

/**
 * Verarbeitet die Rueckkehr (?onedrive=ok): Provider neu bauen und die Tokens
 * der Verbindung in den Browser holen. Gibt true zurueck, wenn Tokens da sind.
 */
export async function processOneDriveAuthReturn(libraryId: string): Promise<boolean> {
  const factory = StorageFactory.getInstance()
  await factory.clearProvider(libraryId)
  const provider = await factory.getProvider(libraryId)
  const ensure = (provider as unknown as { ensureBrowserTokens?: () => Promise<boolean> }).ensureBrowserTokens
  if (typeof ensure !== "function") return false
  return ensure.call(provider)
}
