/**
 * @fileoverview Repository fuer Speicher-Verbindungen (`storage_connections`).
 *
 * @description
 * Account-Domaene wie `mcp-keys-repo.ts`: EINE globale Collection, fachlicher
 * Schluessel ist `ownerEmail` plus `id`. Bewusste Abweichung vom
 * Per-Library-Muster (mongodb-repository-pattern.md), weil Verbindungen der
 * Person gehoeren, nicht der Library.
 *
 * Verschluesselung am Rand des Repos (Plan Teil A, „Verschluesselung und
 * Migration"): Geheimnisse (App-Passwort, Client-Secret, OAuth-Tokens) werden
 * beim Schreiben mit AES-256-GCM verschluesselt und beim Lesen entschluesselt.
 * Aufrufer sehen Klartext, die Datenbank nie. Fehlt der Schluessel
 * (`CREDENTIALS_ENCRYPTION_KEY`), wirft der Cipher — kein stiller Rueckfall.
 *
 * @module repositories
 */

import type { Collection } from 'mongodb'
import { getCollection } from '@/lib/mongodb-service'
import { decryptSecret, encryptSecret } from '@/lib/security/credential-cipher'
import type { StorageConnection } from '@/types/storage-connection'

/** Gespeicherte Form: gleiche Felder, Geheimnisse als `enc:v1:`-Token. */
export interface StorageConnectionDoc extends StorageConnection {
  _id?: string
}

const COLLECTION = 'storage_connections'

let collectionCache: Collection<StorageConnectionDoc> | null = null
let indexEnsured = false

async function getCol(): Promise<Collection<StorageConnectionDoc>> {
  if (collectionCache) return collectionCache
  collectionCache = await getCollection<StorageConnectionDoc>(COLLECTION)
  return collectionCache
}

async function ensureIndexes(): Promise<void> {
  if (indexEnsured) return
  const col = await getCol()
  await col.createIndex({ ownerEmail: 1, id: 1 }, { unique: true })
  indexEnsured = true
}

function requireOwner(ownerEmail: string): string {
  const email = ownerEmail.trim()
  if (email === '') throw new Error('Verbindungs-Repo: ownerEmail ist leer')
  return email
}

const mapSecret = (value: string | undefined, fn: (v: string) => string): string | undefined =>
  typeof value === 'string' && value !== '' ? fn(value) : value

/**
 * Geheimnisse verschluesseln; alle anderen Felder unveraendert. Exportiert
 * fuer das Migrationsskript, das ausserhalb der App direkt schreibt.
 */
export function toStored(conn: StorageConnection): StorageConnectionDoc {
  const doc: StorageConnectionDoc = { ...conn }
  if (conn.nextcloud) {
    doc.nextcloud = { ...conn.nextcloud, appPassword: encryptSecret(conn.nextcloud.appPassword) }
  }
  if (conn.onedrive) {
    doc.onedrive = {
      ...conn.onedrive,
      clientSecret: encryptSecret(conn.onedrive.clientSecret),
      accessToken: mapSecret(conn.onedrive.accessToken, encryptSecret),
      refreshToken: mapSecret(conn.onedrive.refreshToken, encryptSecret),
    }
  }
  return doc
}

/** Geheimnisse entschluesseln; `_id` bleibt in der Datenbank. */
function fromStored(doc: StorageConnectionDoc): StorageConnection {
  const { _id: _ignored, ...rest } = doc
  void _ignored
  const conn: StorageConnection = { ...rest }
  if (doc.nextcloud) {
    conn.nextcloud = { ...doc.nextcloud, appPassword: decryptSecret(doc.nextcloud.appPassword) }
  }
  if (doc.onedrive) {
    conn.onedrive = {
      ...doc.onedrive,
      clientSecret: decryptSecret(doc.onedrive.clientSecret),
      accessToken: mapSecret(doc.onedrive.accessToken, decryptSecret),
      refreshToken: mapSecret(doc.onedrive.refreshToken, decryptSecret),
    }
  }
  return conn
}

/** Alle Verbindungen einer Person, nach Bezeichnung sortiert. */
export async function listStorageConnections(ownerEmail: string): Promise<StorageConnection[]> {
  const email = requireOwner(ownerEmail)
  const col = await getCol()
  const docs = await col.find({ ownerEmail: email }).sort({ label: 1 }).toArray()
  return docs.map(fromStored)
}

/** Eine Verbindung; `null` = nicht vorhanden oder nicht die eigene. */
export async function getStorageConnection(ownerEmail: string, id: string): Promise<StorageConnection | null> {
  const email = requireOwner(ownerEmail)
  const col = await getCol()
  const doc = await col.findOne({ ownerEmail: email, id })
  return doc ? fromStored(doc) : null
}

/** Legt eine Verbindung an (Geheimnisse verschluesselt). */
export async function insertStorageConnection(conn: StorageConnection): Promise<void> {
  requireOwner(conn.ownerEmail)
  await ensureIndexes()
  const col = await getCol()
  await col.insertOne(toStored(conn))
}

/** Ersetzt die Felder einer bestehenden Verbindung (Geheimnisse verschluesselt). */
export async function saveStorageConnection(conn: StorageConnection): Promise<void> {
  const email = requireOwner(conn.ownerEmail)
  const col = await getCol()
  const result = await col.updateOne({ ownerEmail: email, id: conn.id }, { $set: toStored(conn) })
  if (result.matchedCount !== 1) {
    throw new Error(`Verbindungs-Repo: Verbindung ${conn.id} nicht gefunden`)
  }
}

/** Loescht eine Verbindung; `false` = nicht vorhanden. */
export async function deleteStorageConnection(ownerEmail: string, id: string): Promise<boolean> {
  const email = requireOwner(ownerEmail)
  const col = await getCol()
  const result = await col.deleteOne({ ownerEmail: email, id })
  return result.deletedCount === 1
}
