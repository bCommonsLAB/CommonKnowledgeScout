/**
 * @fileoverview Service der Speicher-Verbindungen: anlegen, aendern, testen,
 * anmelden, loeschen. Einzige Schicht zwischen Routen und Repository.
 *
 * Regeln: Geheimnisse verlassen den Server nur als „gesetzt/nicht gesetzt"
 * (`toStorageConnectionSummary`); ein leeres Geheimnis beim Aendern heisst
 * „beibehalten"; Loeschen nur ohne abhaengige Library (A2 setzt
 * `library.storageConnectionId`, die Pruefung steht schon).
 */

import { v4 as uuidv4 } from 'uuid'
import { LibraryService } from '@/lib/services/library-service'
import type { OneDriveTokens } from '@/lib/storage/onedrive/token-store'
import {
  deleteStorageConnection as repoDelete,
  getStorageConnection as repoGet,
  insertStorageConnection,
  listStorageConnections as repoList,
  saveStorageConnection,
} from '@/lib/repositories/storage-connections-repo'
import {
  isStorageConnectionType,
  type StorageConnection,
  type StorageConnectionInput,
  type StorageConnectionSummary,
} from '@/types/storage-connection'
import { StorageConnectionInUseError, StorageConnectionInputError, StorageConnectionNotFoundError } from './errors'
import { probeStorageConnection } from './connection-probe'

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

/** Client-sichere Sicht ohne Geheimnisse. */
export function toStorageConnectionSummary(conn: StorageConnection): StorageConnectionSummary {
  const summary: StorageConnectionSummary = {
    id: conn.id,
    label: conn.label,
    type: conn.type,
    lastTest: conn.lastTest,
    createdAt: conn.createdAt,
    updatedAt: conn.updatedAt,
  }
  if (conn.nextcloud) {
    summary.nextcloud = {
      webdavUrl: conn.nextcloud.webdavUrl,
      username: conn.nextcloud.username,
      appPasswordSet: conn.nextcloud.appPassword !== '',
    }
  }
  if (conn.onedrive) {
    summary.onedrive = {
      tenantId: conn.onedrive.tenantId,
      clientId: conn.onedrive.clientId,
      clientSecretSet: conn.onedrive.clientSecret !== '',
      loggedIn: Boolean(conn.onedrive.refreshToken),
      tokenExpiry: conn.onedrive.tokenExpiry ?? null,
    }
  }
  return summary
}

/** Pflichtfelder je Typ; `existing` liefert beim Aendern die beizubehaltenden Geheimnisse. */
function applyInput(target: StorageConnection, input: StorageConnectionInput, existing: StorageConnection | null): void {
  const label = text(input.label)
  if (label === '') throw new StorageConnectionInputError('Bezeichnung fehlt.')
  if (!isStorageConnectionType(input.type)) throw new StorageConnectionInputError(`Unbekannter Verbindungstyp: "${String(input.type)}"`)
  if (existing && existing.type !== input.type) throw new StorageConnectionInputError('Der Typ einer Verbindung laesst sich nicht aendern.')
  target.label = label
  target.type = input.type

  if (input.type === 'nextcloud') {
    const webdavUrl = text(input.nextcloud?.webdavUrl)
    const username = text(input.nextcloud?.username)
    const appPassword = text(input.nextcloud?.appPassword) || existing?.nextcloud?.appPassword || ''
    const fehlend = [!webdavUrl && 'WebDAV-URL', !username && 'Benutzername', !appPassword && 'App-Passwort'].filter(Boolean)
    if (fehlend.length > 0) throw new StorageConnectionInputError(`Nextcloud: ${fehlend.join(', ')} fehlt.`)
    target.nextcloud = { webdavUrl, username, appPassword }
    return
  }

  const tenantId = text(input.onedrive?.tenantId)
  const clientId = text(input.onedrive?.clientId)
  const clientSecret = text(input.onedrive?.clientSecret) || existing?.onedrive?.clientSecret || ''
  const fehlend = [!tenantId && 'Tenant-ID', !clientId && 'Client-ID', !clientSecret && 'Client-Secret'].filter(Boolean)
  if (fehlend.length > 0) throw new StorageConnectionInputError(`OneDrive: ${fehlend.join(', ')} fehlt.`)
  // Tokens gehoeren zur App-Registrierung: aendert sich Tenant oder Client-Id, sind sie ungueltig.
  const appUnveraendert = existing?.onedrive?.tenantId === tenantId && existing?.onedrive?.clientId === clientId
  const tokens = appUnveraendert && existing?.onedrive
    ? { accessToken: existing.onedrive.accessToken, refreshToken: existing.onedrive.refreshToken, tokenExpiry: existing.onedrive.tokenExpiry }
    : {}
  target.onedrive = { tenantId, clientId, clientSecret, ...tokens }
}

export async function listStorageConnectionSummaries(ownerEmail: string): Promise<StorageConnectionSummary[]> {
  return (await repoList(ownerEmail)).map(toStorageConnectionSummary)
}

/** Entschluesselte Verbindung fuer den Server; wirft, wenn sie fehlt. */
export async function requireStorageConnection(ownerEmail: string, id: string): Promise<StorageConnection> {
  const conn = await repoGet(ownerEmail, id)
  if (!conn) throw new StorageConnectionNotFoundError(id)
  return conn
}

export async function createStorageConnection(ownerEmail: string, input: StorageConnectionInput): Promise<StorageConnectionSummary> {
  const now = new Date().toISOString()
  const conn: StorageConnection = { id: uuidv4(), ownerEmail, label: '', type: input.type, lastTest: null, createdAt: now, updatedAt: now }
  applyInput(conn, input, null)
  await insertStorageConnection(conn)
  return toStorageConnectionSummary(conn)
}

export async function updateStorageConnection(ownerEmail: string, id: string, input: StorageConnectionInput): Promise<StorageConnectionSummary> {
  const existing = await requireStorageConnection(ownerEmail, id)
  const conn: StorageConnection = { ...existing, updatedAt: new Date().toISOString() }
  applyInput(conn, input, existing)
  await saveStorageConnection(conn)
  return toStorageConnectionSummary(conn)
}

/** Loescht nur, wenn keine Library der Person auf die Verbindung zeigt. */
export async function deleteStorageConnection(ownerEmail: string, id: string): Promise<void> {
  await requireStorageConnection(ownerEmail, id)
  const libraries = await LibraryService.getInstance().getUserLibraries(ownerEmail)
  const abhaengig = libraries.filter((lib) => lib.storageConnectionId === id).map((lib) => lib.label)
  if (abhaengig.length > 0) throw new StorageConnectionInUseError(abhaengig)
  await repoDelete(ownerEmail, id)
}

/** Testet die Verbindung, speichert Ergebnis (und bei OneDrive erneuerte Tokens) am Datensatz. */
export async function testStorageConnection(ownerEmail: string, id: string): Promise<StorageConnectionSummary> {
  const conn = await requireStorageConnection(ownerEmail, id)
  const result = await probeStorageConnection(conn)
  if (result.onedriveTokens && conn.onedrive) conn.onedrive = { ...conn.onedrive, ...result.onedriveTokens }
  conn.lastTest = { at: new Date().toISOString(), ok: result.ok, message: result.message }
  conn.updatedAt = conn.lastTest.at
  await saveStorageConnection(conn)
  return toStorageConnectionSummary(conn)
}

/** Speichert OneDrive-Tokens nach dem Login (Callback) bzw. entfernt sie (Abmelden). */
export async function setOneDriveTokens(ownerEmail: string, id: string, tokens: OneDriveTokens | null): Promise<StorageConnectionSummary> {
  const conn = await requireStorageConnection(ownerEmail, id)
  if (!conn.onedrive) throw new StorageConnectionInputError('Keine OneDrive-Verbindung.')
  const { accessToken: _a, refreshToken: _r, tokenExpiry: _t, ...app } = conn.onedrive
  void _a; void _r; void _t
  conn.onedrive = tokens ? { ...app, ...tokens } : app
  conn.updatedAt = new Date().toISOString()
  await saveStorageConnection(conn)
  return toStorageConnectionSummary(conn)
}
