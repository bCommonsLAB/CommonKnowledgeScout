/**
 * @fileoverview Speicher-Verbindung — Zugangsdaten gehoeren der Person, nicht
 * der Library (Plan speicher-verbindungen-und-library-anlage, Teil A, §3).
 *
 * Eine Verbindung ist Nextcloud (WebDAV) oder OneDrive (Azure-App plus
 * OAuth-Tokens). Lokale Libraries brauchen keine Verbindung (Owner-Entscheid
 * E1). Geheimnisse liegen verschluesselt in `storage_connections`; der Client
 * sieht nur `StorageConnectionSummary`.
 */

export type StorageConnectionType = 'nextcloud' | 'onedrive'

export function isStorageConnectionType(value: unknown): value is StorageConnectionType {
  return value === 'nextcloud' || value === 'onedrive'
}

/** Nextcloud-Zugang; `appPassword` ist ein Geheimnis. */
export interface NextcloudConnectionData {
  webdavUrl: string
  username: string
  appPassword: string
}

/** OneDrive-Zugang; `clientSecret`, `accessToken`, `refreshToken` sind Geheimnisse. */
export interface OneDriveConnectionData {
  tenantId: string
  clientId: string
  clientSecret: string
  accessToken?: string
  refreshToken?: string
  /** Unix-Sekunden (wie bisher in der Library-Config). */
  tokenExpiry?: number
}

/** Ergebnis des letzten Verbindungstests, am Datensatz gespeichert. */
export interface StorageConnectionTestResult {
  at: string
  ok: boolean
  message: string
}

/** Serverseitige, entschluesselte Sicht (verlaesst den Server nie). */
export interface StorageConnection {
  id: string
  ownerEmail: string
  label: string
  type: StorageConnectionType
  nextcloud?: NextcloudConnectionData
  onedrive?: OneDriveConnectionData
  lastTest: StorageConnectionTestResult | null
  createdAt: string
  updatedAt: string
}

/** Client-sichere Sicht: Bezeichnung, Typ, Kennungen, „gesetzt/nicht gesetzt", letzter Test — nie Geheimnisse. */
export interface StorageConnectionSummary {
  id: string
  label: string
  type: StorageConnectionType
  lastTest: StorageConnectionTestResult | null
  createdAt: string
  updatedAt: string
  nextcloud?: { webdavUrl: string; username: string; appPasswordSet: boolean }
  onedrive?: {
    tenantId: string
    clientId: string
    clientSecretSet: boolean
    loggedIn: boolean
    tokenExpiry: number | null
  }
}

/** Eingabe beim Anlegen und Aendern. Ein leeres oder fehlendes Geheimnis heisst beim Aendern: beibehalten. */
export interface StorageConnectionInput {
  label: string
  type: StorageConnectionType
  nextcloud?: { webdavUrl: string; username: string; appPassword?: string }
  onedrive?: { tenantId: string; clientId: string; clientSecret?: string }
}
