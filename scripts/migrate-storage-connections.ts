/**
 * Migration: Speicher-Zugangsdaten aus den Libraries in Speicher-Verbindungen
 * (Plan docs/plans/speicher-verbindungen-und-library-anlage.plan.md, Teil A, A2).
 *
 * Je Library vom Typ nextcloud/onedrive mit Zugangsdaten in `config` entsteht
 * eine Verbindung des Besitzers in `storage_connections` (Geheimnisse
 * AES-256-GCM-verschluesselt wie im Repository); gleiche Zugaenge werden
 * zusammengelegt (Nextcloud: WebDAV-URL + Benutzer, OneDrive: Tenant +
 * Client-Id), auch mit schon vorhandenen Verbindungen der Konto-Seite. Danach
 * zeigt die Library mit `storageConnectionId` darauf, die Altfelder sind
 * geleert. Idempotent; nichts wird ohne --apply geschrieben.
 *
 * Aufruf:
 *   pnpm tsx scripts/migrate-storage-connections.ts            # Probelauf (nur Bericht)
 *   pnpm tsx scripts/migrate-storage-connections.ts --apply    # Backup + Migration
 *
 * Braucht MONGODB_URI, MONGODB_DATABASE_NAME und CREDENTIALS_ENCRYPTION_KEY
 * (.env). Geheimnisse erscheinen nie in der Ausgabe; das Backup unter
 * backups/ enthaelt den Alt-Bestand der Libraries im Klartext wie die
 * Datenbank selbst — sicher verwahren und nach erfolgreicher Pruefung loeschen.
 */

import * as dotenv from 'dotenv'
dotenv.config()

import { MongoClient, type Document } from 'mongodb'
import * as fs from 'fs'
import * as path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { decryptSecret, encryptSecret } from '@/lib/security/credential-cipher'
import { toStored } from '@/lib/repositories/storage-connections-repo'
import {
  dedupeKeyFor,
  planStorageConnectionMigration,
  type ExistingConnectionKey,
  type LegacyUserDoc,
} from '@/lib/storage-connections/migration-plan'
import type { StorageConnection } from '@/types/storage-connection'

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  const uri = process.env.MONGODB_URI
  const dbName = process.env.MONGODB_DATABASE_NAME
  const librariesCollection = process.env.MONGODB_COLLECTION_NAME || 'libraries'
  if (!uri || !dbName) throw new Error('MONGODB_URI und MONGODB_DATABASE_NAME muessen gesetzt sein (.env)')
  // Schluessel frueh pruefen: ohne ihn waere jede neue Verbindung unlesbar.
  decryptSecret(encryptSecret('schluessel-probe'))

  const client = new MongoClient(uri)
  await client.connect()
  try {
    const db = client.db(dbName)
    // Untypisierte Collections: das Skript schreibt mit Positions-Operator ($)
    // in das libraries-Array, was die strikten Mongo-Typen nicht abbilden.
    const libsCol = db.collection<Document>(librariesCollection)
    const connCol = db.collection<Document>('storage_connections')

    const users = (await libsCol.find({}).toArray()) as unknown as LegacyUserDoc[]
    const vorhandene = (await connCol.find({}).toArray()) as unknown as StorageConnection[]
    const existing: ExistingConnectionKey[] = vorhandene.map((c) => ({
      id: c.id,
      ownerEmail: c.ownerEmail,
      dedupeKey: c.type === 'nextcloud'
        ? dedupeKeyFor('nextcloud', c.nextcloud ?? {})
        : dedupeKeyFor('onedrive', c.onedrive ?? {}),
    }))
    const plan = planStorageConnectionMigration(users, existing, new Date().toISOString(), uuidv4)

    console.log(`Konten: ${users.length}, vorhandene Verbindungen: ${vorhandene.length}`)
    console.log(`Neue Verbindungen: ${plan.neueVerbindungen.length}`)
    for (const v of plan.neueVerbindungen) {
      const warnung = v.geheimnisFehlt ? '  (GEHEIMNIS FEHLT — auf der Konto-Seite nachtragen)' : ''
      console.log(`  + ${v.connection.ownerEmail}: "${v.connection.label}" fuer ${v.libraries.length} Library(s): ${v.libraries.join(', ')}${warnung}`)
    }
    console.log(`Libraries umhaengen/bereinigen: ${plan.libraryUpdates.length}`)
    for (const u of plan.libraryUpdates) {
      console.log(`  ~ ${u.ownerEmail}: "${u.label}" → ${u.storageConnectionId}; Altfelder: ${u.removeFields.join(', ') || '—'}`)
    }
    for (const s of plan.uebersprungen) console.log(`  · "${s.label}": ${s.grund}`)

    if (!apply) {
      console.log('\nPROBELAUF (nichts geschrieben). Ausfuehren mit --apply.')
      return
    }
    if (plan.neueVerbindungen.length === 0 && plan.libraryUpdates.length === 0) {
      console.log('Nichts zu tun.')
      return
    }

    const backupDir = path.join(process.cwd(), 'backups')
    fs.mkdirSync(backupDir, { recursive: true })
    const backupFile = path.join(backupDir, `storage-connections-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
    fs.writeFileSync(backupFile, JSON.stringify({ dbName, librariesCollection, users }, null, 2), 'utf8')
    console.log(`Backup geschrieben: ${backupFile}`)

    for (const v of plan.neueVerbindungen) await connCol.insertOne({ ...toStored(v.connection) } as Document)
    for (const u of plan.libraryUpdates) {
      const unset = Object.fromEntries(u.removeFields.map((f) => [`libraries.$.config.${f}`, '']))
      await libsCol.updateOne(
        { email: u.ownerEmail, 'libraries.id': u.libraryId },
        { $set: { 'libraries.$.storageConnectionId': u.storageConnectionId }, ...(u.removeFields.length > 0 ? { $unset: unset } : {}) },
      )
    }
    console.log(`Fertig: ${plan.neueVerbindungen.length} Verbindungen angelegt, ${plan.libraryUpdates.length} Libraries umgehaengt.`)
  } finally {
    await client.close()
  }
}

main().catch((error) => {
  console.error('Migration fehlgeschlagen:', error instanceof Error ? error.message : error)
  process.exit(1)
})
