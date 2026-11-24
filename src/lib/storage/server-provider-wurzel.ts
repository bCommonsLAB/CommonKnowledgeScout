/**
 * @fileoverview Server-Provider an der WURZEL der Speicher-Verbindung einer Library.
 *
 * @description
 * `getServerProvider` verankert den Provider im Verzeichnis der Library
 * (`library.path`). Fehlt dieses Verzeichnis auf dem Speicher noch, kann
 * niemand es darueber anlegen — der Provider scheitert schon an seiner Wurzel.
 * Diese Funktion liefert denselben Provider ohne Unterpfad, also an der Wurzel
 * der Verbindung. Zwei Verwendungen: das Verzeichnis einer neuen Library
 * anlegen, und unterscheiden, ob die Verbindung nicht antwortet oder nur das
 * Verzeichnis fehlt.
 *
 * Nur fuer den Owner und nur fuer Libraries auf einer Speicher-Verbindung
 * (ueber `hatSpeicherVerbindung` gefragt, nicht ueber den Typ). Der
 * Factory-Cache traegt den Pfad im Schluessel; der naechste gewoehnliche
 * `getServerProvider` baut den Provider der Library deshalb neu.
 *
 * @module storage
 */

import { getSelfBaseUrl } from '@/lib/env'
import { LibraryService } from '@/lib/services/library-service'
import { toFactoryLibrary } from '@/lib/storage-connections/library-storage'
import { StorageFactory } from '@/lib/storage/storage-factory'
import type { StorageProvider } from '@/lib/storage/types'
import type { Library } from '@/types/library'

/** true, wenn die Library auf einer Speicher-Verbindung des Kontos liegt (nicht auf dem Dateisystem des Servers). */
export function hatSpeicherVerbindung(library: Pick<Library, 'storageConnectionId'>): boolean {
  return typeof library.storageConnectionId === 'string' && library.storageConnectionId.length > 0
}

export async function getServerProviderAnVerbindungsWurzel(userEmail: string, libraryId: string): Promise<StorageProvider> {
  const library = (await LibraryService.getInstance().getUserLibraries(userEmail)).find((l) => l.id === libraryId)
  if (!library) throw new Error('Library nicht gefunden oder nicht die eigene')
  if (!hatSpeicherVerbindung(library)) throw new Error('Die Library liegt auf keiner Speicher-Verbindung — es gibt keine Verbindungs-Wurzel')
  const factory = StorageFactory.getInstance()
  factory.setApiBaseUrl(getSelfBaseUrl())
  factory.setUserEmail(userEmail)
  factory.setServerContext(true)
  factory.setLibraries([await toFactoryLibrary(library, '', userEmail)])
  const provider = await factory.getProvider(library.id)
  if ('setUserEmail' in provider && typeof provider.setUserEmail === 'function') {
    (provider as unknown as { setUserEmail: (e: string) => void }).setUserEmail(userEmail)
  }
  const validierung = await provider.validateConfiguration()
  if (!validierung.isValid) throw new Error(validierung.error || 'Speicher-Verbindung antwortet nicht')
  return provider
}
